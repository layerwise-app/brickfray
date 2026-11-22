import type { MapId } from '../world/types';
import { mulberry32 } from './synth';

/** One recording in a map's bed (public/audio/ambience/bed-<file>.mp3) and its level. */
interface Layer {
  file: string;
  gain: number;
}

/**
 * Each map's bed, its recordings each played as their own random stretches. The main files are levelled to about
 * -22 LUFS (fortress -27, its wind dipped above 1.2 kHz; second layers -24): the gains put every map near -38 LUFS,
 * about 10 LU under the player's own footstep, with the second layer 10-16 dB under the first (fortress birds the
 * lowest: they sing where footsteps carry their detail).
 */
const BEDS: Record<MapId, readonly Layer[]> = {
  plaza: [{ file: 'plaza', gain: 0.16 }],
  fortress: [
    { file: 'fortress', gain: 0.27 },
    { file: 'fortress-birds', gain: 0.035 }
  ],
  docks: [{ file: 'docks', gain: 0.16 }],
  temple: [
    { file: 'temple', gain: 0.16 },
    { file: 'temple-water', gain: 0.07 }
  ]
};
const FADE_IN = 2.5;
const FADE_OUT = 1.2;
/** Encoder padding at both ends of a decoded file, never played. */
const TRIM = 0.06;
/** A stretch plays for this long, the last OVERLAP seconds under the start of the next one. */
const STRETCH = { min: 9, max: 15 };
const OVERLAP = 3;
/** Two stretches that overlap must not play nearly the same part of the recording (it would comb-filter). */
const APART = 1.5;
const CURVE_POINTS = 33;
const OUTSIDE = { gain: 1, cutoff: 20000 };
const ROOM_GLIDE = 0.12;
const RISE = Float32Array.from({ length: CURVE_POINTS }, (_, i) => Math.sin((i / (CURVE_POINTS - 1)) * (Math.PI / 2)));
const FALL = Float32Array.from(RISE).reverse();

export interface Stretch {
  /** Seconds after the bed started. */
  at: number;
  /** Where in the recording it begins. */
  offset: number;
  length: number;
}

interface Bed {
  layer: Layer;
  buffer: AudioBuffer;
  gain: GainNode;
  /** Context time the bed started. */
  t0: number;
  last: Stretch;
  sources: Set<AudioBufferSourceNode>;
}

/**
 * A map's ambience bed (BEDS), each recording fetched when the map is first entered. A recording is not looped end to
 * end: random stretches of it are cross-faded into each other, so a bird or a clink in it never comes round on a
 * fixed period, and the layers of a bed drift against each other.
 */
export class Ambience {
  private want: MapId | null = null;
  private playing: Bed[] = [];
  private readonly buffers = new Map<string, AudioBuffer>();
  /** Every bed plays through the walls of the room the listener is in: quieter and duller indoors. */
  private readonly input: GainNode;
  private readonly walls: BiquadFilterNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode
  ) {
    this.input = ctx.createGain();
    this.walls = ctx.createBiquadFilter();
    this.walls.type = 'lowpass';
    this.walls.Q.value = -3;
    this.walls.frequency.value = 20000;
    this.input.connect(this.walls).connect(out);
  }

  set(map: MapId | null): void {
    if (map === this.want) return;
    this.want = map;
    this.stop();
    if (!map) return;
    for (const layer of BEDS[map]) {
      const ready = this.buffers.get(layer.file);
      if (ready) this.start(layer, ready);
      else void this.load(map, layer);
    }
  }

  /** `inside` 0 outdoors .. 1 deep in a room whose walls leave the bed at `bed.gain` below `bed.cutoff` Hz. */
  setRoom(inside: number, bed: { gain: number; cutoff: number } = OUTSIDE): void {
    const t = this.ctx.currentTime;
    this.input.gain.setTargetAtTime(1 + (bed.gain - 1) * inside, t, ROOM_GLIDE);
    this.walls.frequency.setTargetAtTime(OUTSIDE.cutoff * (bed.cutoff / OUTSIDE.cutoff) ** inside, t, ROOM_GLIDE);
  }

  dispose(): void {
    this.want = null;
    this.stop();
    this.buffers.clear();
  }

  private async load(map: MapId, layer: Layer): Promise<void> {
    const file = `audio/ambience/bed-${layer.file}.mp3`;
    let buffer: AudioBuffer;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      const main = BEDS[map][0] === layer;
      console.error(main ? `Ambience ${map} falls back to generated wind` : `Ambience ${map} plays without ${layer.file}`, error);
      if (!main) return;
      buffer = wind(this.ctx);
    }
    this.buffers.set(layer.file, buffer);
    if (this.want === map && !this.playing.some((bed) => bed.layer === layer)) this.start(layer, buffer);
  }

  private start(layer: Layer, buffer: AudioBuffer): void {
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(layer.gain, now + FADE_IN);
    gain.connect(this.input);
    const first = nextStretch(buffer.duration, null, Math.random);
    const bed: Bed = { layer, buffer, gain, t0: now, last: first, sources: new Set() };
    this.playing.push(bed);
    this.play(bed, first);
    this.extend(bed);
  }

  /** Two stretches are always scheduled; each one that ends queues the one after the stretch then playing. */
  private extend(bed: Bed): void {
    bed.last = nextStretch(bed.buffer.duration, bed.last, Math.random);
    this.play(bed, bed.last);
  }

  private play(bed: Bed, stretch: Stretch): void {
    const source = this.ctx.createBufferSource();
    source.buffer = bed.buffer;
    const fade = this.ctx.createGain();
    shapeStretch(fade.gain, bed.t0 + stretch.at, stretch.length);
    source.connect(fade).connect(bed.gain);
    source.start(bed.t0 + stretch.at, stretch.offset, stretch.length);
    bed.sources.add(source);
    source.onended = () => {
      fade.disconnect();
      bed.sources.delete(source);
      if (this.playing.includes(bed)) this.extend(bed);
      else if (bed.sources.size === 0) bed.gain.disconnect();
    };
  }

  private stop(): void {
    const now = this.ctx.currentTime;
    for (const bed of this.playing) {
      bed.gain.gain.cancelScheduledValues(now);
      bed.gain.gain.setValueAtTime(bed.gain.gain.value, now);
      bed.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
      for (const source of bed.sources) source.stop(now + FADE_OUT + 0.1);
    }
    this.playing = [];
  }
}

/** The stretch after `previous`: it starts OVERLAP seconds before that one ends, somewhere else in the recording. */
export function nextStretch(duration: number, previous: Stretch | null, rng: () => number): Stretch {
  const usable = duration - 2 * TRIM;
  const length = Math.min(STRETCH.min + rng() * (STRETCH.max - STRETCH.min), usable);
  const at = previous ? previous.at + previous.length - OVERLAP : 0;
  const heard = previous ? previous.offset + previous.length - OVERLAP : Number.NEGATIVE_INFINITY;
  let offset = TRIM;
  for (let attempt = 0; attempt < 12; attempt++) {
    offset = TRIM + rng() * (usable - length);
    if (Math.abs(offset - heard) >= APART) break;
  }
  return { at, offset, length };
}

/** Equal-power fade over the first and last OVERLAP seconds of a stretch that starts at context time `start`. */
export function shapeStretch(gain: AudioParam, start: number, length: number): void {
  gain.setValueAtTime(0, 0);
  gain.setValueCurveAtTime(RISE, start, OVERLAP);
  gain.setValueCurveAtTime(FALL, start + length - OVERLAP, OVERLAP);
}

/** Slowly swelling low-passed noise. */
function wind(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.round(24 * ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const rng = mulberry32(71 + ch);
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      lp += (rng() * 2 - 1 - lp) * 0.04;
      data[i] = lp * (0.2 + 0.08 * Math.sin((2 * Math.PI * i * (ch + 1)) / length));
    }
  }
  return buffer;
}
