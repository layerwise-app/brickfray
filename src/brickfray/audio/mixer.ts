import { nearSpace, neutralSpace } from './space';
import type { AudioMix } from './types';

/** A safety net: single events peak below the threshold and pass untouched; only stacked ones reach it. */
export const LIMIT = { threshold: -1.5, knee: 0, ratio: 20, attack: 0.002, release: 0.12 };

/** Lowest cutoff of the low-health muffle: the world dulls, speech-band detail survives. */
export const MUFFLE_FLOOR = 1000;
/**
 * At full muffle (1 HP) the world also dips by `dip` and the player's own gun, body and handling lose `dull` dB above
 * `shelf` Hz: darker but still crisp and on top. Hit and kill markers stay as they are.
 */
export const LOW_HEALTH = { dip: 0.5, dull: -7, shelf: 2500 };
const ROOM_FADE = 0.25;
/** While the announcer speaks, the world and the player's own sounds dip by `depth` (4 dB) so the voice reads over a fight. */
export const VOICE_DIP = { depth: 0.63, attack: 0.03, lead: 0.04, release: 0.25 };

export type Bus = 'effects' | 'feedback' | 'marker' | 'ui';

/**
 * Buses: effects (the world: muffle low-pass, map reverb) / feedback (the player's own body, weapon and handling:
 * never muffled, only dulled at low health) / marker (hit, kill: as they are) / music / ui → master → limiter → output. Reverb sends go to `reverb`, which
 * feeds the map's outdoor space and an indoor room, cross-faded by `setRoom`; the player's own sounds also send to
 * `near`, the close reflections that give them width before the reverb arrives.
 */
export interface Mixer {
  master: GainNode;
  meter: AnalyserNode;
  /** Voices on the effects bus connect here. */
  effectsIn: GainNode;
  muffle: BiquadFilterNode;
  effects: GainNode;
  feedback: GainNode;
  /** The feedback bus's input: the low-health shelf. */
  body: BiquadFilterNode;
  /** The world and the player's own sounds pass these: they dip under the announcer (`dipUnderVoice`). */
  dips: GainNode[];
  music: GainNode;
  ui: GainNode;
  /** Shared reverb send. */
  reverb: GainNode;
  /** The map's outdoor response. */
  space: ConvolverNode;
  /** The enclosed room the listener is in or nearest (keep, tower passage, arcade, warehouse); silent outside. */
  room: ConvolverNode;
  outdoor: GainNode;
  indoor: GainNode;
  near: ConvolverNode;
}

export function createMixer(ctx: BaseAudioContext): Mixer {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMIT.threshold;
  limiter.knee.value = LIMIT.knee;
  limiter.ratio.value = LIMIT.ratio;
  limiter.attack.value = LIMIT.attack;
  limiter.release.value = LIMIT.release;
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
  const worldDip = ctx.createGain();
  effects.connect(worldDip).connect(master);
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.Q.value = -3;
  muffle.frequency.value = 20000;
  muffle.connect(effects);
  const effectsIn = ctx.createGain();
  effectsIn.connect(muffle);
  const feedback = ctx.createGain();
  feedback.connect(master);
  const body = ctx.createBiquadFilter();
  body.type = 'highshelf';
  body.frequency.value = LOW_HEALTH.shelf;
  body.gain.value = 0;
  const ownDip = ctx.createGain();
  body.connect(ownDip).connect(feedback);
  const reverb = ctx.createGain();
  const space = ctx.createConvolver();
  space.normalize = false;
  space.buffer = neutralSpace(ctx);
  const room = ctx.createConvolver();
  room.normalize = false;
  const outdoor = ctx.createGain();
  const indoor = ctx.createGain();
  indoor.gain.value = 0;
  reverb.connect(outdoor).connect(space).connect(effectsIn);
  reverb.connect(indoor).connect(room).connect(effectsIn);
  const near = ctx.createConvolver();
  near.normalize = false;
  near.buffer = nearSpace(ctx);
  near.connect(body);
  const music = ctx.createGain();
  music.connect(master);
  const ui = ctx.createGain();
  ui.connect(master);
  return { master, meter, effectsIn, muffle, effects, feedback, body, dips: [worldDip, ownDip], music, ui, reverb, space, room, outdoor, indoor, near };
}

/** Where a voice of the given bus connects. */
export function busInput(m: Mixer, bus: Bus): AudioNode {
  return bus === 'ui' ? m.ui : bus === 'marker' ? m.feedback : bus === 'feedback' ? m.body : m.effectsIn;
}

/** Smoothly applies bus levels; muffle (low health) darkens and dips the world and dulls the player's own sounds. */
export function applyMix(ctx: BaseAudioContext, m: Mixer, mix: AudioMix, muffle: number): void {
  const t = ctx.currentTime;
  m.master.gain.setTargetAtTime(mix.master, t, 0.02);
  m.effects.gain.setTargetAtTime(mix.effects * (1 - LOW_HEALTH.dip * muffle), t, 0.05);
  m.feedback.gain.setTargetAtTime(mix.effects, t, 0.05);
  m.music.gain.setTargetAtTime(mix.music, t, 0.05);
  m.ui.gain.setTargetAtTime(mix.ui, t, 0.02);
  m.muffle.frequency.setTargetAtTime(muffleCutoff(muffle), t, 0.08);
  m.body.gain.setTargetAtTime(LOW_HEALTH.dull * Math.min(Math.max(muffle, 0), 1), t, 0.08);
}

export function muffleCutoff(muffle: number): number {
  return 20000 * (MUFFLE_FLOOR / 20000) ** Math.min(Math.max(muffle, 0), 1);
}

/** Cross-fades the reverb send from the outdoor space (0) into the room (1), which still hears `outdoor` of the outdoor response. */
export function setRoom(ctx: BaseAudioContext, m: Mixer, inside: number, outdoor = 0): void {
  const t = ctx.currentTime;
  const out = Math.cos((inside * Math.PI) / 2);
  m.outdoor.gain.setTargetAtTime(out + outdoor * (1 - out), t, ROOM_FADE / 3);
  m.indoor.gain.setTargetAtTime(Math.sin((inside * Math.PI) / 2), t, ROOM_FADE / 3);
}

/** Dips the world and the player's own sounds for a voice line from context time `at`, `seconds` long. */
export function dipUnderVoice(ctx: BaseAudioContext, m: Mixer, at: number, seconds: number): void {
  const now = ctx.currentTime;
  for (const dip of m.dips) {
    dip.gain.cancelScheduledValues(now);
    dip.gain.setTargetAtTime(VOICE_DIP.depth, Math.max(now, at - VOICE_DIP.lead), VOICE_DIP.attack);
    dip.gain.setTargetAtTime(1, at + seconds, VOICE_DIP.release / 3);
  }
}

/** Output peak over the analyser window (~40 ms), after the limiter. */
export function outputPeak(m: Mixer): number {
  const data = new Float32Array(m.meter.fftSize);
  m.meter.getFloatTimeDomainData(data);
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  return peak;
}
