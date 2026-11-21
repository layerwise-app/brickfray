import { describe, expect, it } from 'vitest';
import type { RemoteSnapshotPlayer } from '../net/codec';
import { BulletSounds, DebrisSounds, bulletSpeed, type Ears } from './bullet-sounds';
import { PEAK_AT } from './sync';
import { RemoteSounds } from './remote-sounds';
import type { AudioEngine, PlayOptions, SoundId } from './types';

function setup() {
  const played: { id: SoundId; options?: PlayOptions }[] = [];
  const audio = { play: (id: SoundId, options?: PlayOptions) => void played.push({ id, options }) } as unknown as AudioEngine;
  const ears: Ears = { listener: { x: 0, y: 1.6, z: 0 }, occlusion: () => 0, surfaceAt: () => 'plastic' };
  return { audio, ears, played, ids: () => played.map((p) => p.id) };
}

const remote = (patch: Partial<RemoteSnapshotPlayer> = {}): RemoteSnapshotPlayer => ({
  id: 2, alive: true, grounded: true, sprinting: false, x: 5, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: 0,
  weapon: 'ar', health: 100, shots: 0, ads: 0, reload: -1, melee: -1, grenade: -1, ...patch
});

describe('BulletSounds', () => {
  it('plays strikes near the listener after the bullet flight, and only a few pellets of a volley', () => {
    const { audio, ears, played } = setup();
    const bullets = new BulletSounds(audio, ears);
    bullets.volley();
    bullets.strike('stone', { x: 4, y: 1, z: 0 }, 33, 'ar', false);
    bullets.strike('stone', { x: 40, y: 1, z: 0 }, 33, 'ar', false);
    bullets.strike('lava', { x: 4, y: 1, z: 0 }, 33, 'ar', false);
    expect(played.map((p) => p.id)).toEqual(['impact:stone']);
    expect(played[0]!.options?.delay).toBeCloseTo(0.1, 2);
    bullets.volley();
    for (let i = 0; i < 8; i++) bullets.strike('metal', { x: 3, y: 1, z: i * 0.1 }, 10, 'shotgun', true);
    expect(played.filter((p) => p.id === 'impact:metal')).toHaveLength(3);
  });

  it('whizzes once per shot where the closest path passes within 4 m, never for one far off', () => {
    const { audio, ears, played } = setup();
    const bullets = new BulletSounds(audio, ears);
    bullets.flyby({ x: -30, y: 1.6, z: 3 }, [{ x: 30, y: 1.6, z: 3 }, { x: 30, y: 1.6, z: 1 }], 'shotgun');
    bullets.flyby({ x: -30, y: 1.6, z: 9 }, [{ x: 30, y: 1.6, z: 9 }], 'ar');
    expect(played.map((p) => p.id)).toEqual(['whiz:small']);
    const at = played[0]!.options!.position!;
    expect(at.x).toBeCloseTo(0, 0);
    expect(at.z).toBeCloseTo(2, 1);
  });

  it("starts a whiz early by its build-up so its peak lands as the bullet passes, skipping into it for a close shot", () => {
    const { audio, ears, played } = setup();
    const bullets = new BulletSounds(audio, ears);
    bullets.flyby({ x: -30, y: 1.6, z: 1 }, [{ x: 30, y: 1.6, z: 1 }], 'ar');
    bullets.flyby({ x: -3, y: 1.6, z: 0.5 }, [{ x: 30, y: 1.6, z: 0.5 }], 'sniper');
    const [far, close] = played.map((p) => p.options!);
    const rate = far!.rate ?? 1;
    expect(far!.delay! + PEAK_AT['whiz:rifle']! / rate).toBeCloseTo(30 / bulletSpeed('ar'), 3);
    expect(close!.delay! + PEAK_AT['whiz:crack']! / (close!.rate ?? 1) - (close!.offset ?? 0) / (close!.rate ?? 1)).toBeCloseTo(3 / bulletSpeed('sniper'), 3);
  });
});

describe('DebrisSounds', () => {
  it('lets a few clatters a second through and none far away', () => {
    const { audio, ears, ids } = setup();
    let now = 0;
    const debris = new DebrisSounds(audio, ears, () => now);
    for (let i = 0; i < 300; i++) {
      now = i / 100;
      debris.bounce({ x: 2, y: 0, z: 1 }, 4);
      debris.bounce({ x: 30, y: 0, z: 1 }, 4);
    }
    // 3 s at 4 a second plus the first burst of 3.
    expect(ids().length).toBeGreaterThan(11);
    expect(ids().length).toBeLessThan(17);
  });
});

describe('RemoteSounds', () => {
  it('plays the reload cues of the gun in hand and the hand moments between them as the reload passes them', () => {
    const { audio, ears, ids } = setup();
    const sounds = new RemoteSounds(audio, ears);
    sounds.update(2, remote({ weapon: 'sniper' }), { x: 5, y: 0, z: 0 });
    for (let p = 0; p <= 1; p += 0.05) sounds.update(2, remote({ weapon: 'sniper', reload: p }), { x: 5, y: 0, z: 0 });
    sounds.update(2, remote({ weapon: 'sniper' }), { x: 5, y: 0, z: 0 });
    expect(ids()).toEqual(['foley:gripOff', 'foley:boltMagOut', 'foley:pouch', 'foley:magScrape', 'foley:boltMagIn', 'foley:regrip']);
  });

  it('loads a shell per shotgun shell cycle after the load-in', () => {
    const { audio, ears, ids } = setup();
    const sounds = new RemoteSounds(audio, ears);
    sounds.update(2, remote({ weapon: 'shotgun' }), { x: 5, y: 0, z: 0 });
    for (let cycle = 0; cycle < 3; cycle++) for (let p = 0; p <= 1; p += 0.1) sounds.update(2, remote({ weapon: 'shotgun', reload: p }), { x: 5, y: 0, z: 0 });
    expect(ids()).toEqual(['cue:shellIn', 'cue:shellIn']);
  });

  it('hears a jump, the landing, a grenade pin and throw, and a slide', () => {
    const { audio, ears, ids, played } = setup();
    const sounds = new RemoteSounds(audio, ears);
    const at = { x: 5, y: 0, z: 0 };
    sounds.update(2, remote(), at);
    sounds.update(2, remote({ grounded: false, vy: 5 }), at);
    sounds.update(2, remote({ grounded: false, vy: -9 }), at);
    sounds.update(2, remote(), at);
    sounds.update(2, remote({ grenade: 0.25 }), at);
    sounds.update(2, remote({ grenade: 0.5 }), at);
    sounds.update(2, remote({ crouch: 1, vx: 9 }), at);
    sounds.update(2, remote({ crouch: 1, vx: 8 }), at);
    expect(ids()).toEqual(['jump', 'step:plastic', 'land', 'step:plastic', 'cue:pinPull', 'cue:throw', 'slide', 'step:plastic']);
    expect(played[2]!.options?.volume).toBeCloseTo(0.9, 2);
    expect(played[3]!.options?.volume).toBeCloseTo(0.9 * 0.9, 2);
  });
});
