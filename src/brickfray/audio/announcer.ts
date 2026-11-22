import { loudness, peakOf } from './analysis';
import { busInput, dipUnderVoice, type Mixer } from './mixer';

/**
 * public/audio/announcer/<line>.mp3 for chains of 2, 3, 4, 5 and 6+ kills, one voice (CREDITS-announcer.md): "Double
 * kill", "Triple kill", "Quadra kill", "Penta kill", then a wordless brass sting for the top tier, whose banner the voice
 * has no word for.
 */
export const ANNOUNCER_LINES = ['chain-2', 'chain-3', 'chain-4', 'chain-5', 'chain-6'] as const;
const FIRST_CHAIN = 2;
/** Every line is matched to this loudness (analysis.ts, loudest 100 ms): over the kill marker, and over a fight the voice dips. */
export const ANNOUNCER_LOUDNESS = -14;
/** The voice follows the kill sound by this much, so the two never land on each other. */
export const ANNOUNCER_DELAY = 0.3;
/** Silence between a line and the one queued behind it. */
export const ANNOUNCER_GAP = 0.08;
const CEILING = 0.89;

interface Line {
  buffer: AudioBuffer;
  gain: number;
}

/** A line handed to the context: when it starts and ends (context time). */
export interface Slot {
  start: number;
  end: number;
}

/**
 * Where a new line goes, given the last one scheduled: a line not yet heard gives up its slot to the newer one (a fast
 * chain speaks only its highest count), a line already speaking is never cut and the newer one waits behind it.
 */
export function nextSlot(last: Slot | null, now: number): { start: number; replaces: boolean } {
  if (last && last.start > now) return { start: last.start, replaces: true };
  return { start: Math.max(now + ANNOUNCER_DELAY, last ? last.end + ANNOUNCER_GAP : 0), replaces: false };
}

/** The line for a chain of `count` kills (index into ANNOUNCER_LINES), or -1 below a double kill. */
export function lineFor(count: number): number {
  return count < FIRST_CHAIN ? -1 : Math.min(count - FIRST_CHAIN, ANNOUNCER_LINES.length - 1);
}

/**
 * The multi-kill voice. Lines are fetched when the first match starts (the menu's first load carries none), matched in
 * loudness, and played on the marker bus (they follow the Effects volume like the kill marker and are never muffled at
 * low health). While a line speaks the music sinks and the world and the player's own sounds dip (mixer.dipUnderVoice).
 */
export class Announcer {
  private readonly lines: (Line | null)[] = ANNOUNCER_LINES.map(() => null);
  private loading: Promise<void> | null = null;
  private last: (Slot & { source: AudioBufferSourceNode }) | null = null;
  /** What was asked for and what played, newest last (read by the capture tools); `replaced` lines were never heard. */
  readonly log: { count: number; line: string | null; at: number; duration: number; replaced?: boolean }[] = [];

  constructor(
    private readonly ctx: AudioContext,
    private readonly mixer: Mixer,
    private readonly duckMusic: (seconds: number) => void
  ) {}

  prefetch(): Promise<void> {
    this.loading ??= Promise.all(ANNOUNCER_LINES.map((name, i) => this.load(name, i))).then(() => undefined);
    return this.loading;
  }

  get loaded(): number {
    return this.lines.filter(Boolean).length;
  }

  say(count: number): void {
    const index = lineFor(count);
    if (index < 0) return;
    const line = this.lines[index];
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!line) {
      this.log.push({ count, line: null, at: now, duration: 0 });
      void this.prefetch();
      return;
    }
    const { start, replaces } = nextSlot(this.last, now);
    if (replaces && this.last) {
      this.last.source.stop();
      const entry = this.log.at(-1);
      if (entry) entry.replaced = true;
    }
    this.log.push({ count, line: ANNOUNCER_LINES[index], at: start, duration: line.buffer.duration });
    if (this.log.length > 50) this.log.shift();
    const source = ctx.createBufferSource();
    source.buffer = line.buffer;
    const amp = ctx.createGain();
    amp.gain.value = line.gain;
    source.connect(amp).connect(busInput(this.mixer, 'marker'));
    source.onended = () => amp.disconnect();
    source.start(start);
    const end = start + line.buffer.duration;
    this.last = { start, end, source };
    this.duckMusic(end - now);
    dipUnderVoice(ctx, this.mixer, start, line.buffer.duration);
  }

  private async load(name: string, index: number): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/announcer/${name}.mp3`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
      const data = buffer.getChannelData(0);
      const gain = Math.min(10 ** ((ANNOUNCER_LOUDNESS - loudness(data, buffer.sampleRate)) / 20), CEILING / Math.max(peakOf(data), 1e-6));
      this.lines[index] = { buffer, gain };
    } catch (error) {
      console.error(`Announcer line ${name} could not load`, error);
    }
  }
}
