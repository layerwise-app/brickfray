import { fetchTrack, TRACKS } from './music';
import type { MusicTrack } from './types';

/** While gunfire, blasts or hits sound the music sinks to `depth`, and rises back over `release` once they stop for `hold` s. */
export const DUCK = { depth: 0.35, attack: 0.03, hold: 0.7, release: 0.8 };
const FADE_IN = 1.2;
const FADE_OUT = 1.1;

interface Playing {
  track: MusicTrack;
  source: AudioBufferSourceNode;
  gain: GainNode;
  start: number;
}

/**
 * One looping track at a time on the music bus, crossfaded. Tracks are files fetched the first time they are wanted
 * (or prefetched), so the menu's first load carries no music; a track starts once decoded, if it is still wanted.
 */
export class MusicPlayer {
  private readonly buffers = new Map<MusicTrack, AudioBuffer>();
  private readonly loading = new Set<MusicTrack>();
  private want: MusicTrack | null = null;
  private level = 1;
  /** Context time the wanted track may start (a delayed set), or 0. */
  private startAt = 0;
  private current: Playing | null = null;
  private target: { ctx: BaseAudioContext; duck: GainNode } | null = null;

  get loaded(): MusicTrack[] {
    return [...this.buffers.keys()];
  }

  attach(ctx: BaseAudioContext, out: AudioNode): void {
    const duck = ctx.createGain();
    duck.connect(out);
    this.target = { ctx, duck };
    this.sync();
  }

  set(track: MusicTrack | null, level = 1, delay = 0): void {
    this.want = track;
    this.level = level;
    this.startAt = delay > 0 && this.target ? this.target.ctx.currentTime + delay : 0;
    this.sync();
  }

  prefetch(tracks: readonly MusicTrack[]): void {
    for (const track of tracks) void this.load(track);
  }

  /** Gameplay is loud right now: sink the music under it. */
  duck(): void {
    if (!this.target || !this.current) return;
    const { ctx, duck } = this.target;
    const t = ctx.currentTime;
    duck.gain.cancelScheduledValues(t);
    duck.gain.setTargetAtTime(DUCK.depth, t, DUCK.attack);
    duck.gain.setTargetAtTime(1, t + DUCK.hold, DUCK.release / 3);
  }

  clear(): void {
    this.buffers.clear();
    this.current = null;
    this.target = null;
  }

  private async load(track: MusicTrack): Promise<void> {
    const ctx = this.target?.ctx;
    if (!ctx || this.buffers.has(track) || this.loading.has(track)) return;
    this.loading.add(track);
    try {
      this.buffers.set(track, await fetchTrack(ctx, track));
    } catch (error) {
      console.error(`Music ${track} could not load`, error);
    } finally {
      this.loading.delete(track);
    }
    if (this.target?.ctx === ctx) this.sync();
  }

  private sync(): void {
    if (!this.target) return;
    const { ctx, duck } = this.target;
    const now = ctx.currentTime;
    const want = this.want;
    const level = want ? this.level * TRACKS[want].level : 0;
    if (this.current?.track === want) {
      const { gain, start } = this.current;
      gain.gain.setTargetAtTime(level, Math.max(now, start + FADE_IN), 0.4);
      return;
    }
    const buffer = want ? this.buffers.get(want) : null;
    if (want && !buffer) void this.load(want);
    if (this.current) {
      const { gain, source, start } = this.current;
      const end = start > now ? now : now + FADE_OUT;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, end);
      source.stop(end + 0.1);
      source.onended = () => gain.disconnect();
      this.current = null;
    }
    if (!want || !buffer) return;
    const [loopStart, loopEnd] = TRACKS[want].loop;
    const start = Math.max(now, this.startAt);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = loopStart;
    source.loopEnd = Math.min(loopEnd, buffer.duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + FADE_IN);
    source.connect(gain).connect(duck);
    source.start(start);
    this.current = { track: want, source, gain, start };
  }
}
