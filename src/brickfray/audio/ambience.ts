import type { MapId } from '../world/types';
import { mulberry32 } from './synth';

/** The bed files are levelled to about -22 LUFS; this puts them near -38, about 10 LU under the player's own footstep. */
const BED_GAIN = 0.16;
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
  buffer: AudioBuffer;
  gain: GainNode;
  /** Context time the bed started. */
  t0: number;
  last: Stretch;
  sources: Set<AudioBufferSourceNode>;
}

/**
 * A map's ambience bed (public/audio/ambience/bed-<map>.mp3), fetched when the map is first entered. The recording
 * is not looped end to end: random stretches of it are cross-faded into each other, so a bird or a clink in it
 * never comes round on a fixed period.
 */
export class Ambience {
  private want: MapId | null = null;
  private bed: Bed | null = null;
  private readonly beds = new Map<MapId, AudioBuffer>();
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
    const ready = this.beds.get(map);
    if (ready) this.start(ready);
    else void this.load(map);
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
    this.beds.clear();
  }

  private async load(map: MapId): Promise<void> {
    let bed: AudioBuffer;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/ambience/bed-${map}.mp3`);
      if (!response.ok) throw new Error(`audio/ambience/bed-${map}.mp3: HTTP ${response.status}`);
      bed = await this.ctx.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      console.error(`Ambience ${map} falls back to generated wind`, error);
      bed = wind(this.ctx);
    }
    this.beds.set(map, bed);
    if (this.want === map && !this.bed) this.start(bed);
  }

  private start(buffer: AudioBuffer): void {
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(BED_GAIN, now + FADE_IN);
    gain.connect(this.input);
    const first = nextStretch(buffer.duration, null, Math.random);
    const bed: Bed = { buffer, gain, t0: now, last: first, sources: new Set() };
    this.bed = bed;
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
      if (this.bed === bed) this.extend(bed);
      else if (bed.sources.size === 0) bed.gain.disconnect();
    };
  }

  private stop(): void {
    const bed = this.bed;
    if (!bed) return;
    this.bed = null;
    const now = this.ctx.currentTime;
    bed.gain.gain.cancelScheduledValues(now);
    bed.gain.gain.setValueAtTime(bed.gain.gain.value, now);
    bed.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    for (const source of bed.sources) source.stop(now + FADE_OUT + 0.1);
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
