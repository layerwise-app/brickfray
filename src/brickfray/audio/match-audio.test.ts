import { describe, expect, it } from 'vitest';
import { MELEES } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import { MELEE_CONTACT } from '../weapons/view/clips-melee';
import { MatchAudio, type MatchAudioState } from './match-audio';
import { PEAK_AT } from './sync';
import type { AudioEngine, PlayOptions, SoundId } from './types';

function setup(clear: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => boolean = () => true) {
  const played: { id: SoundId; options?: PlayOptions }[] = [];
  const held: { id: SoundId; stopped: boolean }[] = [];
  const audio = {
    play: (id: SoundId, options?: PlayOptions) => void played.push({ id, options }),
    playMusic: () => undefined,
    hold: (id: SoundId) => {
      const h = { id, stopped: false };
      held.push(h);
      return { stop: () => void (h.stopped = true), level: () => undefined };
    }
  } as unknown as AudioEngine;
  const state: MatchAudioState = { alive: true, health: 100, sliding: false, surface: 'plastic', listener: { x: 0, y: 1.6, z: 0 } };
  const sound = new MatchAudio(audio, 'docks', clear);
  const ids = () => played.map((p) => p.id).filter((id) => !id.startsWith('spot:'));
  const run = (seconds: number, patch: Partial<MatchAudioState> = {}) => {
    for (let t = 0; t < seconds; t += 1 / 60) sound.frame(1 / 60, { ...state, ...patch });
  };
  return { sound, played, held, ids, run };
}

describe('MatchAudio', () => {
  it('thumps the first bullet of a burst in full and merges the rest into a few ducked ones', () => {
    const { sound, played, run } = setup();
    for (let i = 0; i < 9; i++) {
      sound.hurt();
      run(0.1);
    }
    const hurts = played.filter((p) => p.id === 'hurt').map((p) => p.options?.volume);
    expect(hurts[0]).toBe(0.8);
    expect(hurts.length).toBeLessThanOrEqual(5);
    expect(hurts.slice(1).every((v) => v !== undefined && v <= 0.3)).toBe(true);
    run(0.3);
    sound.hurt();
    expect(played.at(-1)?.options?.volume).toBe(0.8);
  });

  it('drops one case per shot after the fall, and thins them out under automatic fire', () => {
    const { sound, ids, run } = setup();
    sound.action({ type: 'fire', empty: false }, 'pistol');
    run(0.3);
    expect(ids()).toEqual([]);
    run(0.4);
    expect(ids()).toEqual(['casing']);
    for (let i = 0; i < 10; i++) {
      sound.action({ type: 'fire', empty: false }, 'buzzer');
      run(0.063);
    }
    run(1);
    expect(ids().length).toBeGreaterThan(3);
    expect(ids().length).toBeLessThan(8);
  });

  it('ejects the shotgun shell while the pump is worked and nothing for caseless guns', () => {
    const { sound, ids, run } = setup();
    sound.action({ type: 'fire', empty: false }, 'shotgun');
    sound.action({ type: 'fire', empty: false }, 'nailer');
    run(1);
    expect(ids()).toEqual([]);
    sound.action({ type: 'cycle', duration: 0.7 }, 'shotgun');
    run(1);
    expect(ids()).toEqual(['shell']);
  });

  it('lands the bolt-thrown case a fall after the clip throws it', () => {
    const { sound, ids, run } = setup();
    sound.action({ type: 'cycle', duration: 0.8 }, 'sniper');
    run(0.9);
    expect(ids()).toEqual([]);
    run(0.15);
    expect(ids()).toEqual(['casing']);
    sound.action({ type: 'reload', empty: false, duration: 2.5 }, 'sniper');
    run(3);
    const cases = () => ids().filter((id) => id === 'casing' || id === 'shell');
    expect(cases()).toEqual(['casing']);
    sound.action({ type: 'reload', empty: true, duration: 3.2 }, 'sniper');
    run(1.1);
    expect(cases()).toEqual(['casing', 'casing']);
  });

  it('fills a reload with the hand and magazine moments its clip shows, and drops them when the reload is cut short', () => {
    const { sound, played, run } = setup();
    let clock = 0;
    const at: [SoundId, number][] = [];
    // The scenery's first spot sound falls at a random 4-10 s, inside this test's 4.3 s when the draw is low.
    const audio = () => played.filter((p) => !p.id.startsWith('spot:'));
    sound.action({ type: 'reload', empty: false, duration: 1.9 }, 'ar');
    for (; clock < 2; clock += 1 / 60) {
      const before = audio().length;
      run(1 / 60);
      for (const p of audio().slice(before)) at.push([p.id, clock + 1 / 60 + (p.options?.delay ?? 0)]);
    }
    expect(at.map(([id]) => id)).toEqual(['foley:gripOff', 'foley:pouch', 'foley:magScrape', 'foley:regrip']);
    const when = Object.fromEntries(at);
    expect(when['foley:pouch']! + PEAK_AT['foley:pouch']!).toBeCloseTo(0.77, 1);
    expect(when['foley:magScrape']! + PEAK_AT['foley:magScrape']!).toBeCloseTo(1.2, 1);
    expect(when['foley:regrip']!).toBeCloseTo(1.66, 1);
    played.length = 0;
    sound.action({ type: 'reload', empty: false, duration: 1.9 }, 'ar');
    run(0.3);
    sound.action({ type: 'switch', to: 'pistol', holster: 0.3, draw: 0.3 }, 'ar');
    run(2);
    expect(audio().map((p) => p.id)).toEqual(['foley:gripOff']);
  });

  it('counts down the last three seconds of warmup a semitone higher each second, then plays the start and the outcome once', () => {
    const { sound, played, ids } = setup();
    const ffa = { solo: false, timed: true, outcome: null };
    for (const left of [5, 3.4, 2.95, 2.5, 2.05, 1.9, 1.2, 0.9, 0.3]) sound.cues.setPhase('warmup', left, ffa);
    sound.cues.setPhase('playing', 600, ffa);
    sound.cues.setPhase('playing', 599, ffa);
    sound.cues.setPhase('ended', 0, { ...ffa, outcome: 'lost' });
    sound.cues.setPhase('ended', 0, { ...ffa, outcome: 'lost' });
    expect(ids()).toEqual(['countdown', 'countdown', 'countdown', 'matchStart', 'defeat']);
    const rates = played.filter((p) => p.id === 'countdown').map((p) => p.options?.rate ?? 1);
    expect(rates[0]).toBe(1);
    expect(rates[1]! / rates[0]!).toBeCloseTo(2 ** (1 / 12), 4);
    expect(rates[2]! / rates[1]!).toBeCloseTo(2 ** (1 / 12), 4);
    expect(played.filter((p) => p.id === 'countdown').map((p) => p.options?.variant)).toEqual([0, 1, 2]);
  });

  it('opens a solo run with the wave call alone and gives the waves, the cards and the outcome their own cues', () => {
    const { sound, ids, run } = setup();
    const solo = { solo: true, timed: false, outcome: null };
    sound.cues.setPhase('warmup', 0.5, solo);
    sound.cues.wave('opening');
    sound.cues.setPhase('playing', 0, solo);
    run(2);
    sound.cues.setPhase('intermission', 30, solo);
    sound.cues.offer();
    sound.cues.upgradeTaken();
    run(2);
    sound.cues.wave('boss');
    sound.cues.setPhase('playing', 0, solo);
    run(2);
    sound.cues.setPhase('ended', 12, { ...solo, outcome: 'over' });
    expect(ids()).toEqual(['countdown', 'waveStart', 'waveClear', 'upgradeOffer', 'upgradeTaken', 'bossWave', 'runOver']);
  });

  it('plays one respawn cue per spawn and the grenade cue only when a grenade comes back', () => {
    const { sound, ids, run } = setup();
    sound.cues.respawn();
    sound.cues.respawn();
    sound.cues.grenades(2, true);
    run(0.5);
    sound.cues.grenades(1, true);
    run(9);
    sound.cues.grenades(2, true);
    run(1);
    sound.cues.grenades(0, false);
    sound.cues.grenades(2, true);
    expect(ids()).toEqual(['respawn', 'grenadeReady']);
  });

  it('plays the warm-up music, the map\'s own while fighting, the final stretch and the results theme', () => {
    const music: (string | null)[] = [];
    const delays: number[] = [];
    const audio = { play: () => undefined, playMusic: (t: string | null, _l?: number, d = 0) => void (music.push(t), delays.push(d)) } as unknown as AudioEngine;
    const sound = new MatchAudio(audio, 'plaza', () => true);
    const ffa = { solo: false, timed: true, outcome: null };
    sound.cues.setPhase('warmup', 4, ffa);
    sound.cues.setPhase('playing', 500, ffa);
    sound.cues.setPhase('playing', 29, ffa);
    sound.cues.setPhase('ended', 12, { ...ffa, outcome: 'won' });
    expect(music).toEqual(['match', 'plaza', 'final', 'menu']);
    expect(delays.at(-1)).toBeGreaterThan(2);
  });

  it('beats faster as health runs out and stays silent above the threshold', () => {
    const { ids, run } = setup();
    run(3, { health: 60 });
    expect(ids()).toEqual([]);
    run(6, { health: 25 });
    const slow = ids().length;
    run(6, { health: 3 });
    expect(slow).toBeGreaterThanOrEqual(6);
    expect(ids().length - slow).toBeGreaterThan(slow + 1);
  });

  it('plays the same kill sound for every kill, with the headshot ping just in front of a headshot kill', () => {
    const { sound, played } = setup();
    sound.kill(false);
    sound.kill(true);
    expect(played.map((p) => p.id)).toEqual(['killConfirm', 'headshotMarker', 'killConfirm']);
    expect(played[0]!.options?.delay).toBe(0);
    expect(played[1]!.options?.delay ?? 0).toBe(0);
    expect(played[2]!.options?.delay).toBeGreaterThan(0.04);
  });

  it('plays a hard grenade bounce louder and brighter than a soft one, over the ground it hits', () => {
    const { sound, played } = setup();
    sound.bounce({ x: 3, y: 0.1, z: 0 }, 1);
    sound.bounce({ x: 3, y: 0.1, z: 0 }, 12);
    expect(played.map((p) => p.id)).toEqual(['grenadeBounce', 'step:plastic', 'grenadeBounce', 'step:plastic']);
    expect(played[2]!.options!.volume!).toBeGreaterThan(played[0]!.options!.volume! * 2);
    expect(played[2]!.options!.tone!).toBeGreaterThan(played[0]!.options!.tone!);
  });

  it('plays the slide once per slide with the ground under it, holds its scrape as long as it lasts, and keeps the own steps quiet', () => {
    const { sound, held, ids, run } = setup();
    run(0.5, { sliding: true });
    sound.footstep('plastic', 'rivet', null, 0.45, 2);
    expect(held.map((h) => h.stopped)).toEqual([false]);
    run(0.2);
    expect(held.map((h) => h.stopped)).toEqual([true]);
    run(0.5, { sliding: true });
    expect(ids()).toEqual(['slide', 'step:plastic', 'slide', 'step:plastic']);
    expect(held.map((h) => h.id)).toEqual(['slideLoop', 'slideLoop']);
  });

  it('ticks a cooked grenade from the pin pull, faster the longer it is held, and stops at the throw', () => {
    const { sound, ids, run } = setup();
    sound.action({ type: 'grenadeCook' }, 'ar');
    run(0.35);
    expect(ids()).toEqual([]);
    run(2.15);
    const ticks = ids().filter((id) => id === 'grenadeFuse').length;
    expect(ticks).toBeGreaterThanOrEqual(6);
    expect(ticks).toBeLessThanOrEqual(9);
    sound.action({ type: 'grenadeThrow', low: false }, 'ar');
    run(1);
    expect(ids().filter((id) => id === 'grenadeFuse').length).toBeLessThanOrEqual(ticks + 1);
  });

  it('grades occlusion by how many rays round the source a wall blocks, and glides a cached source', () => {
    const wall = { top: 0 };
    const { sound, run } = setup((_ax, _ay, _az, _bx, by) => by >= wall.top);
    expect(sound.occlusion(null, { x: 5, y: 0, z: 0 })).toBe(0);
    wall.top = 1;
    expect(sound.occlusion(null, { x: 5, y: 0, z: 0 })).toBeCloseTo(0.85);
    wall.top = 9;
    expect(sound.occlusion(null, { x: 5, y: 0, z: 0 })).toBeCloseTo(1);
    expect(sound.occlusion(7, { x: 5, y: 0, z: 0 })).toBeCloseTo(1);
    wall.top = 0;
    run(0.1);
    expect(sound.occlusion(7, { x: 5, y: 0, z: 0 })).toBeCloseTo(1);
    run(0.15);
    const fading = sound.occlusion(7, { x: 5, y: 0, z: 0 });
    expect(fading).toBeGreaterThan(0.05);
    expect(fading).toBeLessThan(0.6);
    run(1);
    expect(sound.occlusion(7, { x: 5, y: 0, z: 0 })).toBeLessThan(0.01);
  });

  it('plays a remote miss from just before the swing peak and nothing for an own miss', () => {
    const { sound, played } = setup();
    sound.melee('vega', false, null, true);
    expect(played).toEqual([]);
    sound.melee('vega', false, { x: 3, y: 0, z: 0 }, false);
    sound.melee('coral', true, { x: 3, y: 0, z: 0 }, false);
    expect(played.map((p) => p.id)).toEqual(['meleeSwing:blade', 'meleeHit:iron']);
    expect(played[0]!.options?.offset).toBeGreaterThan(0);
  });

  it('holds an own hit until the swing is shown landing', () => {
    const { sound, played } = setup();
    sound.melee('vega', true, null, true);
    sound.melee('clack', true, null, true);
    expect(played.map((p) => p.id)).toEqual(['meleeHit:blade', 'meleeHit:slash']);
    const melee = LOADOUTS.vega.melee;
    expect(MELEE_CONTACT[melee] - MELEES[melee].windup).toBeGreaterThan(0);
    expect(played[0]!.options?.delay).toBeCloseTo(MELEE_CONTACT[melee] - MELEES[melee].windup);
    expect(played[1]!.options?.delay).toBeCloseTo(MELEE_CONTACT[LOADOUTS.clack.melee] - MELEES[LOADOUTS.clack.melee].windup);
  });

  it('strikes the surface a swing meets in the world, at the shown contact for the own swing', () => {
    const { sound, played } = setup();
    sound.melee('vega', false, null, true, { surface: 'stone', at: [0, 1.4, -1.5] });
    sound.melee('coral', false, { x: 3, y: 0, z: 0 }, false, { surface: 'wood', at: [3.5, 1.2, -1] });
    sound.melee('vega', false, null, true, { surface: 'lava', at: [0, 1.4, -1.5] });
    expect(played.map((p) => p.id)).toEqual(['step:stone', 'meleeHit:blade', 'meleeSwing:heavy', 'step:wood', 'meleeHit:iron']);
    const melee = LOADOUTS.vega.melee;
    expect(played[0]!.options?.delay).toBeCloseTo(MELEE_CONTACT[melee] - MELEES[melee].windup);
    expect(played[0]!.options?.position).toEqual({ x: 0, y: 1.4, z: -1.5 });
    expect(played[4]!.options?.delay).toBe(0);
  });

  it('layers the walker\'s outfit on each footstep', () => {
    const { sound, played } = setup();
    sound.footstep('metal', 'clack', { x: 2, y: 0, z: 0 }, 1, 3);
    sound.footstep('plastic', 'nova', null, 0.5, 2);
    sound.footstep('wood', 'grunt', { x: 1, y: 0, z: 0 }, 1, 3);
    expect(played.map((p) => p.id)).toEqual(['step:metal', 'gear:armour', 'step:plastic', 'gear:suit', 'step:wood']);
    expect(played[1]!.options?.position).toEqual({ x: 2, y: 0, z: 0 });
  });
});
