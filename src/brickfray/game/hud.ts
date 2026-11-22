import type { BotKind, CharacterId } from '../characters/types';
import { GRENADE_REFILL } from '../sim/constants';
import type { KillCause, MatchPhase, MatchSettings, MatchState } from '../sim/types';
import { noUpgrades, type UpgradeId, type UpgradeLevels } from '../sim/upgrades';
import { GRENADE, type WeaponId } from '../weapons/defs';

export interface FeedEntry {
  key: number;
  killer: string;
  killerTeam: number;
  victim: string;
  victimTeam: number;
  weapon: KillCause;
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

/** Solo: the upgrade cards dealt after a cleared wave; `picked` holds the choice while the cards leave. */
export interface UpgradeOffer {
  key: number;
  wave: number;
  options: UpgradeId[];
  levels: UpgradeLevels;
  picked: UpgradeId | null;
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
  /** A full magazine of the weapon in hand (upgrades enlarge it). */
  mag: number;
  reload: number;
  grenades: number;
  grenadeMax: number;
  /** Seconds until the next grenade comes back (0 = full), out of `grenadeRefill`. */
  grenadeTimer: number;
  grenadeRefill: number;
  scoped: boolean;
  /** Aiming down sights: the gun's own sight replaces the crosshair. */
  aiming: boolean;
  feed: FeedEntry[];
  /** Big center callout (e.g. "Wave 3") — an i18n key plus values. */
  banner: { key: number; text: string; sub?: string } | null;
  /** `respawnAt` is host time (null: no respawn); `killer` is empty for a death of one's own doing or the world's. */
  death: { killer: string; weapon: FeedEntry['weapon']; respawnAt: number | null } | null;
  /** Seconds until the local player comes back; -1 while alive or when there is no respawn. */
  respawnLeft: number;
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
  armor: number;
  offer: UpgradeOffer | null;
  /** Solo upgrade levels held, and each pick in the order taken (the run summary lists them). */
  upgrades: UpgradeLevels;
  upgradesTaken: UpgradeId[];
  /** Solo: snapbots of this wave still to beat, what the wave is about, and what ended the run. */
  waveLeft: number;
  waveTheme: MatchState['theme'];
  soloCause: MatchState['cause'];
  /** The local player's headshot kills, shots fired and shots that hit someone (host traces), and seconds played. */
  headshots: number;
  shots: number;
  shotsHit: number;
  playTime: number;
  /** Solo: living Megabots and their health. */
  bosses: { id: number; health: number; max: number }[];
}

export type HudPulse =
  | { type: 'hit'; kind: 'body' | 'head' | 'kill'; amount: number; at: [number, number, number] | null; headshot?: boolean }
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
    mag: 30,
    reload: -1,
    grenades: GRENADE.perLife,
    grenadeMax: GRENADE.perLife,
    grenadeTimer: 0,
    grenadeRefill: GRENADE_REFILL,
    scoped: false,
    aiming: false,
    feed: [],
    banner: null,
    death: null,
    respawnLeft: -1,
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
    hint: null,
    armor: 0,
    offer: null,
    upgrades: noUpgrades(),
    upgradesTaken: [],
    waveLeft: 0,
    waveTheme: null,
    soloCause: null,
    headshots: 0,
    shots: 0,
    shotsHit: 0,
    playTime: 0,
    bosses: []
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
