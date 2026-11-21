/**
 * Shape of one hand's fingers. Curls run 0 (straight) … 1 (closed into a
 * fist); the arms turn them into joint angles.
 */
export interface FingerPose {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  /** Fingers fanned apart, 0 (together) … 1. */
  spread: number;
  /** Thumb swung across the palm to meet the fingers, 0 (out to the side) … 1; below 0 it lies forward along the index finger (−1). */
  oppose: number;
  /** Extra bend of the thumb's two outer joints, 0 … 1: its tip hooked over an edge while the base stays put. */
  hook?: number;
  /** How much of their spread the fingers keep as they curl, 0 (they close up side by side) … 1 (spread round a ball). */
  splay?: number;
}

const pose = (thumb: number, index: number, middle: number, ring: number, pinky: number, spread = 0, oppose = 0.5): FingerPose => ({ thumb, index, middle, ring, pinky, spread, oppose });

/** Named hand shapes clips blend between. */
export const FINGERS = {
  /** Loose, slightly curled: a hand travelling between holds. */
  relaxed: pose(0.2, 0.22, 0.27, 0.32, 0.36, 0.15, 0.35),
  /** On the way back to the gun: cupped, fingers together. */
  reach: pose(0.2, 0.38, 0.42, 0.48, 0.52, 0.03, 0.35),
  open: pose(0.05, 0.05, 0.05, 0.08, 0.1, 0.5, 0.1),
  fist: pose(0.8, 1, 1, 1, 1, 0, 0.9),
  /** Firing hand: three fingers around the grip, index along the trigger. */
  trigger: pose(0.62, 0.3, 0.74, 0.7, 0.5, 0.3, 1),
  /** Support hand cupping a handguard or pump from below. */
  support: pose(0.42, 0.6, 0.6, 0.6, 0.58, 0.05, 1),
  /** Support hand wrapped over the firing hand on a pistol, thumb forward along the frame. */
  wrap: pose(0.08, 0.62, 0.64, 0.62, 0.55, 0, -0.85),
  /** Around a tool handle. */
  handle: pose(0.62, 0.69, 0.74, 0.71, 0.61, 0, 1),
  /** Around a magazine: fingers on one side, thumb on the other. */
  magazine: pose(0.3, 0.55, 0.58, 0.6, 0.62, 0, 0.9),
  /** Thumb and index holding something small (shell, pin ring, bolt knob). */
  pinch: pose(0.4, 0.55, 0.6, 0.8, 0.85, 0, 1),
  /** Index and middle hooked around something small, the thumb closed behind it, the rest of the hand a fist (charging handle, slide serrations). */
  hook: pose(0.66, 0.8, 0.82, 0.9, 0.92, 0, 1),
  /** Spread round a ball, the thumb along its top. */
  ball: { ...pose(0.2, 0.34, 0.45, 0.56, 0.68, 1.6, -0.2), splay: 1 },
  /** Flat hand slapping or pushing (mag seat, bolt release). */
  flat: pose(0.1, 0.02, 0.02, 0.04, 0.06, 0.05, 0.2)
} satisfies Record<string, FingerPose>;

export type FingerShape = keyof typeof FINGERS;

const ease = (t: number) => t * t * (3 - 2 * t);

export function mixFingers(a: FingerPose, b: FingerPose, t: number, out: FingerPose = { ...a }): FingerPose {
  out.thumb = a.thumb + (b.thumb - a.thumb) * t;
  out.index = a.index + (b.index - a.index) * t;
  out.middle = a.middle + (b.middle - a.middle) * t;
  out.ring = a.ring + (b.ring - a.ring) * t;
  out.pinky = a.pinky + (b.pinky - a.pinky) * t;
  out.spread = a.spread + (b.spread - a.spread) * t;
  out.oppose = a.oppose + (b.oppose - a.oppose) * t;
  const hook = a.hook ?? 0;
  out.hook = hook + ((b.hook ?? 0) - hook) * t;
  const splay = a.splay ?? 0;
  out.splay = splay + ((b.splay ?? 0) - splay) * t;
  return out;
}

/** Finger shape at u from timed shapes; eases between neighbours and holds the ends. */
export function fingers(u: number, keys: readonly (readonly [number, FingerShape | FingerPose])[]): FingerPose {
  const at = (i: number) => {
    const shape = keys[i]![1];
    return typeof shape === 'string' ? FINGERS[shape] : shape;
  };
  const n = keys.length;
  if (u <= keys[0]![0]) return at(0);
  if (u >= keys[n - 1]![0]) return at(n - 1);
  let i = 0;
  while (i < n - 2 && u > keys[i + 1]![0]) i++;
  const span = Math.max(1e-6, keys[i + 1]![0] - keys[i]![0]);
  return mixFingers(at(i), at(i + 1), ease((u - keys[i]![0]) / span));
}
