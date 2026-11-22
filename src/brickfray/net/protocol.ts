import type { BotKind, CharacterId } from '../characters/types';
import type { GameEvent, MatchSettings, MatchState } from '../sim/types';
import type { UpgradeId } from '../sim/upgrades';

export const PROTOCOL_VERSION = 6;

export interface LobbyPlayer {
  id: number;
  name: string;
  character: CharacterId;
  host: boolean;
}

export interface LobbyState {
  code: string | null;
  isPublic: boolean;
  hostName: string;
  settings: MatchSettings;
  players: LobbyPlayer[];
  phase: 'lobby' | 'playing';
  /** Humans in the match (lobby players while in the lobby). */
  count: number;
}

export interface RosterEntry {
  id: number;
  name: string;
  character: CharacterId | BotKind;
  team: 0 | 1 | -1;
  bot: BotKind | null;
}

export interface BoardRow {
  id: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  ping: number;
  /** Points whoever takes this player down collects on top of the kill (rooms; 0 = none). */
  bounty: number;
}

export interface Board {
  match: MatchState;
  rows: BoardRow[];
}

export type ClientMessage =
  | { t: 'hello'; v: number; name: string; character: CharacterId; token: string }
  | { t: 'probe' }
  | { t: 'ping'; c: number; rtt: number }
  | { t: 'chat'; text: string }
  | { t: 'character'; character: CharacterId }
  | { t: 'upgrade'; id: UpgradeId };

export type HostMessage =
  | { t: 'welcome'; id: number; lobby: LobbyState }
  | { t: 'refused'; reason: 'full' | 'version' | 'closed' }
  | { t: 'info'; lobby: LobbyState }
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'start'; settings: MatchSettings; you: number; roster: RosterEntry[]; time: number }
  | { t: 'roster'; roster: RosterEntry[] }
  | { t: 'events'; events: GameEvent[] }
  | { t: 'board'; board: Board }
  | { t: 'pong'; c: number; h: number }
  | { t: 'lobbyReturn' }
  | { t: 'closing' };
