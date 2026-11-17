import { audibleLength, loudness, peakOf } from './analysis';
import { CATEGORIES, DEFAULT_VARIANTS } from './catalog';
import { SONGS, renderMusic } from './music';
import { SOUNDS, SOUND_IDS } from './sounds';
import { hashString, mulberry32, whiteNoise } from './synth';
import type { MusicTrack, SoundId } from './types';

export interface RenderedSound {
  buffers: AudioBuffer[];
  /** Loudness of each variant before normalization (silence/NaN shows up here). */
  raw: number[];
  target: number;
}

export type RenderJob = { kind: 'sound'; id: SoundId } | { kind: 'music'; track: MusicTrack };

export interface BankOptions {
  sampleRate: number;
  onSound(id: SoundId, sound: RenderedSound): void;
  onMusic(track: MusicTrack, buffer: AudioBuffer): void;
  cancelled(): boolean;
  /** Parallel offline renders in flight. */
  concurrency?: number;
}

const GAP = 0.05;
const CEILING = 0.89;
/** Most gain (relative to the ceiling) a transient may be pushed into the soft limiter. */
const MAX_DRIVE = 2.2;
const FIRST: readonly SoundId[] = ['uiClick', 'uiHover', 'uiBack'];

/** UI first so menus click right away, then menu music, gameplay sounds, and in-match music last. */
export const RENDER_ORDER: readonly RenderJob[] = [
  ...FIRST.map((id) => ({ kind: 'sound', id }) as const),
  { kind: 'music', track: 'menu' },
  ...SOUND_IDS.filter((id) => !FIRST.includes(id))
    .sort((a, b) => CATEGORIES[SOUNDS[b].category].priority - CATEGORIES[SOUNDS[a].category].priority)
    .map((id) => ({ kind: 'sound', id }) as const),
  { kind: 'music', track: 'match' }
];

/** Yields to the event loop without timer clamping (keeps working in background tabs). */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
}

/** Tanh knee above 55% of the ceiling; output never exceeds the ceiling. */
function softLimit(data: Float32Array): void {
  const knee = CEILING * 0.55;
  const range = CEILING - knee;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]!);
    if (a > knee) data[i] = Math.sign(data[i]!) * (knee + range * Math.tanh((a - knee) / range));
  }
}

/** Scales to the loudness target; transients that would exceed the ceiling are soft-limited. */
function normalize(src: Float32Array<ArrayBuffer>, sr: number, target: number): { out: Float32Array<ArrayBuffer>; raw: number } {
  const raw = loudness(src, sr);
  const peak = Math.max(peakOf(src), 1e-9);
  let gain = 10 ** ((target - raw) / 20);
  let out = src;
  for (let pass = 0; pass < 3; pass++) {
    gain = Math.min(gain, (CEILING * MAX_DRIVE) / peak);
    const g = gain;
    out = src.map((x) => x * g);
    if (peak * g > CEILING) softLimit(out);
    const level = loudness(out, sr);
    if (Math.abs(level - target) < 0.25 || peak * g >= CEILING * MAX_DRIVE * 0.999) break;
    gain *= 10 ** ((target - level) / 20);
  }
  return { out, raw };
}

/** Renders every variant of one sound in a single offline pass, one slot per variant. */
export async function renderSound(id: SoundId, sampleRate: number): Promise<RenderedSound> {
  const spec = SOUNDS[id];
  const variants = spec.variants ?? DEFAULT_VARIANTS;
  const slot = spec.duration + GAP;
  const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: Math.ceil(slot * variants * sampleRate), sampleRate });
  const seed = hashString(id);
  const noise = whiteNoise(ctx, 2, mulberry32(seed ^ 0x9e3779b9));
  for (let v = 0; v < variants; v++) {
    const t0 = v * slot;
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(1, t0);
    gate.gain.setValueAtTime(1, t0 + spec.duration - 0.012);
    gate.gain.linearRampToValueAtTime(0, t0 + spec.duration);
    gate.connect(ctx.destination);
    spec.render({ ctx, out: gate, t0, noise, rng: mulberry32(seed + v * 7919) }, v);
  }
  const rendered = (await ctx.startRendering()).getChannelData(0);
  const target = spec.loudness ?? CATEGORIES[spec.category].loudness;
  const fade = Math.round(0.008 * sampleRate);
  const raw: number[] = [];
  const buffers = Array.from({ length: variants }, (_, v) => {
    const start = Math.round(v * slot * sampleRate);
    const full = rendered.subarray(start, start + Math.round(spec.duration * sampleRate));
    const clip = full.slice(0, Math.max(Math.min(full.length, audibleLength(full) + fade), 64));
    for (let i = 0; i < fade && i < clip.length; i++) clip[clip.length - 1 - i]! *= i / fade;
    const n = normalize(clip, sampleRate, target);
    raw.push(n.raw);
    const buffer = new AudioBuffer({ numberOfChannels: 1, length: clip.length, sampleRate });
    buffer.copyToChannel(n.out, 0);
    return buffer;
  });
  return { buffers, raw, target };
}

export async function renderTrack(track: MusicTrack, sampleRate: number): Promise<AudioBuffer> {
  const buffer = await renderMusic(track, sampleRate, yieldToMain);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mid = new Float32Array(left.length);
  for (let i = 0; i < mid.length; i++) mid[i] = (left[i]! + right[i]!) * 0.5;
  await yieldToMain();
  const raw = loudness(mid, sampleRate);
  let gain = 10 ** ((SONGS[track].loudness - raw) / 20);
  const peak = Math.max(peakOf(left), peakOf(right));
  if (peak * gain > CEILING) gain = CEILING / peak;
  await yieldToMain();
  for (const ch of [left, right]) for (let i = 0; i < ch.length; i++) ch[i]! *= gain;
  return buffer;
}

/** Renders the whole bank a few jobs at a time, yielding between jobs so frames keep flowing. */
export async function renderBank(o: BankOptions, jobs: readonly RenderJob[] = RENDER_ORDER): Promise<void> {
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job && !o.cancelled(); job = queue.shift()) {
      await yieldToMain();
      if (job.kind === 'sound') o.onSound(job.id, await renderSound(job.id, o.sampleRate));
      else o.onMusic(job.track, await renderTrack(job.track, o.sampleRate));
    }
  };
  await Promise.all(Array.from({ length: o.concurrency ?? 3 }, worker));
}
