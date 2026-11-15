/**
 * The state one game session shares between its modules (waves, focus, pickups, props, online play,
 * screens). game.ts builds a single Session per startGame() and hands it to each of them; the
 * modules talk through this state and through the hooks they are given, never by importing each
 * other's instances.
 */
import type * as THREE from 'three';
import type { EnemyKind } from '../config';
import type { GameContext, GameState } from '../context';
import type { EnemyManager } from '../entities/enemies';
import type { RemotePlayer } from '../entities/remote-player';
import type { Net } from '../net/net';
import type { Preferences } from '../storage';
import type { HUD } from '../ui/hud';
import type { MapKey } from '../world/level';

export type Enemy = EnemyManager['enemies'][number];

/** An in-flight focus dash toward one enemy. */
export interface FocusDash {
  target: Enemy;
  t: number;
  /** Where the last trail stroke ended. */
  trail: THREE.Vector3;
  lastTrail: number;
  /** How long the dash has been unable to climb or drop to the target. */
  stuckY?: number;
}

export interface FocusState {
  active: boolean;
  t: number;
  chain: number;
  target: Enemy | null;
  dash: FocusDash | null;
  /** Delay before a dash may start, so the press that charged focus does not fire it. */
  arm: number;
  /** The dash combo has been released once since focus started. */
  ready: boolean;
}

export interface Winner {
  id: string | null;
  name: string;
}

/** The full game object: the shared GameState plus everything the session modules keep on it. */
export interface MatchState extends GameState {
  /** A menu (pause, click-to-play) is covering the game. */
  menu: boolean;
  time: number;
  hitstopT: number;
  hitstopScale: number;
  wave: number;
  score: number;
  combo: number;
  comboT: number;
  kills: number;
  intermission: number;
  /** Enemies still to spawn this wave. */
  queue: EnemyKind[];
  spawnT: number;
  maxAlive: number;
  deathT: number;
  focus: FocusState;
  katanaStreak: number;
  boss: Enemy | null;
  respawnT: number;
  matchT: number;
  over: Winner | null;
  overT: number;
  /** Host only: the match clock has started (someone else is in the match). */
  clockStarted: boolean;
  /** input.lastActive when the respawn prompt armed; any newer input respawns. */
  respawnArm: number;
  promptT: number;
}

export interface LobbyPlayer {
  name: string;
}

export interface LobbyState {
  players: Map<string, LobbyPlayer>;
  hostId: string | null;
  isPublic: boolean;
  /** Status line on the online and lobby screens. */
  status: string;
  code: string | null;
  map: MapKey | null;
  /** The code the host shows (its alias after a host change). */
  shown?: string | null;
  /** Peer ids in join order; the first one left takes over when the host goes. */
  order?: string[];
  /** Host-change generation, the suffix of the lobby's current code. */
  gen?: number;
  /** Code offered on the online screen after an idle kick. */
  rejoinCode?: string | null;
}

export interface ScoreRow {
  name: string;
  kills: number;
  deaths: number;
}

export interface ScoreEntry extends ScoreRow {
  id: string;
}

/** The match clock: seconds left, and on clients whether the host says it is running. */
export interface MatchClock {
  left: number;
  /** Host: seconds to the next clock broadcast. */
  syncT: number;
  running: boolean;
}

/** Which start-screen panel is showing. */
export type Screen = 'main' | 'online' | 'lobby';

export interface Session {
  readonly ctx: GameContext;
  readonly game: MatchState;
  readonly net: Net;
  /** Peer id -> the other players. */
  readonly remote: Map<string, RemotePlayer>;
  readonly lobby: LobbyState;
  /** Peer id -> match score. */
  readonly scores: Map<string, ScoreRow>;
  readonly clock: MatchClock;
  readonly prefs: Preferences;
  /** Aborted when the game is disposed. */
  readonly signal: AbortSignal;
  screen: Screen;
  /** A setTimeout that is cancelled when the game is disposed. */
  later(ms: number, fn: () => void): void;
  /** Resolves after `ms`; never resolves once the game is disposed. */
  sleep(ms: number): Promise<void>;
}

export const isOnline = (game: MatchState): boolean => game.mode === 'ffa';
export const inMatch = (game: MatchState): boolean => game.state === 'play' || game.state === 'dying' || game.state === 'over';

/** The match/wave state object, with its scoring and hit-stop rules. */
export function createMatchState(hud: HUD, onPlayerDeath: () => void): MatchState {
  return {
    state: 'start',
    mode: 'solo',
    menu: false,
    time: 0,
    hitstopT: 0,
    hitstopScale: 1,
    wave: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    kills: 0,
    intermission: 0,
    queue: [],
    spawnT: 0,
    maxAlive: 6,
    deathT: 0,
    focus: { active: false, t: 0, chain: 0, target: null, dash: null, arm: 0, ready: false },
    katanaStreak: 0,
    boss: null,
    respawnT: 0,
    matchT: 0,
    over: null,
    overT: 0,
    clockStarted: false,
    respawnArm: 0,
    promptT: 0,
    hitstop(duration, scale) {
      this.hitstopT = Math.max(this.hitstopT, duration);
      this.hitstopScale = scale;
    },
    addScore(points, label) {
      const mult = 1 + Math.min(this.combo, 9) * 0.25;
      const p = Math.round(points * mult);
      this.score += p;
      if (label) hud.kill(label, p);
      hud.setScore(this.score, this.combo);
    },
    onPlayerDeath,
  };
}

/** setTimeout and sleep tied to an AbortSignal: pending timers are cleared when it aborts. */
export function createTimers(signal: AbortSignal): Pick<Session, 'later' | 'sleep'> {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  signal.addEventListener(
    'abort',
    () => {
      for (const id of pending) clearTimeout(id);
      pending.clear();
    },
    { once: true },
  );
  const later = (ms: number, fn: () => void): void => {
    if (signal.aborted) return;
    const id = setTimeout(() => {
      pending.delete(id);
      fn();
    }, ms);
    pending.add(id);
  };
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => later(ms, resolve));
  return { later, sleep };
}

/** Escapes text for HTML markup. */
export const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);
const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Seconds as m:ss. */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** A lobby code without its host-change generation suffix ("ABCDE-2" -> "ABCDE"). */
export const baseCode = (code: string | null | undefined): string => String(code || '').replace(/-\d+$/, '');

/** The message of an error-like value, if it has one. */
export function messageOf(err: unknown): unknown {
  return typeof err === 'object' && err !== null && 'message' in err ? err.message : undefined;
}
