import type { MusicTrack } from './types';

interface Playing {
  track: MusicTrack;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/** One looping track at a time on the music bus, crossfaded; a track starts once it has been rendered. */
export class MusicPlayer {
  private readonly tracks = new Map<MusicTrack, AudioBuffer>();
  private want: MusicTrack | null = null;
  private level = 1;
  private current: Playing | null = null;
  private target: { ctx: BaseAudioContext; out: AudioNode } | null = null;

  get loaded(): MusicTrack[] {
    return [...this.tracks.keys()];
  }

  attach(ctx: BaseAudioContext, out: AudioNode): void {
    this.target = { ctx, out };
    this.sync();
  }

  add(track: MusicTrack, buffer: AudioBuffer): void {
    this.tracks.set(track, buffer);
    this.sync();
  }

  set(track: MusicTrack | null, level = 1): void {
    this.want = track;
    this.level = level;
    this.sync();
  }

  clear(): void {
    this.tracks.clear();
    this.current = null;
    this.target = null;
  }

  private sync(): void {
    if (!this.target) return;
    const { ctx, out } = this.target;
    const now = ctx.currentTime;
    if (this.current?.track === this.want) {
      this.current.gain.gain.setTargetAtTime(this.level, now, 0.4);
      return;
    }
    const want = this.want;
    const buffer = want ? this.tracks.get(want) : null;
    if (want && !buffer && this.current === null) return;
    if (this.current) {
      const { gain, source } = this.current;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.2);
      source.stop(now + 1.3);
      source.onended = () => gain.disconnect();
      this.current = null;
    }
    if (!want || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.level, now + 1.5);
    source.connect(gain).connect(out);
    source.start(now);
    this.current = { track: want, source, gain };
  }
}
