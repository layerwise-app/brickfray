export type Rng = () => number;

/** One render slot inside an OfflineAudioContext: everything a recipe schedules is relative to `t0`. */
export interface Synth {
  readonly ctx: BaseAudioContext;
  readonly out: AudioNode;
  readonly t0: number;
  readonly noise: AudioBuffer;
  readonly rng: Rng;
}

export interface Env {
  /** Seconds to peak (linear). */
  attack?: number;
  hold?: number;
  /** Seconds from the end of the hold to -60 dB. */
  decay: number;
  gain: number;
}

/** `q` is linear for bandpass/peaking/notch and resonance in dB for lowpass/highpass (Web Audio semantics). */
export interface Filter {
  type: BiquadFilterType;
  freq: number;
  q?: number;
  gain?: number;
  /** Exponential frequency path as [seconds after start, Hz] points. */
  sweep?: readonly (readonly [number, number])[];
}

export interface Mode {
  f: number;
  decay: number;
  gain: number;
}

interface Routed {
  filter?: Filter | readonly Filter[];
  dest?: AudioNode;
}

export interface NoiseOpts extends Env, Routed {
  rate?: number;
}

export interface ToneOpts extends Env, Routed {
  type?: OscillatorType;
  freq: number;
  sweep?: readonly (readonly [number, number])[];
  detune?: number;
  /** Frequency modulation by a sine at freq × ratio; index decays to `floor` over `decay` seconds. */
  fm?: { ratio: number; index: number; decay: number; floor?: number };
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const rand = (s: Synth, min: number, max: number) => min + (max - min) * s.rng();
export const vary = (s: Synth, amount: number) => 1 + (s.rng() * 2 - 1) * amount;
export const pick = <T>(s: Synth, items: readonly T[]): T => items[Math.floor(s.rng() * items.length)]!;
export const midiHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

export function whiteNoise(ctx: BaseAudioContext, seconds: number, rng: Rng): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
  return buffer;
}

export function gainNode(s: Synth, gain: number, dest: AudioNode = s.out): GainNode {
  const g = s.ctx.createGain();
  g.gain.value = gain;
  g.connect(dest);
  return g;
}

function envelope(s: Synth, at: number, e: Env): { node: GainNode; end: number } {
  const g = s.ctx.createGain();
  const t = s.t0 + at;
  const a = Math.max(e.attack ?? 0.0006, 0.0002);
  const h = e.hold ?? 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(e.gain, t + a);
  if (h > 0) g.gain.setValueAtTime(e.gain, t + a + h);
  g.gain.setTargetAtTime(0, t + a + h, e.decay / 6.9);
  return { node: g, end: t + a + h + e.decay * 1.1 };
}

function rampPath(param: AudioParam, t: number, start: number, path?: readonly (readonly [number, number])[]) {
  param.setValueAtTime(start, t);
  for (const [dt, v] of path ?? []) param.exponentialRampToValueAtTime(Math.max(v, 1), t + Math.max(dt, 0.0005));
}

export function biquad(s: Synth, at: number, f: Filter): BiquadFilterNode {
  const n = s.ctx.createBiquadFilter();
  n.type = f.type;
  const resonant = f.type === 'lowpass' || f.type === 'highpass';
  n.Q.value = f.q ?? (resonant ? -3 : 1);
  if (f.gain !== undefined) n.gain.value = f.gain;
  const nyquist = s.ctx.sampleRate / 2 - 100;
  rampPath(
    n.frequency,
    s.t0 + at,
    Math.min(f.freq, nyquist),
    f.sweep?.map(([dt, v]) => [dt, Math.min(v, nyquist)] as const)
  );
  return n;
}

function route(s: Synth, at: number, src: AudioNode, o: Env & Routed): number {
  let node = src;
  const filters = o.filter === undefined ? [] : Array.isArray(o.filter) ? o.filter : [o.filter as Filter];
  for (const f of filters) {
    const b = biquad(s, at, f);
    node.connect(b);
    node = b;
  }
  const { node: g, end } = envelope(s, at, o);
  node.connect(g).connect(o.dest ?? s.out);
  return end;
}

export function noise(s: Synth, at: number, o: NoiseOpts): void {
  const src = s.ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  if (o.rate) src.playbackRate.value = o.rate;
  const end = route(s, at, src, o);
  src.start(s.t0 + at, rand(s, 0, s.noise.duration - 0.05));
  src.stop(end);
}

export function tone(s: Synth, at: number, o: ToneOpts): void {
  const osc = s.ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  const t = s.t0 + at;
  rampPath(osc.frequency, t, o.freq, o.sweep);
  if (o.detune) osc.detune.value = o.detune;
  const end = route(s, at, osc, o);
  if (o.fm) {
    const mod = s.ctx.createOscillator();
    mod.frequency.value = o.freq * o.fm.ratio;
    const depth = s.ctx.createGain();
    depth.gain.setValueAtTime(o.fm.index * o.freq, t);
    depth.gain.setTargetAtTime((o.fm.floor ?? 0) * o.freq, t + 0.001, o.fm.decay / 4.6);
    mod.connect(depth).connect(osc.frequency);
    mod.start(t);
    mod.stop(end);
  }
  osc.start(t);
  osc.stop(end);
}

/** Struck resonator: decaying sine partials. */
export function strike(s: Synth, at: number, modes: readonly Mode[], dest?: AudioNode, attack = 0.0006): void {
  for (const m of modes) tone(s, at, { freq: m.f, decay: m.decay, gain: m.gain, attack, dest });
}

/**
 * The game's toy-plastic signature: a hollow, short, mid-high clack built
 * from a tiny noise tick plus inharmonic plate-like modes.
 */
export function clack(
  s: Synth,
  at: number,
  o: { pitch: number; gain: number; decay?: number; bright?: number; dest?: AudioNode }
): void {
  const p = o.pitch * vary(s, 0.03);
  const d = o.decay ?? 0.05;
  const b = o.bright ?? 1;
  noise(s, at, {
    attack: 0.0002,
    decay: 0.008,
    gain: o.gain * 0.8,
    filter: { type: 'bandpass', freq: Math.min(p * 1.6, 9000), q: 0.9 },
    dest: o.dest
  });
  strike(
    s,
    at,
    [
      { f: p, decay: d, gain: o.gain * 0.45 },
      { f: p * 1.71 * vary(s, 0.02), decay: d * 0.7, gain: o.gain * 0.3 },
      { f: p * 2.62 * vary(s, 0.02), decay: d * 0.45, gain: o.gain * 0.18 * b },
      { f: p * 3.93 * vary(s, 0.02), decay: d * 0.3, gain: o.gain * 0.1 * b }
    ].filter((m) => m.f < s.ctx.sampleRate / 2 - 500),
    o.dest
  );
}

/** Low body thump with a pitch drop. */
export function thump(
  s: Synth,
  at: number,
  o: { from: number; to: number; glide: number; decay: number; gain: number; attack?: number; dest?: AudioNode }
): void {
  tone(s, at, {
    freq: o.from,
    sweep: [[o.glide, o.to]],
    decay: o.decay,
    gain: o.gain,
    attack: o.attack ?? 0.001,
    dest: o.dest
  });
}

/** Feedback echo; returns the input to send into. Output is wet only. */
export function echo(
  s: Synth,
  o: { delay: number; feedback: number; cutoff: number; wet?: number; dest?: AudioNode }
): GainNode {
  const input = s.ctx.createGain();
  const delay = s.ctx.createDelay(4);
  delay.delayTime.value = o.delay;
  const lp = s.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cutoff;
  lp.Q.value = -3;
  const fb = s.ctx.createGain();
  fb.gain.value = o.feedback;
  const wet = s.ctx.createGain();
  wet.gain.value = o.wet ?? 1;
  input.connect(delay).connect(lp);
  lp.connect(fb).connect(delay);
  lp.connect(wet).connect(o.dest ?? s.out);
  return input;
}

/** Discrete reflections (distant walls, terrain) each with its own darkening. */
export function taps(
  s: Synth,
  list: readonly { delay: number; gain: number; cutoff: number }[],
  dest: AudioNode = s.out
): GainNode {
  const input = s.ctx.createGain();
  for (const tap of list) {
    const d = s.ctx.createDelay(4);
    d.delayTime.value = tap.delay;
    const lp = s.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = tap.cutoff;
    lp.Q.value = -3;
    input.connect(d).connect(lp).connect(gainNode(s, tap.gain, dest));
  }
  return input;
}

/** Soft saturation (tanh) for punch; input above ±1 clamps smoothly. */
export function drive(s: Synth, amount: number, dest: AudioNode = s.out): WaveShaperNode {
  const ws = s.ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  const norm = Math.tanh(amount);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  ws.curve = curve;
  ws.oversample = '2x';
  ws.connect(dest);
  return ws;
}

/** Scattered short noise grains (rustle, grit, crackle). */
export function grains(
  s: Synth,
  at: number,
  o: { count: number; spread: number; gain: number; freq: number; q?: number; decay?: number; dest?: AudioNode; fade?: number }
): void {
  for (let i = 0; i < o.count; i++) {
    const u = s.rng();
    const t = at + o.spread * (o.fade ? u ** o.fade : u);
    const fall = o.fade ? 1 - 0.7 * (t - at) / Math.max(o.spread, 0.001) : 1;
    noise(s, t, {
      attack: 0.0004,
      decay: (o.decay ?? 0.012) * vary(s, 0.4),
      gain: o.gain * fall * rand(s, 0.4, 1),
      filter: { type: 'bandpass', freq: o.freq * vary(s, 0.35), q: o.q ?? 1.5 },
      dest: o.dest
    });
  }
}
