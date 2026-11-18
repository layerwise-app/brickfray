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
  /** Thumb swung across the palm to meet the fingers, 0 (out to the side) … 1. */
  oppose: number;
}

const pose = (thumb: number, index: number, middle: number, ring: number, pinky: number, spread = 0, oppose = 0.5): FingerPose => ({ thumb, index, middle, ring, pinky, spread, oppose });

/** Named hand shapes clips blend between. */
export const FINGERS = {
  /** Loose, slightly curled: a hand travelling between holds. */
  relaxed: pose(0.2, 0.22, 0.27, 0.32, 0.36, 0.15, 0.35),
  open: pose(0.05, 0.05, 0.05, 0.08, 0.1, 0.5, 0.1),
  fist: pose(0.8, 1, 1, 1, 1, 0, 0.9),
  /** Firing hand: three fingers around the grip, index along the trigger. */
  trigger: pose(0.62, 0.3, 0.74, 0.7, 0.5, 0.3, 1),
  /** Firing hand, trigger pulled. */
  squeeze: pose(0.62, 0.38, 0.74, 0.7, 0.5, 0.3, 1),
  /** Support hand cupping a handguard or pump from below. */
  support: pose(0.42, 0.6, 0.6, 0.6, 0.58, 0.05, 1),
  /** Support hand wrapped over the firing hand on a pistol. */
  wrap: pose(0.3, 0.62, 0.64, 0.62, 0.55, 0, 0.3),
  /** Around a tool handle. */
  handle: pose(0.62, 0.69, 0.74, 0.71, 0.61, 0, 1),
  /** Around a magazine: fingers on one side, thumb on the other. */
  magazine: pose(0.3, 0.55, 0.58, 0.6, 0.62, 0, 0.9),
  /** Thumb and index holding something small (shell, pin ring, bolt knob). */
  pinch: pose(0.4, 0.55, 0.6, 0.8, 0.85, 0, 1),
  /** Cupped around a ball. */
  ball: pose(0.6, 0.5, 0.5, 0.52, 0.58, 0.3, 1),
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
