import { loudness, peakOf } from './analysis';

/** public/audio/announcer/<line>.mp3 for chains of 2, 3, 4, 5 and 6+ kills: one voice (CREDITS-announcer.md). */
export const ANNOUNCER_LINES = ['chain-2', 'chain-3', 'chain-4', 'chain-5', 'chain-6'] as const;
const FIRST_CHAIN = 2;
/** Every line is matched to this loudness (analysis.ts, loudest 100 ms): a step over the kill marker, so the voice reads over a fight. */
export const ANNOUNCER_LOUDNESS = -17;
/** The voice follows the kill sound by this much, so the two never land on each other. */
export const ANNOUNCER_DELAY = 0.3;
const CEILING = 0.89;
/** A newer chain cuts the line still playing over this long. */
const CUT = 0.06;

interface Line {
  buffer: AudioBuffer;
  gain: number;
}

/** The line for a chain of `count` kills (index into ANNOUNCER_LINES), or -1 below a double kill. */
export function lineFor(count: number): number {
  return count < FIRST_CHAIN ? -1 : Math.min(count - FIRST_CHAIN, ANNOUNCER_LINES.length - 1);
}

/**
 * The multi-kill voice. Lines are fetched when the first match starts (the menu's first load carries none), matched in
 * loudness, and played on the bus they are given (the feedback bus: they follow the Effects volume like the kill
 * marker and are never muffled at low health). A newer line cuts the one still playing; the music sinks under each.
 */
export class Announcer {
  private readonly lines: (Line | null)[] = ANNOUNCER_LINES.map(() => null);
  private loading: Promise<void> | null = null;
  private current: { source: AudioBufferSourceNode; amp: GainNode } | null = null;
  /** What was asked for and what played, newest last (read by the capture tools). */
  readonly log: { count: number; line: string | null; at: number; duration: number }[] = [];

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly duck: (seconds: number) => void
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
    const start = ctx.currentTime + ANNOUNCER_DELAY;
    this.log.push({ count, line: line ? ANNOUNCER_LINES[index] : null, at: start, duration: line?.buffer.duration ?? 0 });
    if (this.log.length > 50) this.log.shift();
    if (!line) {
      void this.prefetch();
      return;
    }
    if (this.current) {
      const { source, amp } = this.current;
      amp.gain.setTargetAtTime(0, start, CUT / 3);
      source.stop(start + CUT);
    }
    const source = ctx.createBufferSource();
    source.buffer = line.buffer;
    const amp = ctx.createGain();
    amp.gain.value = line.gain;
    source.connect(amp).connect(this.out);
    const playing = { source, amp };
    source.onended = () => {
      amp.disconnect();
      if (this.current === playing) this.current = null;
    };
    source.start(start);
    this.current = playing;
    this.duck(ANNOUNCER_DELAY + line.buffer.duration);
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
