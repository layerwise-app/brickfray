import type { MatchPhase } from '../sim/types';
import type { AudioEngine, MusicTrack, SoundId } from './types';

/** How a match ended for the local player: won, lost, or a solo run that is over. */
export type Outcome = 'won' | 'lost' | 'over';

const OUTCOME_STING: Record<Outcome, SoundId> = { won: 'victory', lost: 'defeat', over: 'runOver' };

/** Wave themes with a boss in them call the boss wave sting instead of the wave start. */
const BOSS_THEMES: ReadonlySet<string> = new Set(['boss', 'bossEscort', 'bossPair']);

/** A timed match's last stretch (s) has its own music. */
export const FINAL_STRETCH = 30;
/**
 * Seconds after the outcome sting before the menu theme comes in under the results: scheduled on the audio clock, since
 * a solo results screen stops the match's frames.
 */
const RESULTS_MUSIC = { after: 3.2, level: 0.7 };
/** Cues of one occasion arriving twice within this many seconds (a spawn reported twice, a wave start and the match start) play once. */
const ONCE = 1.5;
/** The upgrade cards' shimmer comes this long after the wave-cleared fanfare. */
const OFFER_AFTER = 0.85;

/**
 * The match's music and the one-shot cues that mark its flow: the warm-up countdown and start, wave starts, the
 * wave cleared, upgrade cards dealt and taken, a respawn, a grenade coming back, and the outcome. Every cue plays once
 * per occasion however many reports of it arrive.
 */
export class MatchCues {
  private clock = 0;
  private phase: MatchPhase | null = null;
  private counted = 0;
  private music: MusicTrack | null = null;
  private readonly last = new Map<string, number>();
  private grenadeCount = -1;
  private alive = false;

  constructor(private readonly audio: AudioEngine) {}

  frame(dt: number): void {
    this.clock += dt;
  }

  /**
   * The match phase and the seconds left in it, `outcome` once it has ended. Warm-up: its music and the countdown
   * ticks over its last three seconds (each its own take a semitone higher); then the start (a solo run's first wave
   * has its own call instead), the wave cleared, the final stretch's music, and the outcome sting with the menu theme
   * under the results.
   */
  setPhase(phase: MatchPhase, left: number, options: { solo: boolean; timed: boolean; outcome: Outcome | null }): void {
    if (phase === 'warmup' && left > 0 && left <= 3) {
      const second = Math.ceil(left);
      if (second !== this.counted) {
        this.counted = second;
        this.audio.play('countdown', { priority: 9, rate: 2 ** ((3 - second) / 12), variant: 3 - second });
      }
    }
    if (phase === 'playing') this.setMusic(options.timed && left > 0 && left <= FINAL_STRETCH ? 'final' : null);
    if (phase === this.phase) return;
    const was = this.phase;
    this.phase = phase;
    this.counted = 0;
    if (phase === 'warmup') this.setMusic('match');
    if (phase === 'intermission') {
      this.setMusic('intermission');
      if (was === 'playing') this.once('waveClear', { priority: 9 });
    }
    if (was === 'warmup' && phase === 'playing' && !options.solo) this.once('matchStart', { priority: 9 });
    if (was !== null && phase === 'ended' && options.outcome) {
      this.audio.play(OUTCOME_STING[options.outcome], { priority: 10 });
      this.setMusic('menu', RESULTS_MUSIC.level, RESULTS_MUSIC.after);
    }
  }

  /** A wave begins: its call (a boss wave's own), the music of the break fading under it. */
  wave(theme: string): void {
    this.setMusic(null);
    this.once(BOSS_THEMES.has(theme) ? 'bossWave' : 'waveStart', { priority: 9 }, 'wave');
  }

  /** The upgrade cards are dealt: the wave-cleared fanfare (if the phase has not played it yet), then their shimmer. */
  offer(): void {
    this.once('waveClear', { priority: 9 });
    this.audio.play('upgradeOffer', { priority: 8, delay: OFFER_AFTER });
  }

  upgradeTaken(): void {
    this.audio.play('upgradeTaken', { priority: 9 });
  }

  respawn(): void {
    this.once('respawn', { volume: 0.75, priority: 7 });
  }

  /** The local player's grenade count, every frame: one coming back plays the ready cue (a spawn or wave refill has its own). */
  grenades(count: number, alive: boolean): void {
    const refilled = alive && this.alive && this.grenadeCount >= 0 && count > this.grenadeCount && this.phase !== 'intermission';
    const quiet = this.clock - Math.max(this.last.get('respawn') ?? -Infinity, this.last.get('waveClear') ?? -Infinity) > ONCE;
    if (refilled && quiet) this.audio.play('grenadeReady', { priority: 8 });
    this.grenadeCount = count;
    this.alive = alive;
  }

  private once(id: SoundId, options: { volume?: number; priority: number }, key: string = id): void {
    if (this.clock - (this.last.get(key) ?? -Infinity) < ONCE) return;
    this.last.set(key, this.clock);
    this.audio.play(id, options);
  }

  private setMusic(track: MusicTrack | null, level = 1, delay = 0): void {
    if (track === this.music) return;
    this.music = track;
    this.audio.playMusic(track, level, delay);
  }
}
