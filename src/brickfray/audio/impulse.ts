import { mulberry32 } from './synth';

export interface ImpulseOptions {
  seconds: number;
  /** Seconds to -60 dB for the diffuse tail. */
  t60: number;
  /** Early reflections in seconds with gains (a small room). */
  early: readonly (readonly [number, number])[];
  /** Outdoor slap-back from a distant wall. */
  slap?: { time: number; gain: number };
  /** Tail brightness: low-pass cutoff in Hz at the start and the end. */
  bright: [number, number];
  gain: number;
  seed: number;
}

/** Generated stereo impulse response: early taps, optional slap, then a darkening noise tail. */
export function makeImpulse(ctx: BaseAudioContext, o: ImpulseOptions): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.ceil(o.seconds * sr);
  const buffer = ctx.createBuffer(2, length, sr);
  for (let ch = 0; ch < 2; ch++) {
    const rng = mulberry32(o.seed * 2 + ch);
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sr;
      const env = Math.exp((-6.9 * t) / o.t60) * Math.min(1, t / 0.006);
      const u = Math.min(1, t / o.seconds);
      const cutoff = o.bright[0] * (o.bright[1] / o.bright[0]) ** u;
      const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
      lp += ((rng() * 2 - 1) * env - lp) * k;
      data[i] = lp * 0.6;
    }
    const spread = ch === 0 ? 1 : 1.13;
    const put = (time: number, gain: number) => {
      const at = Math.round(time * sr);
      for (let j = 0; j < 4 && at + j < length; j++) data[at + j]! += gain * (1 - j * 0.3);
    };
    for (const [time, gain] of o.early) put(time * spread, gain * (rng() < 0.5 ? -1 : 1));
    if (o.slap) {
      put(o.slap.time * (ch === 0 ? 1 : 1.04), o.slap.gain);
      put(o.slap.time * 1.9, o.slap.gain * 0.35);
    }
    for (let i = 0; i < length; i++) data[i]! *= o.gain;
  }
  return buffer;
}

/** The game's shared space: small outdoor slap plus a short room. */
export const WORLD_IMPULSE: Omit<ImpulseOptions, 'seed'> = {
  seconds: 1.3,
  t60: 0.75,
  early: [
    [0.011, 0.45],
    [0.017, 0.35],
    [0.024, 0.3],
    [0.033, 0.24],
    [0.047, 0.18]
  ],
  slap: { time: 0.095, gain: 0.32 },
  bright: [7000, 1800],
  gain: 0.5
};

export const MUSIC_IMPULSE: Omit<ImpulseOptions, 'seed'> = {
  seconds: 2.2,
  t60: 1.6,
  early: [
    [0.013, 0.3],
    [0.021, 0.25],
    [0.034, 0.2]
  ],
  bright: [6000, 1500],
  gain: 0.4
};
