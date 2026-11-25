import { inverseGain, type Falloff } from '../audio/catalog';
import { farShare } from '../audio/distance';
import type { WeaponId } from '../weapons/defs';
import type { HostSim } from './host';
import type { HostPlayer, PlayerState } from './types';

/**
 * What the game's audio plays to everyone else when a player moves, fires or handles its gear, and at what level
 * (the catalog's loudness target in dB, its falloff, the volume the client triggers it at): the remote footsteps of
 * game/match-view (0.9 walking, 1.2 sprinting; none crouched, airborne or under 1.2 m/s), the jump, landing and slide
 * of audio/remote-sounds with their footstep layer, a reload's loudest cue, the grenade pin and throw, a melee swing,
 * and each gun's near and distant takes. bot-ears.test.ts keeps these equal to the audio's own numbers.
 */
export const SOUND = {
  step: { loudness: -23, falloff: 'step', walk: 0.9, sprint: 1.2 },
  move: { loudness: -22, falloff: 'normal', jump: 0.8, slide: 0.8, ground: { jump: 0.5, land: 0.9, slide: 0.7 } },
  reload: { loudness: -19.5, falloff: 'handling', volume: 0.9 },
  pin: { loudness: -24.5, falloff: 'handling', volume: 0.9 },
  throw: { loudness: -22, falloff: 'handling', volume: 1 },
  swing: { loudness: -21, falloff: 'normal', volume: 1 }
} as const;
export const GUN_LOUDNESS: Record<WeaponId, readonly [number, number]> = {
  ar: [-17, -19],
  shotgun: [-15.5, -17.5],
  sniper: [-13.5, -15.5],
  pistol: [-19, -21],
  nailer: [-19.5, -21.5],
  pulse: [-17.5, -19.5],
  harpoon: [-17.5, -19.5],
  cannon: [-16, -18],
  buzzer: [-19, -21]
};
const gunFalloff = (w: WeaponId): Falloff => (w === 'sniper' ? 'carry' : 'loud');
/** Steps per second of a remote figure's gait (audio/step-triggers OwnSteps cadence). */
const CADENCE = { walk: 1.9, sprint: 2.6 };
/** A body faster than this (m/s) on the ground makes steps, and slides crouched faster than SLIDE. */
const STEPPING = 1.2;
const SLIDE = 6;
/**
 * The audio's occlusion: rays from the ear to points round a source, [up, sideways, share] (audio/match-audio PROBES);
 * fully blocked halves the level (OCCLUDED.gain 0.5).
 */
const PROBES = [
  [0, 0, 0.4],
  [0.75, 0, 0.15],
  [1.5, 0, 0.15],
  [0.5, -0.7, 0.15],
  [0.5, 0.7, 0.15]
] as const;
const OCCLUDED_GAIN = 0.5;

/**
 * How bots judge a sound's level at the ear: over `sure` it is heard, under `gone` never, between by chance. The
 * catalog's own step design: a walking step at 25 m stays over a map's bed in a quiet moment (about -40) and is under
 * it by 45 m (about -51). A sound `mask` dB under the loudest one the bot heard or made in the last `maskTime` s is
 * lost under it (its own gunfire drowns steps).
 */
export const HEAR = { sure: -42, gone: -50, mask: 20, maskTime: 0.5 };

export type NoiseKind = 'shot' | 'step' | 'jump' | 'land' | 'slide' | 'reload' | 'pin' | 'throw' | 'swing';

/** One sound a player made: where the audio places it (feet, or the muzzle for a shot), when, and how loud it plays. */
export interface Noise {
  source: number;
  kind: NoiseKind;
  x: number;
  y: number;
  z: number;
  /** Metres above the point that the occlusion probes aim at (the audio lifts a remote's feet by 1 m). */
  lift: number;
  /** The floor the maker stands on (the height a heard enemy is placed at). */
  ground: number;
  volume: number;
  weapon: WeaponId;
  time: number;
}

/** Level (dB at the ear) of a noise `d` m away with `occlusion` (0…1) solid world in between. */
export function noiseLevel(n: Pick<Noise, 'kind' | 'volume' | 'weapon'>, d: number, occlusion: number): number {
  const open = 1 - (1 - OCCLUDED_GAIN) * occlusion;
  const db = (loudness: number, falloff: Falloff, volume: number) => loudness + 20 * Math.log10(Math.max(volume * open * inverseGain(falloff, d), 1e-9));
  switch (n.kind) {
    case 'shot': {
      const far = farShare(d);
      const [near, distant] = GUN_LOUDNESS[n.weapon];
      const f = gunFalloff(n.weapon);
      return Math.max(db(near, f, Math.cos((far * Math.PI) / 2)), far > 0 ? db(distant, f, Math.sin((far * Math.PI) / 2)) : -Infinity);
    }
    case 'step':
      return db(SOUND.step.loudness, SOUND.step.falloff, n.volume);
    case 'jump':
    case 'land':
    case 'slide':
      return Math.max(db(SOUND.move.loudness, SOUND.move.falloff, n.volume), db(SOUND.step.loudness, SOUND.step.falloff, n.volume * SOUND.move.ground[n.kind]));
    default: {
      const s = SOUND[n.kind];
      return db(s.loudness, s.falloff, n.volume);
    }
  }
}

interface Seen {
  shots: number;
  grounded: boolean;
  fall: number;
  reload: number;
  melee: number;
  thrown: number;
  cook: number;
  sliding: boolean;
  /** Progress to the next footstep (1 = a foot lands). */
  stride: number;
}

/** Seconds a noise stays on the list for bots that think less often than every tick. */
const KEEP = 1;

/** The noises every player makes, read tick by tick from the host's state as clients derive them from snapshots. */
export class Noises {
  readonly list: Noise[] = [];
  private seen = new Map<number, Seen>();

  constructor(private readonly host: HostSim) {}

  update(dt: number) {
    const now = this.host.time;
    while (this.list.length && this.list[0]!.time < now - KEEP) this.list.shift();
    for (const p of this.host.players.values()) this.listen(p, now, dt);
  }

  private listen(p: HostPlayer, now: number, dt: number) {
    const m = p.move;
    const a = p.arms;
    const prev = this.seen.get(p.id);
    const speed = Math.hypot(m.vx, m.vz);
    const sliding = m.grounded && m.crouch > 0.5 && speed > SLIDE;
    const next: Seen = {
      shots: a.shots,
      grounded: m.grounded,
      fall: m.grounded ? 0 : Math.max(prev && !prev.grounded ? prev.fall : 0, -m.vy),
      reload: a.reload,
      melee: a.meleeTime,
      thrown: p.thrown ?? 0,
      cook: a.cook,
      sliding,
      stride: prev?.stride ?? 0
    };
    this.seen.set(p.id, next);
    if (!p.alive || !prev) return;
    const add = (kind: NoiseKind, volume: number, lift = 1, at: readonly [number, number, number] = [m.x, m.y, m.z]) =>
      this.list.push({ source: p.id, kind, x: at[0], y: at[1], z: at[2], lift, ground: m.y, volume, weapon: a.weapon, time: now });
    if (a.shots > prev.shots) add('shot', 1, 0, this.host.eye(p));
    if (prev.grounded && !m.grounded && m.vy > 2.5) add('jump', SOUND.move.jump);
    if (!prev.grounded && m.grounded) add('land', Math.min(Math.max(prev.fall / 10, 0.3), 1));
    if (sliding && !prev.sliding) add('slide', SOUND.move.slide);
    if (a.reload > 0 && (prev.reload <= 0 || a.reload > prev.reload + 0.05)) add('reload', SOUND.reload.volume);
    if (a.cook >= 0 && prev.cook < 0) add('pin', SOUND.pin.volume);
    if (next.thrown > prev.thrown) add('throw', SOUND.throw.volume);
    if (a.meleeTime >= 0 && (prev.melee < 0 || a.meleeTime < prev.melee)) add('swing', SOUND.swing.volume, 0, [m.x, m.y + 1.2 * p.scale, m.z]);
    if (m.grounded && speed > STEPPING && m.crouch < 0.5 && !sliding) {
      next.stride += dt * (m.sprinting ? CADENCE.sprint : CADENCE.walk);
      if (next.stride >= 1) {
        next.stride -= 1;
        add('step', m.sprinting ? SOUND.step.sprint : SOUND.step.walk);
      }
    }
  }
}

/** What hearing keeps per bot: the noises already listened to, and the loudest it heard or made lately (masking). */
export interface EarState {
  heardUpTo: number;
  loud: { level: number; at: number };
}

/** A heard enemy: the loudest of its noises since the last listen, how many there were, and how it reached the ear. */
export interface Heard {
  source: number;
  noise: Noise;
  count: number;
  distance: number;
  occlusion: number;
  level: number;
}

/**
 * Listen at `ear`: every hostile noise since the last time, the loudest per enemy, kept by chance between the
 * `gone` and `sure` levels (raised under a loud sound). Only what the audio would let a player hear gets through.
 */
export function listen(host: HostSim, noises: Noises, bot: PlayerState, ear: readonly [number, number, number], s: EarState, random: () => number): Heard[] {
  const now = host.time;
  const loudest = new Map<number, Heard>();
  if (bot.arms.sinceShot < HEAR.maskTime) mask(s, GUN_LOUDNESS[bot.arms.weapon][0], now - bot.arms.sinceShot);
  for (const n of noises.list) {
    if (n.time <= s.heardUpTo || n.source === bot.id) continue;
    const from = host.players.get(n.source);
    if (!from || !host.hostile(bot, from)) continue;
    const d = Math.hypot(n.x - ear[0], n.y + n.lift - ear[1], n.z - ear[2]);
    const open = noiseLevel(n, d, 0);
    if (open < HEAR.gone) continue;
    const best = loudest.get(n.source);
    if (best) best.count++;
    if (!best || open > best.level) loudest.set(n.source, { source: n.source, noise: n, count: best ? best.count : 1, distance: d, occlusion: 0, level: open });
  }
  s.heardUpTo = now;
  const sure = Math.max(HEAR.sure, now - s.loud.at < HEAR.maskTime ? s.loud.level - HEAR.mask : -Infinity);
  const gone = sure - (HEAR.sure - HEAR.gone);
  const heard: Heard[] = [];
  for (const h of loudest.values()) {
    h.occlusion = occlusion(host, ear, h.noise);
    h.level = noiseLevel(h.noise, h.distance, h.occlusion);
    const chance = Math.min(Math.max((h.level - gone) / (sure - gone), 0), 1);
    if (chance <= 0 || (chance < 1 && random() > 1 - (1 - chance) ** Math.min(h.count, 4))) continue;
    heard.push(h);
    mask(s, h.level, h.noise.time);
  }
  return heard;
}

function mask(s: EarState, level: number, at: number) {
  if (at - s.loud.at >= HEAR.maskTime || level > s.loud.level) s.loud = { level, at };
}

/** Share (0…1) of the audio's probe rays from the ear to round the noise that solid world blocks. */
function occlusion(host: HostSim, ear: readonly [number, number, number], n: Noise) {
  const dx = n.x - ear[0];
  const dz = n.z - ear[2];
  const across = Math.hypot(dx, dz) || 1;
  let blocked = 0;
  for (const [up, side, share] of PROBES) {
    if (!host.world.clearLine(ear[0], ear[1], ear[2], n.x - (dz / across) * side, n.y + n.lift + up, n.z + (dx / across) * side)) blocked += share;
  }
  return blocked;
}
