import { FALLOFF } from './catalog';

interface Vec {
  x: number;
  y: number;
  z: number;
}

/**
 * A positional sound estimated at the listener (its loudness target after distance and occlusion, LUFS-like) plays in
 * full above `full` and fades out down to `gone`, so a distant step thins away under the map's bed (~-38) instead of
 * cutting off at one distance; below `gone` it is not started and holds no voice.
 */
export const AUDIBLE = { full: -48, gone: -60 };
/** A fully occluded source: low-pass cutoff in Hz and gain. */
export const OCCLUDED = { cutoff: 1400, gain: 0.5 };
/** Air absorption stand-in: the distance low-pass is at half of `top` at `half` metres (8 kHz at 50 m, 5 kHz at 100 m). */
const AIR = { top: 20000, half: 35 };
/** Low-pass cutoff at `tone` 0 (a soft knock); `tone` 1 leaves the sound as recorded. */
const DULL = 1200;
/** The head's shadow: a source straight behind loses `gain` dB above `shelf` Hz, one to the side nothing. */
export const REAR = { shelf: 3500, gain: -4 };

/** Gain for a sound estimated `estimate` at the listener: 1 down to `AUDIBLE.full`, easing to 0 at `AUDIBLE.gone`. */
export function audibility(estimate: number): number {
  const s = Math.min(Math.max((estimate - AUDIBLE.gone) / (AUDIBLE.full - AUDIBLE.gone), 0), 1);
  return s * s * (3 - 2 * s);
}

/** How far behind the listener a source is: 0 ahead or to the side, 1 straight behind. */
export function behind(listener: Vec, forward: Vec, pos: Vec): number {
  const dx = pos.x - listener.x;
  const dy = pos.y - listener.y;
  const dz = pos.z - listener.z;
  const norm = Math.hypot(dx, dy, dz) * Math.hypot(forward.x, forward.y, forward.z);
  return norm > 1e-6 ? Math.max(0, -(dx * forward.x + dy * forward.y + dz * forward.z) / norm) : 0;
}

export interface Placement {
  pos: Vec;
  distance: number;
  /** Solid world between source and listener, 0…1. */
  occlusion: number;
  /** Brightness, 0 (a dull knock) … 1 (as recorded). */
  tone: number;
  /** `behind()` of the source. */
  rear: number;
  falloff: keyof typeof FALLOFF;
}

/** The filters and panner a positional voice plays through after `input`; the last node is its output. */
export function place(ctx: BaseAudioContext, input: AudioNode, p: Placement): AudioNode[] {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = -3;
  lp.frequency.value = Math.min(AIR.top / (1 + p.distance / AIR.half), 20000 * (OCCLUDED.cutoff / 20000) ** p.occlusion, 20000 * (DULL / 20000) ** (1 - p.tone));
  const shadow = ctx.createBiquadFilter();
  shadow.type = 'highshelf';
  shadow.frequency.value = REAR.shelf;
  shadow.gain.value = REAR.gain * p.rear;
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = FALLOFF[p.falloff].ref;
  panner.rolloffFactor = FALLOFF[p.falloff].rolloff;
  panner.maxDistance = 10000;
  if (panner.positionX) {
    panner.positionX.value = p.pos.x;
    panner.positionY.value = p.pos.y;
    panner.positionZ.value = p.pos.z;
  } else {
    panner.setPosition(p.pos.x, p.pos.y, p.pos.z);
  }
  input.connect(lp).connect(shadow).connect(panner);
  return [lp, shadow, panner];
}
