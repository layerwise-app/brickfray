import type { UpgradeId } from '~/brickfray/sim/upgrades';
import type { AchievementNews } from '../achievements/contract';
import type { MatchFeats } from '../achievements/feats';

// What the leaderboard client and server exchange. Shared by both sides, so nothing here touches the database or the DOM.

export const MODES = ['solo', 'ffa', 'tdm'] as const;
export type BoardMode = (typeof MODES)[number];

export const SOLO_LEVELS = ['easy', 'normal', 'hard'] as const;
export type SoloLevel = (typeof SOLO_LEVELS)[number];

/** A room's time limits (the lobby's choices); each length is its own board. */
export const MATCH_MINUTES = [3, 5, 10, 15] as const;
export type MatchMinutes = (typeof MATCH_MINUTES)[number];

export type MatchResult = 'win' | 'loss' | 'draw';

export const LEADERBOARD_PAGE = 20;
export const HISTORY_PAGE = 15;
export const AVATAR_PX = 128;
export const AVATAR_MAX_BYTES = 32 * 1024;
export const AVATAR_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
/** Matches one upload may carry: a browser that was offline sends its backlog in a few calls. */
export const UPLOAD_BATCH = 20;

/** One finished match of the local player, as the game records it. */
export interface MatchReport {
  /** The key of the match's ticket; a retried upload carries the same key. A match that got no ticket makes its own. */
  key: string;
  /** What the server signed when the match started (startMatch). Without it the match stays in this browser's history only. */
  ticket: string | null;
  mode: BoardMode;
  map: string;
  /** Solo only. */
  difficulty: SoloLevel | null;
  /** Rooms only: the time limit. Null from a client older than it. */
  minutes: MatchMinutes | null;
  /** Solo: the wave the run reached; 0 otherwise. */
  wave: number;
  character: string;
  endedAt: number;
  durationS: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  /** Place by score among everyone in the match, bots included (solo: 1). */
  placement: number;
  players: number;
  /** Solo: null. */
  result: MatchResult | null;
  /** What the end-of-match screen showed; null from a client older than it. */
  detail: MatchDetail | null;
  /** The match's kills sorted for achievements (lib/achievements/feats.ts); null from a client older than them. */
  feats: MatchFeats | null;
}

/** One player on a room's final scoreboard. */
export interface DetailPlayer {
  name: string;
  /** A character id (room bots wear the roster too). */
  character: string;
  /** -1 in free-for-all. */
  team: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  bot: boolean;
  /** The player who reported the match. */
  me: boolean;
}

/** The score panel of a finished match: a room's final scoreboard in its order, or the upgrades a solo run took. */
export type MatchDetail =
  | { mode: 'solo'; upgrades: UpgradeId[] }
  /** `winner`: index into `players`; null on a draw or when the winner had left. */
  | { mode: 'ffa'; players: DetailPlayer[]; winner: number | null }
  | { mode: 'tdm'; players: DetailPlayer[]; teams: [number, number]; winner: 0 | 1 | null };

/** A started match: its ticket and the key its report must carry. */
export interface MatchStart {
  key: string;
  ticket: string;
}

/** An uploaded picture wins; otherwise a character portrait; otherwise the row's own character. */
export interface Avatar {
  hero: string | null;
  image: string | null;
}

/** A stored match in the player's own list. Its date is shown there only, so other lists leave it out. */
export interface BoardEntry {
  id: number;
  mode: BoardMode;
  map: string;
  difficulty: SoloLevel | null;
  minutes: MatchMinutes | null;
  wave: number;
  character: string;
  endedAt: number;
  durationS: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  placement: number;
  players: number;
  result: MatchResult | null;
}

/** Who a row belongs to, as everyone sees it: "Name#1234" and a picture. A profile from before tags has a null tag. */
export interface BoardPlayer {
  name: string;
  tag: number | null;
  avatar: Avatar;
}

export interface RankedEntry extends Omit<BoardEntry, 'endedAt'>, BoardPlayer {
  rank: number;
  /** The asking browser's own row (its player, or its account's). */
  mine: boolean;
}

/** All-time boards, one per mode (solo: per difficulty, rooms: per time limit), on one map or all of them. */
export interface LeaderboardQuery {
  mode: BoardMode;
  /** Solo boards are kept per difficulty. */
  difficulty: SoloLevel | null;
  /** Room boards are kept per time limit. */
  minutes: MatchMinutes | null;
  /** Null: every map. */
  map: string | null;
  page: number;
  playerId: string | null;
}

export interface LeaderboardPage {
  rows: RankedEntry[];
  /** Ranked players in this board. */
  total: number;
  page: number;
  pageSize: number;
  /** The asker's best row and rank, whether or not it is on this page. */
  me: RankedEntry | null;
}

export interface HistoryTotals {
  matches: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  wins: number;
  bestScore: number;
  bestWave: number;
  seconds: number;
}

export interface HistoryPage {
  rows: BoardEntry[];
  total: number;
  page: number;
  pageSize: number;
  totals: HistoryTotals;
}

export type ProfileView = BoardPlayer;

/** One match's score panel. `endedAt` only for the asker's own match; `detail` null for a match stored before details were kept. */
export interface MatchView {
  match: Omit<BoardEntry, 'endedAt'> & { endedAt: number | null };
  player: BoardPlayer;
  mine: boolean;
  detail: MatchDetail | null;
}

/** Where a just-stored match leaves its player on the all-time board of its mode (solo: its difficulty, rooms: its time limit), every map. */
export interface MatchRank {
  mode: BoardMode;
  difficulty: SoloLevel | null;
  minutes: MatchMinutes | null;
  /** The player's place now (their best match there), out of `total` ranked players. */
  rank: number;
  total: number;
  /** Their place without this match; null when it is their first there. */
  before: number | null;
  /** Where this match alone places against everyone else's best (equal to `rank` when it is their best). */
  run: number;
}

/** Only ever sent to the browser it describes: the email is the signed-in user's own. */
export interface AccountView {
  signedIn: boolean;
  email: string | null;
  /** This browser's player belongs to the signed-in account. */
  linked: boolean;
  /** Null until the server has heard of this player. */
  profile: ProfileView | null;
}

export interface UploadResult {
  /** Keys the server holds now (new or already there). */
  stored: string[];
  /** Keys it will never take (out of range or malformed): the client stops retrying them. */
  refused: string[];
  /** Over the rate limit: the rest waits for a later upload. */
  limited: boolean;
  /** Tiers the stored matches unlocked and the nearest goals they moved; null when nothing was stored. */
  achievements: AchievementNews | null;
}

export interface ClaimResult {
  /** The id this browser must use from now on: the same one, or a fresh one when its old id belongs to another account. */
  playerId: string;
  profile: ProfileView;
}

export type BoardErrorCode = 'invalid' | 'rate' | 'auth' | 'notFound';

/** A refusal the client shows or acts on; the message is for logs only. */
export class BoardError extends Error {
  constructor(
    readonly code: BoardErrorCode,
    message: string
  ) {
    super(message);
  }
}

export function avatarUrl(id: string) {
  return `/api/board/avatar/${id}`;
}
