import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import type { CharacterId } from '~/brickfray/characters/types';
import type { HudState } from '~/brickfray/game/hud';
import type { GameEvent, MatchSettings } from '~/brickfray/sim/types';
import type { MatchReport, MatchResult } from '../contract';

/**
 * Watches one match from the local player's side and turns it into a report once: when the match ends, or when a
 * solo run is left after its warm-up. Rooms left early and warm-ups are not reported.
 */
export class MatchTally {
  private startedAt = 0;
  /** Solo time actually played: the run stands still while paused. */
  private played = 0;
  private headshots = 0;
  private done = false;

  constructor(
    private readonly settings: MatchSettings,
    private readonly character: CharacterId
  ) {}

  events(events: readonly GameEvent[], me: number) {
    for (const e of events) if (e.type === 'kill' && e.killer === me && e.victim !== me && e.headshot) this.headshots++;
  }

  /** Per frame; returns the report the frame the match ends. */
  frame(dt: number, hud: HudState, halted: boolean): MatchReport | null {
    if (this.done) return null;
    if (hud.phase === 'playing' || hud.phase === 'intermission') {
      this.startedAt ||= Date.now();
      if (!halted) this.played += dt;
    }
    if (hud.phase !== 'ended' || !this.startedAt) return null;
    this.done = true;
    return this.report(hud);
  }

  /** Leaving: a solo run past its warm-up counts as finished at the wave it reached. */
  leave(hud: HudState): MatchReport | null {
    if (this.done || this.settings.mode !== 'solo' || !this.startedAt) return null;
    if (hud.phase !== 'playing' && hud.phase !== 'intermission') return null;
    this.done = true;
    return this.report(hud);
  }

  private report(hud: HudState): MatchReport | null {
    const index = hud.rows.findIndex((r) => r.me);
    const me = hud.rows[index];
    if (!me) return null;
    const solo = this.settings.mode === 'solo';
    let result: MatchResult | null = null;
    if (this.settings.mode === 'ffa') result = hud.winner === null ? 'draw' : hud.winner === me.id ? 'win' : 'loss';
    if (this.settings.mode === 'tdm') result = hud.winner === null ? 'draw' : hud.winner === me.team ? 'win' : 'loss';
    const seconds = solo ? this.played : (Date.now() - this.startedAt) / 1000;
    return {
      key: crypto.randomUUID(),
      mode: this.settings.mode,
      map: this.settings.map,
      difficulty: solo ? this.settings.difficulty : null,
      wave: solo ? Math.max(1, hud.wave) : 0,
      character: CHARACTER_IDS.includes(me.character as CharacterId) ? me.character : this.character,
      endedAt: Date.now(),
      durationS: Math.max(1, Math.round(seconds)),
      score: me.score,
      kills: me.kills,
      deaths: solo ? Math.min(1, me.deaths) : me.deaths,
      assists: me.assists,
      headshots: Math.min(this.headshots, me.kills),
      placement: solo ? 1 : index + 1,
      players: solo ? 1 : hud.rows.length,
      result
    };
  }
}
