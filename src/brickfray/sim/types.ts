import type { BotKind, CharacterId } from '../characters/types';
import type { MeleeId, WeaponId } from '../weapons/defs';
import type { MapId } from '../world/types';
import type { MoveState } from './movement';
import type { UpgradeId, UpgradeLevels } from './upgrades';

export const BUTTON = {
  fire: 1,
  ads: 2,
  jump: 4,
  crouch: 8,
  sprint: 16,
  reload: 32,
  melee: 64,
  grenade: 128,
  grenadeLow: 256
} as const;

/** One fixed tick of player intent. The client predicts with it; the host replays it. */
export interface Command {
  seq: number;
  /** -1…1, quantized to 1/127 on the wire. */
  forward: number;
  right: number;
  yaw: number;
  pitch: number;
  buttons: number;
  /** Weapon slot the player wants (0…3). */
  slot: number;
  /** Host-clock time the player was looking at when this command was made (lag compensation). */
  viewTime: number;
  /** The player's life (spawn count, mod 256) when this was made; the host drops commands from an earlier life. */
  life: number;
}

export type ModeId = 'solo' | 'ffa' | 'tdm';

export interface ArmsState {
  weapon: WeaponId;
  /** Weapon being switched to while `switchTime` runs down (holster then draw). */
  next: WeaponId | null;
  switchTime: number;
  ammo: Record<WeaponId, number>;
  cooldown: number;
  /** Rounds still to come in the current burst (burst-fire guns). */
  burstLeft: number;
  /** Remaining reload seconds (shotgun: of the current shell); 0 = not reloading. */
  reload: number;
  reloadTotal: number;
  reloadEmpty: boolean;
  /** Next recoil-pattern index; resets after a pause. */
  burst: number;
  sinceShot: number;
  sprintRecovery: number;
  /** Melee: cooldown left and time since the swing started (-1 = none). */
  meleeCooldown: number;
  meleeTime: number;
  grenades: number;
  /** A full load of grenades; below it they come back one at a time. */
  grenadeMax: number;
  /** Seconds to get one grenade back (per player: upgrades can shorten it). */
  grenadeRefill: number;
  /** Seconds until the next grenade arrives; 0 while the load is full. */
  grenadeTimer: number;
  /** Solo upgrades: magazine size and reload time multipliers (1 = as the gun's def). */
  magScale: number;
  reloadScale: number;
  /** Cooking time while the grenade button is held (-1 = none). */
  cook: number;
  /** Seconds left in the throw motion (blocks firing). */
  throwTime: number;
  ads: number;
  /** A press during cooldown fires as soon as allowed. */
  queuedFire: number;
  prevButtons: number;
  /** Counts shots so remote clients can trigger muzzle flashes from snapshots. */
  shots: number;
}

export interface PlayerState {
  id: number;
  name: string;
  character: CharacterId | BotKind;
  bot: BotKind | null;
  team: 0 | 1 | -1;
  move: MoveState;
  yaw: number;
  pitch: number;
  arms: ArmsState;
  health: number;
  maxHealth: number;
  alive: boolean;
  /** Host time when the player may respawn / when spawn protection ends. */
  respawnAt: number;
  protectedUntil: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  ping: number;
  /** Players who damaged this one in the current life (for assists). */
  damagers: Map<number, number>;
  lastSeq: number;
  /** Spawn count mod 256, so commands made before the client saw a respawn don't undo its position and facing. */
  life: number;
  /** Size multiplier for hitboxes and visuals (bosses). */
  scale: number;
}

/** The host's record of a player: the shared state plus what only the host's rules read. */
export interface HostPlayer extends PlayerState {
  /** Solo upgrade levels taken so far (all zero elsewhere). */
  upgrades: UpgradeLevels;
  /** Soaks damage before health until it is used up. */
  armor: number;
}

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface MatchSettings {
  mode: ModeId;
  map: MapId;
  minutes: number;
  bots: number;
  /** Solo only: how fast the waves ramp up. */
  difficulty: Difficulty;
}

export type MatchPhase = 'warmup' | 'playing' | 'intermission' | 'ended';

export interface MatchState {
  phase: MatchPhase;
  /** Host time the current phase ends (0 = open-ended). */
  phaseEnds: number;
  teamScore: [number, number];
  wave: number;
  winner: number | null;
}

export type HitKind = 'body' | 'head';

/** Deaths the world deals rather than a player: falling below the map's kill height (its water). */
export type HazardId = 'water';
export type KillCause = WeaponId | MeleeId | 'grenade' | HazardId;

/** Shot result shared with every client so they can draw tracers and impacts. */
export interface ShotTrace {
  shooter: number;
  weapon: WeaponId;
  origin: [number, number, number];
  ends: { point: [number, number, number]; surface: string; hitPlayer: number; normal: [number, number, number] }[];
}

export type GameEvent =
  /** `respawnAt`: host time the victim comes back, null when it won't (solo, match over). */
  | { type: 'kill'; killer: number; victim: number; weapon: KillCause; headshot: boolean; assister: number | null; respawnAt: number | null }
  | { type: 'damage'; attacker: number; victim: number; amount: number; kind: HitKind; from: [number, number, number]; fatal: boolean }
  | { type: 'explosion'; position: [number, number, number]; owner: number }
  | { type: 'spawn'; player: number }
  /** `wall`: a swing that met no one but struck the world within reach (what it is made of, where). */
  | { type: 'melee'; player: number; hit: boolean; wall?: { surface: string; at: [number, number, number] } }
  | { type: 'chat'; player: number; text: string }
  | { type: 'wave'; wave: number }
  /** Solo, after a cleared wave: the cards `player` picks one from, with the levels they hold now. */
  | { type: 'upgradeOffer'; player: number; wave: number; options: UpgradeId[]; levels: UpgradeLevels }
  | { type: 'upgrade'; player: number; id: UpgradeId; level: number; auto: boolean }
  | { type: 'join'; player: number; name: string }
  | { type: 'leave'; player: number; name: string };
