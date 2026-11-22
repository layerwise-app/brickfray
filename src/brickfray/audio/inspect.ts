import { analyze, spectrum, type SoundStats } from './analysis';
import type { Category } from './catalog';
import { fetchTrack, TRACKS } from './music';
import { renderSound, yieldToMain } from './render';
import { SOUNDS, SOUND_IDS } from './sounds';
import type { MusicTrack, SoundId } from './types';

/** Dev-only: measure and plot rendered sounds (lab scene and headless checks). */

export interface VariantReport extends SoundStats {
  raw: number;
}

export interface SoundReport {
  id: string;
  category: Category | 'music';
  target: number;
  /** Render length; a trimmed clip this long was cut off. */
  limit: number;
  variants: VariantReport[];
}

export async function analyzeAll(sampleRate = 48000): Promise<SoundReport[]> {
  const out: SoundReport[] = [];
  for (const id of SOUND_IDS) {
    const r = await renderSound(id, sampleRate);
    out.push({
      id,
      category: SOUNDS[id].category,
      target: r.target,
      limit: SOUNDS[id].duration,
      variants: r.buffers.map((b, i) => ({ ...analyze(b.getChannelData(0), sampleRate), raw: r.raw[i]! }))
    });
    await yieldToMain();
  }
  return out;
}

async function loadTrack(track: MusicTrack, sampleRate: number): Promise<AudioBuffer> {
  return fetchTrack(new OfflineAudioContext(2, 1, sampleRate), track);
}

/** `raw` holds the largest sample jump across the loop seam. */
export async function analyzeMusic(track: MusicTrack, sampleRate = 48000): Promise<SoundReport> {
  const buffer = await loadTrack(track, sampleRate);
  const mid = mixDown(buffer);
  const stats = analyze(mid, sampleRate);
  const [a, b] = TRACKS[track].loop.map((t) => Math.round(t * sampleRate));
  let seam = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    seam = Math.max(seam, Math.abs(data[a!]! - data[b! - 1]!));
  }
  return { id: `music:${track}`, category: 'music', target: NaN, limit: Infinity, variants: [{ ...stats, raw: seam }] };
}

export function mixDown(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const l = buffer.getChannelData(0);
  const r = buffer.getChannelData(1);
  const mid = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) mid[i] = (l[i]! + r[i]!) * 0.5;
  return mid;
}

const W = 1200;
const LEFT = 90;
const WAVE_H = 70;
const SPEC_H = 140;
const ROW_GAP = 18;
const F_MIN = 40;
const F_MAX = 20000;

function heat(v: number): string {
  const x = Math.min(Math.max(v, 0), 1);
  const r = Math.round(255 * Math.min(1, x * 1.6));
  const g = Math.round(255 * Math.max(0, x * 1.4 - 0.4));
  const b = Math.round(255 * (x < 0.4 ? x * 1.5 : Math.max(0, 0.6 - (x - 0.4) * 1.2) + Math.max(0, x - 0.85) * 4));
  return `rgb(${r},${g},${b})`;
}

/** Waveform + log-frequency spectrogram per clip, stacked; returns a PNG data URL. */
export function plotClips(title: string, clips: readonly { label: string; data: Float32Array; seconds?: number }[], sampleRate: number): string {
  const rowH = WAVE_H + SPEC_H + ROW_GAP;
  const canvas = document.createElement('canvas');
  canvas.width = LEFT + W + 20;
  canvas.height = 40 + clips.length * rowH + 8;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#101418';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#e8eef2';
  g.font = '600 16px system-ui, sans-serif';
  g.fillText(title, 12, 26);
  const longest = Math.max(...clips.map((c) => c.data.length / sampleRate));
  const size = 2048;
  clips.forEach((clip, row) => {
    const span = clip.seconds ?? longest;
    const y0 = 40 + row * rowH;
    g.fillStyle = '#9fb0bc';
    g.font = '12px system-ui, sans-serif';
    g.fillText(clip.label, 8, y0 + 16);
    g.fillStyle = '#182028';
    g.fillRect(LEFT, y0, W, WAVE_H);
    g.strokeStyle = '#3a4a56';
    g.beginPath();
    g.moveTo(LEFT, y0 + WAVE_H / 2);
    g.lineTo(LEFT + W, y0 + WAVE_H / 2);
    g.stroke();
    g.fillStyle = '#5fd0ff';
    const perPx = (span * sampleRate) / W;
    for (let x = 0; x < W; x++) {
      const a = Math.floor(x * perPx);
      const b = Math.min(clip.data.length, Math.floor((x + 1) * perPx));
      if (a >= clip.data.length) break;
      let lo = 0;
      let hi = 0;
      for (let i = a; i < b; i++) {
        const v = clip.data[i]!;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      g.fillRect(LEFT + x, y0 + WAVE_H / 2 - hi * (WAVE_H / 2), 1, Math.max(1, (hi - lo) * (WAVE_H / 2)));
    }
    const sy = y0 + WAVE_H + 4;
    const step = 2;
    for (let x = 0; x < W; x += step) {
      const start = Math.floor(x * perPx) - size / 2;
      if (start > clip.data.length) break;
      const mag = spectrum(clip.data, Math.max(0, start), size);
      for (let py = 0; py < SPEC_H; py += 2) {
        const f = F_MIN * (F_MAX / F_MIN) ** (1 - py / SPEC_H);
        const bin = Math.min(mag.length - 1, Math.round((f * size) / sampleRate));
        const dbv = 20 * Math.log10(mag[bin]! / (size / 4) + 1e-9);
        g.fillStyle = heat((dbv + 90) / 90);
        g.fillRect(LEFT + x, sy + py, step, 2);
      }
    }
    g.fillStyle = '#6c7d89';
    for (const f of [100, 1000, 10000]) {
      const py = SPEC_H * (1 - Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN));
      g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, LEFT - 30, sy + py + 4);
    }
    const tick = span > 10 ? 5 : span > 4 ? 1 : span > 1.5 ? 0.25 : 0.1;
    for (let t = 0; t <= span + 1e-6; t += tick) {
      g.fillText(`${+t.toFixed(2)}s`, LEFT + (t / span) * W - 8, sy + SPEC_H + 13);
    }
  });
  return canvas.toDataURL('image/png');
}

export async function plotSound(id: SoundId, sampleRate = 48000): Promise<string> {
  const r = await renderSound(id, sampleRate);
  return plotClips(
    `${id}  (${r.buffers.length} variants, normalized to ${r.target} LUFS-M100)`,
    r.buffers.map((b, i) => ({ label: `variant ${i + 1}`, data: b.getChannelData(0) })),
    sampleRate
  );
}

export async function plotMusic(track: MusicTrack, sampleRate = 48000): Promise<string> {
  const buffer = await loadTrack(track, sampleRate);
  const mid = mixDown(buffer);
  const secs = buffer.duration;
  const head = mid.subarray(0, Math.round(Math.min(8, secs) * sampleRate));
  return plotClips(
    `music:${track}  (${secs.toFixed(1)} s, loop ${TRACKS[track].loop.join('-')} s)`,
    [
      { label: 'full loop', data: mid },
      { label: 'first 8 s', data: head, seconds: 8 }
    ],
    sampleRate
  );
}
