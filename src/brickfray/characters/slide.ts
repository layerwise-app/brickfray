import * as THREE from 'three';
import type { FootPose } from './gait';
import { lerp } from './ik';
import type { V3 } from './skeleton';

/**
 * A slide in model space, gliding forward: the lead (left) leg is thrown out ahead, knee soft, riding on its heel
 * with the toes up; the rear leg folds under the hips with its foot flat on the floor beside the seat and its knee
 * up and out; hips low and rolled back onto the rear leg, turned a little open. Nothing steps: the feet keep their
 * places while the body glides.
 */
export const SLIDE = {
  feet: [
    { pos: [-0.12, 0.105, -0.72] as V3, heading: -0.12, pitch: 0.45 },
    { pos: [0.2, 0.085, -0.02] as V3, heading: 0.7, pitch: 0 }
  ],
  /** Knee bend direction per leg: the lead knee up, the rear one up and out to the side. */
  poles: [new THREE.Vector3(0, 1, -0.4), new THREE.Vector3(0.8, 0.6, -0.15)],
  pelvis: { pos: [0.03, 0.44, 0.06] as V3, heading: 0.25, pitch: 0.3, roll: -0.08 },
  /** Chest lean back (rad, model space) while the gun stays up on the target. */
  chest: 0.12
} as const;

/** The hips' turn as heading, pitch and roll (rad). */
export interface Turn {
  heading: number;
  pitch: number;
  roll: number;
}

const at = new THREE.Vector3();

/** Blends foot `i` toward its slide place by `w`. */
export function slideFoot(f: FootPose, i: number, w: number) {
  if (w <= 0.001) return;
  const k = SLIDE.feet[i]!;
  f.pos.lerp(at.set(...k.pos), w);
  f.heading = lerp(f.heading, k.heading, w);
  f.pitch = lerp(f.pitch, k.pitch, w);
  f.toe = lerp(f.toe, 0, w);
  f.planted = lerp(f.planted, 1, w);
}

/** Blends the hips toward the slide's seat by `w`. */
export function slidePelvis(pos: THREE.Vector3, turn: Turn, w: number) {
  if (w <= 0.001) return;
  const k = SLIDE.pelvis;
  pos.lerp(at.set(...k.pos), w);
  turn.heading = lerp(turn.heading, k.heading, w);
  turn.pitch = lerp(turn.pitch, k.pitch, w);
  turn.roll = lerp(turn.roll, k.roll, w);
}
