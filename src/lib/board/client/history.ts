import { HISTORY_PAGE, type BoardEntry, type HistoryPage, type MatchDetail, type MatchReport } from '../contract';
import { getPlayerId } from './identity';

// This browser's own record of its matches: history works offline, and what the server has not taken yet waits here.

export type UploadState = 'pending' | 'stored' | 'refused';
export interface LocalMatch extends MatchReport {
  upload: UploadState;
}

const KEY = 'brickfray.history.v1';
const KEEP = 300;

interface Saved {
  player: string;
  matches: LocalMatch[];
}

function load(): LocalMatch[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return saved?.player === getPlayerId() && Array.isArray(saved.matches) ? saved.matches : [];
  } catch {
    return [];
  }
}

function save(matches: LocalMatch[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ player: getPlayerId(), matches: matches.slice(-KEEP) } satisfies Saved));
  } catch {
    // Full or blocked storage: the server copy still has the stored ones.
  }
}

export function localMatches() {
  return load();
}

export function addLocalMatch(report: MatchReport, upload: UploadState) {
  const matches = load().filter((m) => m.key !== report.key);
  save([...matches, { ...report, upload }]);
}

export function pendingMatches(): MatchReport[] {
  return load()
    .filter((m) => m.upload === 'pending')
    .map(({ upload: _, ...report }) => report);
}

export function markUploads(keys: string[], upload: UploadState) {
  if (!keys.length) return;
  const set = new Set(keys);
  save(load().map((m) => (set.has(m.key) ? { ...m, upload } : m)));
}

export function clearLocalMatches() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

function newestFirst() {
  return load().sort((a, b) => b.endedAt - a.endedAt);
}

/** The same page the server would give, from this browser's copy: used while the server cannot be reached. Row n has id -n. */
export function localHistory(page: number): HistoryPage {
  const all = newestFirst();
  const rows: BoardEntry[] = all
    .slice(page * HISTORY_PAGE, (page + 1) * HISTORY_PAGE)
    .map(({ key: _, upload: __, ticket: ___, detail: ____, ...m }, i) => ({ ...m, id: -(page * HISTORY_PAGE + i + 1) }));
  const sum = (pick: (m: LocalMatch) => number) => all.reduce((total, m) => total + pick(m), 0);
  return {
    rows,
    total: all.length,
    page,
    pageSize: HISTORY_PAGE,
    totals: {
      matches: all.length,
      kills: sum((m) => m.kills),
      deaths: sum((m) => m.deaths),
      assists: sum((m) => m.assists),
      headshots: sum((m) => m.headshots),
      wins: sum((m) => (m.result === 'win' ? 1 : 0)),
      bestScore: Math.max(0, ...all.map((m) => m.score)),
      bestWave: Math.max(0, ...all.map((m) => m.wave)),
      seconds: sum((m) => m.durationS)
    }
  };
}

/** The score panel of a localHistory row; a match kept before details has none. */
export function localDetail(id: number): MatchDetail | null {
  return newestFirst()[-id - 1]?.detail ?? null;
}
