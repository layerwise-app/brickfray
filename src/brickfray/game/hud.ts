import type { BotKind, CharacterId } from '../characters/types';
import type { MatchPhase, MatchSettings } from '../sim/types';
import type { MeleeId, WeaponId } from '../weapons/defs';

export interface FeedEntry {
  key: number;
  killer: string;
  killerTeam: number;
  victim: string;
  victimTeam: number;
  weapon: WeaponId | MeleeId | 'grenade';
  headshot: boolean;
  mine: boolean;
  victimIsMe: boolean;
  self: boolean;
}

export interface ScoreRow {
  id: number;
  name: string;
  character: CharacterId | BotKind;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  ping: number;
  me: boolean;
  bot: boolean;
}

export interface HudState {
  settings: MatchSettings | null;
  phase: MatchPhase | 'loading';
  /** Seconds left in the current phase (warmup countdown, match clock, wave break, results). */
  phaseLeft: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  weapon: WeaponId;
  ammo: number;
  reload: number;
  grenades: number;
  scoped: boolean;
  /** Aiming down sights: the gun's own sight replaces the crosshair. */
  aiming: boolean;
  feed: FeedEntry[];
  /** Big center callout (e.g. "Wave 3") — an i18n key plus values. */
  banner: { key: number; text: string; sub?: string } | null;
  death: { killer: string; weapon: FeedEntry['weapon']; respawnAt: number } | null;
  scoreboard: boolean;
  rows: ScoreRow[];
  teamScore: [number, number];
  myTeam: number;
  wave: number;
  winner: number | null;
  chat: { key: number; name: string; text: string; team: number }[];
  ping: number;
  fps: number;
  frameMs: number;
  stats: { calls: number; triangles: number } | null;
  hint: 'ctrl' | null;
}

export type HudPulse =
  | { type: 'hit'; kind: 'body' | 'head' | 'kill'; amount: number; at: [number, number, number] | null }
  | { type: 'hurt'; angle: number; amount: number }
  | { type: 'spread'; px: number };

export function initialHud(): HudState {
  return {
    settings: null,
    phase: 'loading',
    phaseLeft: 0,
    health: 100,
    maxHealth: 100,
    alive: false,
    weapon: 'ar',
    ammo: 30,
    reload: -1,
    grenades: 2,
    scoped: false,
    aiming: false,
    feed: [],
    banner: null,
    death: null,
    scoreboard: false,
    rows: [],
    teamScore: [0, 0],
    myTeam: -1,
    wave: 0,
    winner: null,
    chat: [],
    ping: 0,
    fps: 0,
    frameMs: 0,
    stats: null,
    hint: null
  };
}

/**
 * State the React HUD renders. Slow-changing values go through `set`
 * (useSyncExternalStore); per-frame effects (hit markers, damage arcs,
 * crosshair bloom) go through `pulse` to imperative listeners.
 */
export class HudStore {
  state: HudState = initialHud();
  private listeners = new Set<() => void>();
  private pulses = new Set<(p: HudPulse) => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.state;

  set(partial: Partial<HudState>) {
    let changed = false;
    for (const key of Object.keys(partial) as (keyof HudState)[]) {
      if (this.state[key] !== partial[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) fn();
  }

  reset() {
    this.state = initialHud();
    for (const fn of this.listeners) fn();
  }

  onPulse(fn: (p: HudPulse) => void) {
    this.pulses.add(fn);
    return () => this.pulses.delete(fn);
  }

  pulse(p: HudPulse) {
    for (const fn of this.pulses) fn(p);
  }
}
