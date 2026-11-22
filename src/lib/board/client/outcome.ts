import type { MatchSettings } from '~/brickfray/sim/types';
import type { MatchReport } from '../contract';
import { localMatches } from './history';

// The match that just finished, for the end-of-match screen and the "run saved" note: its report, how far its upload
// got, and the player's best before it on this device.

/** sending: on its way; stored: on the board; refused: the server will not rank it; waiting: offline or over the
 * rate limit, sent later; local: it had no ticket and stays on this device. */
export type UploadState = 'sending' | 'stored' | 'refused' | 'waiting' | 'local';

export interface Best {
  wave: number;
  score: number;
}

export interface Outcome {
  /** The settings object of the match it came from: a screen shows only the outcome of its own match. */
  settings: MatchSettings;
  report: MatchReport;
  /** A solo run left before it was over. */
  left: boolean;
  upload: UploadState;
  /** Solo: the best earlier run on this difficulty, on any map and on this map; null when there was none. */
  best: Best | null;
  bestHere: Best | null;
}

let current: Outcome | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeOutcome(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getOutcome() {
  return current;
}

/** Waves rank by the wave reached, then score (the board's order). */
export function beats(a: Best, b: Best | null) {
  return !b || a.wave > b.wave || (a.wave === b.wave && a.score > b.score);
}

function bestOf(matches: readonly Best[]): Best | null {
  let best: Best | null = null;
  for (const m of matches) if (beats(m, best)) best = { wave: m.wave, score: m.score };
  return best;
}

/** Called with a match's report the moment it is made, before it joins this device's history. */
export function publishOutcome(settings: MatchSettings, report: MatchReport, left: boolean) {
  const earlier = report.mode === 'solo' ? localMatches().filter((m) => m.key !== report.key && m.mode === 'solo' && m.difficulty === report.difficulty) : [];
  current = {
    settings,
    report,
    left,
    upload: report.ticket ? 'sending' : 'local',
    best: bestOf(earlier),
    bestHere: bestOf(earlier.filter((m) => m.map === report.map))
  };
  emit();
}

export function settleOutcome(key: string, upload: UploadState) {
  if (!current || current.report.key !== key || current.upload === upload) return;
  current = { ...current, upload };
  emit();
}
