// What the leaderboard client and server exchange. Shared by both sides, so nothing here touches the database or the DOM.

export const MODES = ['solo', 'ffa', 'tdm'] as const;
export type BoardMode = (typeof MODES)[number];

export const PERIODS = ['day', 'week', 'all'] as const;
export type BoardPeriod = (typeof PERIODS)[number];

export const SOLO_LEVELS = ['easy', 'normal', 'hard'] as const;
export type SoloLevel = (typeof SOLO_LEVELS)[number];

export type MatchResult = 'win' | 'loss' | 'draw';

export const LEADERBOARD_PAGE = 20;
export const HISTORY_PAGE = 15;
export const NAME_MAX = 16;
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
}

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

export interface BoardEntry {
  id: number;
  mode: BoardMode;
  map: string;
  difficulty: SoloLevel | null;
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

export interface RankedEntry extends BoardEntry {
  rank: number;
  name: string;
  avatar: Avatar;
  /** The asking browser's own row (its player, or its account's). */
  mine: boolean;
}

export interface LeaderboardQuery {
  mode: BoardMode;
  period: BoardPeriod;
  /** Solo boards are kept per difficulty. */
  difficulty: SoloLevel | null;
  page: number;
  /** Minutes east of UTC, so "today" and "this week" start at the player's own midnight. */
  tzOffset: number;
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

export interface ProfileView {
  name: string;
  avatar: Avatar;
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
