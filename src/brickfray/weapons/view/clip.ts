import * as THREE from 'three';
import type { WeaponId } from '../defs';
import type { ViewCue } from '../types';
import type { FingerPose } from './fingers';
import type { Goal, HandPath } from './goals';
import { smooth01 } from './springs';
import type { Tuning } from './tuning';

/** Internal beats besides audio cues. */
export type ClipEvent = ViewCue | 'eject' | 'shellEject' | 'swap' | 'release' | 'shellLoaded' | 'boltRelease';

/** The current gun's nodes and the hand goals clips steer between. */
export interface ClipCtx {
  id: WeaponId;
  tuning: Tuning;
  view: THREE.Object3D;
  goals: Record<string, Goal>;
  /** Extra flags: shotgun reload began empty. */
  flags: { empty: boolean };
  /** The player's aim blend this frame (0 hip … 1 in the sights), before the clip's own `busy` takes any of it away. */
  ads: number;
}

/** What a clip contributes this frame, on top of the procedural pose. */
export class Frame {
  readonly gunPos = new THREE.Vector3();
  readonly gunRot = new THREE.Vector3();
  /** Where each hand is; null leaves it on the gun (support / grip rest). */
  left: HandPath | null = null;
  right: HandPath | null = null;
  /** Finger shapes; null keeps the weapon's default grip for that hand. */
  leftFingers: FingerPose | null = null;
  rightFingers: FingerPose | null = null;
  readonly parts = new Map<string, number[]>();
  /** Things in the left hand (0 absent, 1 there), and whether the grenade's pin is still to be seen. */
  show = { mallet: 0, grenade: 0, shell: 0, pin: true };
  /** The pin: how far its ring has come off the bomb onto the gun hand's thumb (0…1), and seconds since it was flicked away (negative until then). */
  pin = { hook: 0, fly: -1 };
  /** A shell going into the loading port: its seat on the gun this frame, and how far it has left the fingers for it (0…1). */
  shellSeat: Goal | null = null;
  shellIn = 0;
  /** 0…1: how much the clip overrides aiming and sprint posing. */
  busy = 0;

  reset() {
    this.gunPos.set(0, 0, 0);
    this.gunRot.set(0, 0, 0);
    this.left = this.right = null;
    this.leftFingers = this.rightFingers = null;
    this.parts.clear();
    this.show.mallet = this.show.grenade = this.show.shell = 0;
    this.show.pin = true;
    this.pin.hook = 0;
    this.pin.fly = -1;
    this.shellSeat = null;
    this.shellIn = 0;
    this.busy = 0;
  }

  gun(v: readonly number[], k = 1) {
    this.gunPos.x += (v[0] ?? 0) * k;
    this.gunPos.y += (v[1] ?? 0) * k;
    this.gunPos.z += (v[2] ?? 0) * k;
    this.gunRot.x += (v[3] ?? 0) * k;
    this.gunRot.y += (v[4] ?? 0) * k;
    this.gunRot.z += (v[5] ?? 0) * k;
  }

  /** Offset a moving part from its rest pose: [x, y, z, rx, ry, rz] in the part's parent space. */
  part(name: string, v: readonly number[]) {
    this.parts.set(name, [...v]);
  }
}

export interface Clip {
  readonly name: string;
  duration: number;
  /** Normalized times of cues and internal events. */
  events: readonly (readonly [number, ClipEvent])[];
  /** Stay on the last frame until replaced (cook, shotgun loading pose). */
  hold?: boolean;
  /** Seconds to blend in from the previous pose; short for strikes that must land on time. */
  fade?: number;
  /** The hands take the clip up on its first frame (a strike answering the press), not a frame later. */
  instant?: boolean;
  sample(u: number, f: Frame, ctx: ClipCtx): void;
}

export type Keys = readonly (readonly [number, readonly number[]])[];

/**
 * Smooth interpolation of number arrays through the keys (monotone cubic):
 * motion flows through a key instead of stopping on it, never overshoots, and
 * eases to rest only where the value really holds or turns around.
 */
export function track(u: number, keys: Keys, out: number[] = []): number[] {
  const n = keys.length;
  const first = keys[0]!;
  const last = keys[n - 1]!;
  if (u <= first[0]) return copy(first[1], out);
  if (u >= last[0]) return copy(last[1], out);
  let i = 0;
  while (i < n - 2 && u > keys[i + 1]![0]) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const h = Math.max(1e-6, b[0] - a[0]);
  const t = (u - a[0]) / h;
  const size = Math.max(a[1].length, b[1].length);
  out.length = size;
  for (let j = 0; j < size; j++) {
    const va = a[1][j] ?? 0;
    const vb = b[1][j] ?? 0;
    const d = (vb - va) / h;
    const ma = i > 0 ? tangent(((va - (keys[i - 1]![1][j] ?? 0)) / Math.max(1e-6, a[0] - keys[i - 1]![0])), d) : 0;
    const mb = i < n - 2 ? tangent(d, ((keys[i + 2]![1][j] ?? 0) - vb) / Math.max(1e-6, keys[i + 2]![0] - b[0])) : 0;
    out[j] = hermite(t, va, ma * h, vb, mb * h);
  }
  return out;
}

/** Slope at a key between two segment slopes: zero at a hold or a turn, else their harmonic mean. */
function tangent(before: number, after: number) {
  return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
}

export function hermite(t: number, a: number, ma: number, b: number, mb: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * ma + (-2 * t3 + 3 * t2) * b + (t3 - t2) * mb;
}

function copy(v: readonly number[], out: number[]) {
  out.length = v.length;
  for (let i = 0; i < v.length; i++) out[i] = v[i]!;
  return out;
}

/** The hand's place between the goals around u, with their neighbours so the path can arc through. */
export function hand(u: number, keys: readonly (readonly [number, Goal])[]): HandPath {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && u > keys[i + 1]![0]) i++;
  const a = keys[i]!;
  const b = keys[Math.min(n - 1, i + 1)]!;
  const before = keys[Math.max(0, i - 1)]!;
  const after = keys[Math.min(n - 1, i + 2)]!;
  const span = Math.max(1e-6, b[0] - a[0]);
  return {
    before: before[1],
    from: a[1],
    to: b[1],
    after: after[1],
    t: Math.min(1, Math.max(0, (u - a[0]) / span)),
    spans: [Math.max(1e-6, a[0] - before[0]), span, Math.max(1e-6, after[0] - b[0])]
  };
}

/** A short pulse peaking at c. */
export function bump(u: number, c: number, w: number) {
  const x = (u - c) / w;
  return Math.exp(-x * x);
}

/** Advances one clip, emits its events once each, and reports the normalized time. */
export class ClipPlayer {
  clip: Clip | null = null;
  time = 0;
  private emitted = 0;

  play(clip: Clip) {
    this.clip = clip;
    this.time = 0;
    this.emitted = 0;
  }

  stop() {
    this.clip = null;
  }

  /** Seconds the running clip still has to go. */
  get left() {
    return this.clip ? Math.max(0, this.clip.duration - this.time) : 0;
  }

  /** Speeds the running clip up from where it is so that it ends `seconds` from now. */
  hurry(seconds: number) {
    const clip = this.clip;
    const u = this.u;
    if (!clip || u >= 1 || this.left <= seconds) return;
    clip.duration = seconds / (1 - u);
    this.time = u * clip.duration;
  }

  get u() {
    if (!this.clip) return 0;
    return Math.min(1, this.time / Math.max(1e-3, this.clip.duration));
  }

  /** Returns false when a non-holding clip has finished this frame. */
  update(dt: number, emit: (e: ClipEvent) => void): boolean {
    const clip = this.clip;
    if (!clip) return false;
    this.time += dt;
    const u = this.u;
    while (this.emitted < clip.events.length && clip.events[this.emitted]![0] <= u) {
      const event = clip.events[this.emitted++]![1];
      emit(event);
      if (this.clip !== clip) return true;
    }
    if (u >= 1 && !clip.hold) {
      this.clip = null;
      return false;
    }
    return true;
  }
}
