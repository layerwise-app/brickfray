import { WORLD_IMPULSE, makeImpulse } from './impulse';
import type { AudioMix } from './types';

const LIMIT = { threshold: -4, knee: 3, ratio: 20 };

/** Buses: effects (muffle low-pass, room reverb) / music / ui → master → limiter → output. */
export interface Mixer {
  master: GainNode;
  meter: AnalyserNode;
  /** Voices on the effects bus connect here; `reverb` is the shared room send. */
  effectsIn: GainNode;
  muffle: BiquadFilterNode;
  effects: GainNode;
  music: GainNode;
  ui: GainNode;
  reverb: ConvolverNode;
}

export function createMixer(ctx: AudioContext): Mixer {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMIT.threshold;
  limiter.knee.value = LIMIT.knee;
  limiter.ratio.value = LIMIT.ratio;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  // The compressor applies automatic makeup gain (spec: (1 / full-range gain)^0.6); undo it.
  const makeup = ctx.createGain();
  makeup.gain.value = 10 ** ((0.6 * LIMIT.threshold * (1 - 1 / LIMIT.ratio)) / 20);
  limiter.connect(makeup).connect(ctx.destination);
  const meter = ctx.createAnalyser();
  meter.fftSize = 2048;
  makeup.connect(meter);
  const master = ctx.createGain();
  master.connect(limiter);
  const effects = ctx.createGain();
  effects.connect(master);
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.Q.value = -3;
  muffle.frequency.value = 20000;
  muffle.connect(effects);
  const effectsIn = ctx.createGain();
  effectsIn.connect(muffle);
  const reverb = ctx.createConvolver();
  reverb.normalize = false;
  reverb.buffer = makeImpulse(ctx, { ...WORLD_IMPULSE, seed: 3 });
  reverb.connect(effectsIn);
  const music = ctx.createGain();
  music.connect(master);
  const ui = ctx.createGain();
  ui.connect(master);
  return { master, meter, effectsIn, muffle, effects, music, ui, reverb };
}

/** Smoothly applies bus levels; muffle darkens and dips the world (low health). */
export function applyMix(ctx: BaseAudioContext, m: Mixer, mix: AudioMix, muffle: number): void {
  const t = ctx.currentTime;
  m.master.gain.setTargetAtTime(mix.master, t, 0.02);
  m.effects.gain.setTargetAtTime(mix.effects * (1 - 0.3 * muffle), t, 0.05);
  m.music.gain.setTargetAtTime(mix.music, t, 0.05);
  m.ui.gain.setTargetAtTime(mix.ui, t, 0.02);
  m.muffle.frequency.setTargetAtTime(20000 * (450 / 20000) ** muffle, t, 0.08);
}

/** Output peak over the analyser window (~40 ms), after the limiter. */
export function outputPeak(m: Mixer): number {
  const data = new Float32Array(m.meter.fftSize);
  m.meter.getFloatTimeDomainData(data);
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  return peak;
}
