export interface VoiceEntry<T> {
  handle: T;
  key: string;
  priority: number;
  /** Scheduled start and end in context seconds. */
  start: number;
  end: number;
}

export interface Admission<T> {
  /** Voice to stop to make room, if the pool was full. */
  evicted: T | null;
  /** Gain for this play; stacked identical sounds play softer. */
  gain: number;
}

/**
 * Voice budget: at most `max` sounds at once. When full, the lowest
 * priority (then oldest) voice is stolen, unless every voice outranks the
 * newcomer. Identical sounds starting within `window` seconds are capped at
 * `burst` so a volley (8 pellet impacts) doesn't stack into clipping.
 */
export class VoicePool<T> {
  private voices: VoiceEntry<T>[] = [];

  constructor(
    readonly max = 32,
    readonly window = 0.04
  ) {}

  get size(): number {
    return this.voices.length;
  }

  entries(): readonly VoiceEntry<T>[] {
    return this.voices;
  }

  admit(key: string, priority: number, start: number, now: number, burst = 2): Admission<T> | null {
    this.voices = this.voices.filter((v) => v.end > now);
    let same = 0;
    for (const v of this.voices) if (v.key === key && Math.abs(v.start - start) < this.window) same++;
    if (same >= burst) return null;
    let evicted: T | null = null;
    if (this.voices.length >= this.max) {
      let weakest = this.voices[0]!;
      for (const v of this.voices) {
        if (v.priority < weakest.priority || (v.priority === weakest.priority && v.start < weakest.start)) weakest = v;
      }
      if (weakest.priority > priority) return null;
      this.voices.splice(this.voices.indexOf(weakest), 1);
      evicted = weakest.handle;
    }
    return { evicted, gain: 1 / (1 + same * 0.6) };
  }

  add(entry: VoiceEntry<T>): void {
    this.voices.push(entry);
  }

  remove(handle: T): void {
    const i = this.voices.findIndex((v) => v.handle === handle);
    if (i >= 0) this.voices.splice(i, 1);
  }

  clear(): void {
    this.voices = [];
  }
}
