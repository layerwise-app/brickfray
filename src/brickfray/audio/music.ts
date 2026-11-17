import type { MusicTrack } from './types';
import { MUSIC_IMPULSE, makeImpulse } from './impulse';
import { block, clap, crash, epiano, glock, hat, kick, marimba, pad, pluckBass, shaker } from './recipes/instruments';
import { hashString, midiHz as hz, mulberry32, whiteNoise, type Synth } from './synth';

type Part = 'drums' | 'bass' | 'keys' | 'lead' | 'bell' | 'pad';

interface Band {
  /** Seconds at bar + eighth (fractional eighths allowed), swing applied. */
  at(bar: number, eighth: number): number;
  /** Seconds per eighth note. */
  e: number;
  bar: number;
  part: Record<Part, Synth>;
}

interface Song {
  bpm: number;
  bars: number;
  swing: number;
  /** Target loudness after rendering. */
  loudness: number;
  mix: Record<Part, { gain: number; pan: number; send: number }>;
  arrange(b: Band, bar: number): void;
}

const TAIL = 3;

/** [bass root, keys voicing] per bar. */
const MENU_CHORDS: readonly (readonly [number, readonly number[]])[] = [
  [41, [60, 65, 69]],
  [45, [60, 64, 67]],
  [46, [62, 65, 69]],
  [48, [60, 64, 67]],
  [41, [60, 65, 69]],
  [38, [60, 65, 69]],
  [43, [62, 65, 70]],
  [48, [58, 64, 67]],
  [46, [62, 65, 70]],
  [48, [60, 64, 67]],
  [45, [60, 64, 67]],
  [38, [60, 65, 69]],
  [43, [62, 65, 70]],
  [48, [60, 64, 67]],
  [41, [60, 65, 69]],
  [48, [58, 64, 67]]
];

/** Marimba line per bar: [eighth, midi, length in eighths]. */
const MENU_MELODY: readonly (readonly (readonly [number, number, number])[])[] = [
  [[0, 72, 1], [1, 77, 1], [2, 81, 2], [4, 79, 1], [5, 77, 1], [6, 72, 2]],
  [[0, 76, 2], [2, 72, 1], [3, 69, 1], [4, 72, 4]],
  [[0, 74, 1], [1, 77, 1], [2, 81, 2], [4, 82, 1], [5, 81, 1], [6, 77, 2]],
  [[0, 79, 3], [3, 76, 1], [4, 72, 2], [6, 74, 1], [7, 76, 1]],
  [[0, 72, 1], [1, 74, 1], [2, 77, 2], [4, 76, 1], [5, 74, 1], [6, 72, 2]],
  [[0, 74, 3], [3, 72, 1], [4, 69, 2], [6, 72, 2]],
  [[0, 70, 1], [1, 72, 1], [2, 74, 2], [4, 77, 1], [5, 76, 1], [6, 74, 2]],
  [[0, 72, 4], [4, 70, 1], [5, 67, 1], [6, 64, 2]],
  [[0, 74, 1], [1, 77, 1], [2, 81, 2], [4, 79, 1], [5, 77, 1], [6, 74, 2]],
  [[0, 76, 2], [2, 79, 2], [4, 76, 1], [5, 74, 1], [6, 72, 2]],
  [[0, 72, 1], [1, 76, 1], [2, 79, 2], [4, 81, 2], [6, 79, 1], [7, 76, 1]],
  [[0, 77, 3], [3, 74, 1], [4, 72, 2], [6, 69, 2]],
  [[0, 70, 1], [1, 74, 1], [2, 77, 1], [3, 79, 1], [4, 82, 2], [6, 81, 1], [7, 79, 1]],
  [[0, 79, 2], [2, 76, 1], [3, 72, 1], [4, 79, 4]],
  [[0, 77, 1], [1, 81, 1], [2, 84, 2], [4, 81, 1], [5, 77, 1], [6, 79, 1], [7, 81, 1]],
  [[0, 79, 3], [3, 76, 1], [4, 72, 1], [5, 70, 1], [6, 67, 2]]
];

const menu: Song = {
  bpm: 116,
  bars: 16,
  swing: 0.56,
  loudness: -16,
  mix: {
    drums: { gain: 0.8, pan: 0, send: 0.1 },
    bass: { gain: 0.85, pan: 0, send: 0.02 },
    keys: { gain: 0.5, pan: -0.28, send: 0.28 },
    lead: { gain: 0.75, pan: 0.22, send: 0.32 },
    bell: { gain: 0.45, pan: 0.4, send: 0.45 },
    pad: { gain: 0, pan: 0, send: 0 }
  },
  arrange(b, bar) {
    const { drums: d, bass, keys, lead, bell } = b.part;
    const [root, voicing] = MENU_CHORDS[bar]!;
    const next = MENU_CHORDS[(bar + 1) % MENU_CHORDS.length]![0];
    kick(d, b.at(bar, 0), 0.9);
    kick(d, b.at(bar, 4), 0.8);
    if (bar % 2 === 1) kick(d, b.at(bar, 5), 0.45);
    clap(d, b.at(bar, 2), 0.5);
    clap(d, b.at(bar, 6), 0.55);
    for (let e = 0; e < 8; e++) {
      if (e === 7 && bar % 4 === 3) hat(d, b.at(bar, e), 0.16, true);
      else hat(d, b.at(bar, e), e % 2 ? 0.2 : 0.11, false);
      shaker(d, b.at(bar, e + 0.5), 0.05);
    }
    block(d, b.at(bar, 3), 1700, 0.16);
    block(d, b.at(bar, 7), 2300, bar % 2 ? 0.14 : 0.08);
    if (bar % 8 === 0) crash(d, b.at(bar, 0), 0.1);

    const approach = next - 1 < root - 7 ? next + 11 : next - 1;
    pluckBass(bass, b.at(bar, 0), hz(root), 1.5 * b.e, 0.9);
    pluckBass(bass, b.at(bar, 3), hz(root), 0.5 * b.e, 0.55);
    pluckBass(bass, b.at(bar, 4), hz(root + 7), b.e, 0.75);
    pluckBass(bass, b.at(bar, 6), hz(root + 12), 0.5 * b.e, 0.55);
    pluckBass(bass, b.at(bar, 7), hz(approach), 0.5 * b.e, 0.5);

    for (const n of voicing) {
      epiano(keys, b.at(bar, 0), hz(n), 2 * b.e, 0.32);
      epiano(keys, b.at(bar, 3), hz(n), 0.5 * b.e, 0.2);
      epiano(keys, b.at(bar, 5), hz(n), b.e, 0.26);
    }
    for (const [e, n] of MENU_MELODY[bar]!) {
      const t = b.at(bar, e);
      marimba(lead, t, hz(n), bar < 4 ? 0.55 : 0.75);
      if (bar >= 8) glock(bell, t, hz(n + 12), 0.14);
    }
    if (bar < 8 && bar % 2 === 0) glock(bell, b.at(bar, 0), hz(voicing[voicing.length - 1]! + 12), 0.25);
  }
};

const MATCH_CHORDS: readonly (readonly [number, readonly number[]])[] = [
  [38, [53, 57, 60, 64]],
  [38, [53, 57, 60, 64]],
  [46, [53, 57, 62, 65]],
  [46, [53, 57, 62, 65]],
  [43, [53, 57, 58, 62]],
  [43, [53, 57, 58, 62]],
  [45, [55, 57, 62, 64]],
  [45, [55, 57, 61, 64]]
];

const MATCH_MOTIF: Record<number, readonly (readonly [number, number])[]> = {
  1: [[2, 74], [3, 72], [4, 69]],
  3: [[2, 72], [3, 69], [4, 65]],
  5: [[2, 70], [3, 69], [4, 67]],
  7: [[2, 69], [3, 67], [4, 64], [6, 61]]
};

const match: Song = {
  bpm: 84,
  bars: 8,
  swing: 0.5,
  loudness: -21,
  mix: {
    drums: { gain: 0.5, pan: 0, send: 0.15 },
    bass: { gain: 0.6, pan: 0, send: 0.05 },
    keys: { gain: 0, pan: 0, send: 0 },
    lead: { gain: 0.45, pan: 0.25, send: 0.5 },
    bell: { gain: 0.3, pan: -0.3, send: 0.6 },
    pad: { gain: 0.9, pan: 0, send: 0.4 }
  },
  arrange(b, bar) {
    const { drums: d, bass, lead, bell, pad: p } = b.part;
    const [root, notes] = MATCH_CHORDS[bar]!;
    const split = bar >= 6;
    if (split || bar % 2 === 0) pad(p, b.at(bar, 0), notes.map(hz), (split ? 1 : 2) * b.bar, 0.8);
    kick(d, b.at(bar, 0), 0.4);
    if (bar % 2) kick(d, b.at(bar, 5), 0.25);
    for (const e of [2, 6]) hat(d, b.at(bar, e), 0.06, false);
    for (let e = 1; e < 8; e += 2) shaker(d, b.at(bar, e), 0.035);
    for (let e = 0; e < 8; e++) pluckBass(bass, b.at(bar, e), hz(root), 0.4 * b.e, e % 2 ? 0.35 : 0.5);
    for (const [e, n] of MATCH_MOTIF[bar] ?? []) {
      marimba(lead, b.at(bar, e), hz(n), 0.5);
      glock(bell, b.at(bar, e + 3), hz(n + 12), 0.12);
    }
  }
};

export const SONGS: Record<MusicTrack, Song> = { menu, match };

export function songLength(track: MusicTrack): number {
  const s = SONGS[track];
  return (s.bars * 4 * 60) / s.bpm;
}

/**
 * Renders a seamless loop: the tail past the loop end is folded back onto
 * the start so reverb and ringing notes carry across the seam.
 */
export async function renderMusic(track: MusicTrack, sampleRate: number, pause: () => Promise<void>): Promise<AudioBuffer> {
  const song = SONGS[track];
  const beat = 60 / song.bpm;
  const loop = songLength(track);
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil((loop + TAIL) * sampleRate), sampleRate });
  const rng = mulberry32(hashString(`music:${track}`));
  const noise = whiteNoise(ctx, 2, rng);
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 10;
  glue.ratio.value = 2.5;
  glue.attack.value = 0.01;
  glue.release.value = 0.25;
  glue.connect(ctx.destination);
  const master = ctx.createGain();
  master.connect(glue);
  const reverb = ctx.createConvolver();
  reverb.normalize = false;
  reverb.buffer = makeImpulse(ctx, { ...MUSIC_IMPULSE, seed: 11 });
  reverb.connect(master);
  const part = {} as Record<Part, Synth>;
  for (const name of Object.keys(song.mix) as Part[]) {
    const m = song.mix[name];
    const g = ctx.createGain();
    g.gain.value = m.gain;
    const pan = ctx.createStereoPanner();
    pan.pan.value = m.pan;
    g.connect(pan).connect(master);
    const send = ctx.createGain();
    send.gain.value = m.send;
    g.connect(send).connect(reverb);
    part[name] = { ctx, out: g, t0: 0, noise, rng };
  }
  const band: Band = {
    e: beat / 2,
    bar: beat * 4,
    at: (bar, eighth) => {
      const beatIndex = Math.floor(eighth / 2);
      const within = eighth - beatIndex * 2;
      const pos = within < 1 ? within * song.swing : song.swing + (within - 1) * (1 - song.swing);
      return (bar * 4 + beatIndex + pos) * beat;
    },
    part
  };
  for (let bar = 0; bar < song.bars; bar++) {
    song.arrange(band, bar);
    await pause();
  }
  const rendered = await ctx.startRendering();
  const n = Math.round(loop * sampleRate);
  const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate });
  for (let ch = 0; ch < 2; ch++) {
    const src = rendered.getChannelData(ch);
    const dst = new Float32Array(n);
    dst.set(src.subarray(0, n));
    for (let i = n; i < src.length; i++) dst[(i - n) % n]! += src[i]!;
    out.copyToChannel(dst, ch);
  }
  return out;
}
