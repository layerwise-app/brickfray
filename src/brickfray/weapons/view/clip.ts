import * as THREE from 'three';
import type { WeaponId } from '../defs';
import type { ViewCue } from '../types';
import type { Goal } from './goals';
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
}

/** What a clip contributes this frame, on top of the procedural pose. */
export class Frame {
  readonly gunPos = new THREE.Vector3();
  readonly gunRot = new THREE.Vector3();
  left: [Goal | null, Goal | null, number] = [null, null, 0];
  right: [Goal | null, Goal | null, number] = [null, null, 0];
  readonly parts = new Map<string, number[]>();
  show = { mallet: false, grenade: false, shell: false, pin: true };
  /** 0…1: how much the clip overrides aiming and sprint posing. */
  busy = 0;

  reset() {
    this.gunPos.set(0, 0, 0);
    this.gunRot.set(0, 0, 0);
    this.left = [null, null, 0];
    this.right = [null, null, 0];
    this.parts.clear();
    this.show.mallet = this.show.grenade = this.show.shell = false;
    this.show.pin = true;
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
  sample(u: number, f: Frame, ctx: ClipCtx): void;
}

export type Keys = readonly (readonly [number, readonly number[]])[];

/** Piecewise smoothstep interpolation of number arrays; holds the ends. */
export function track(u: number, keys: Keys, out: number[] = []): number[] {
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (u <= first[0]) return copy(first[1], out);
  if (u >= last[0]) return copy(last[1], out);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (u <= b[0]) {
      const t = smooth01((u - a[0]) / Math.max(1e-6, b[0] - a[0]));
      const n = Math.max(a[1].length, b[1].length);
      out.length = n;
      for (let j = 0; j < n; j++) out[j] = (a[1][j] ?? 0) + ((b[1][j] ?? 0) - (a[1][j] ?? 0)) * t;
      return out;
    }
  }
  return copy(last[1], out);
}

function copy(v: readonly number[], out: number[]) {
  out.length = v.length;
  for (let i = 0; i < v.length; i++) out[i] = v[i]!;
  return out;
}

/** The pair of goals around u and the eased blend between them. */
export function hand(u: number, keys: readonly (readonly [number, Goal])[]): [Goal, Goal, number] {
  if (u <= keys[0]![0]) return [keys[0]![1], keys[0]![1], 0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (u <= b[0]) return [a[1], b[1], smooth01((u - a[0]) / Math.max(1e-6, b[0] - a[0]))];
  }
  const last = keys[keys.length - 1]![1];
  return [last, last, 0];
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
