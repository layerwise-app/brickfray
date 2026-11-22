import type { AudioEngine } from './types';

/**
 * The low-health heartbeat. Below `from` HP the heart beats at `bpm[0]` rising to `bpm[1]` at 1 HP, from `level[0]`
 * to full, the dub `gap[0]` → `gap[1]` s after its lub (tighter as the heart races, so each pair stays a pair). Each
 * beat is one recorded heartbeat: 'heartbeat' holds `beats` lubs, then the dub of each in the same order. `dub` is
 * the recorded dub's level against its lub (both files are normalised alone). Danger follows health with the `glide`
 * time constant; the beat swells in over `rise` s (the first lub lands `rise` s after health drops) and fades out over
 * `fade` s once health is back above `from`.
 */
export const HEART = {
  from: 30,
  bpm: [66, 104],
  gap: [0.25, 0.18],
  level: [0.45, 1],
  dub: 0.51,
  /** Beat-to-beat wobble of the period (±), as a resting heart has. */
  wobble: 0.025,
  glide: 1,
  rise: 0.35,
  fade: 1.2,
  beats: 6,
  /** Beats are handed to the engine this long before they are due, with the rest as a delay: sample-exact rhythm. */
  lead: 0.1,
  priority: 4
} as const;

const SILENT = 0.03;

function mix(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t;
}

export class Heartbeat {
  private clock = 0;
  /** When the next lub is due, on this clock. */
  private next = 0;
  private danger = 0;
  private presence = 0;
  private last = -1;

  constructor(
    private readonly audio: AudioEngine,
    private readonly random: () => number = Math.random
  ) {}

  frame(dt: number, alive: boolean, health: number): void {
    this.clock += dt;
    if (!alive) {
      this.danger = 0;
      this.presence = 0;
      return;
    }
    const low = health < HEART.from;
    const target = low ? Math.min(Math.max(1 - health / HEART.from, 0), 1) : 0;
    const was = this.presence;
    this.danger += (target - this.danger) * (1 - Math.exp(-dt / HEART.glide));
    this.presence += ((low ? 1 : 0) - this.presence) * (1 - Math.exp(-dt / (low ? HEART.rise : HEART.fade)));
    if (this.presence < SILENT) return;
    if (was < SILENT) this.next = this.clock + HEART.rise;
    while (this.next <= this.clock + HEART.lead) {
      const delay = Math.max(this.next - this.clock, 0);
      const volume = this.presence * mix(HEART.level, this.danger);
      const beat = this.pick();
      this.audio.play('heartbeat', { variant: beat, volume, delay, priority: HEART.priority });
      this.audio.play('heartbeat', { variant: HEART.beats + beat, volume: volume * HEART.dub, delay: delay + mix(HEART.gap, this.danger), priority: HEART.priority });
      this.next = Math.max(this.next, this.clock) + (60 / mix(HEART.bpm, this.danger)) * (1 + (this.random() * 2 - 1) * HEART.wobble);
    }
  }

  /** A recorded beat other than the one just played. */
  private pick(): number {
    const beat = this.last < 0 ? Math.floor(this.random() * HEART.beats) : (this.last + 1 + Math.floor(this.random() * (HEART.beats - 1))) % HEART.beats;
    this.last = beat;
    return beat;
  }
}
