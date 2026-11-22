import { noteNews } from '../../achievements/client/news';
import { uploadMatches } from '../board.functions';
import { UPLOAD_BATCH, type MatchReport } from '../contract';
import { addLocalMatch, localMatches, markUploads, pendingMatches } from './history';
import { getPlayerId, markKnown } from './identity';
import { settleOutcome } from './outcome';

let running: Promise<boolean> | null = null;

/** Sends every match the server does not have yet. True when nothing is left waiting. */
export function flushMatches(name: string): Promise<boolean> {
  running ??= send(name).finally(() => {
    running = null;
  });
  return running;
}

async function send(name: string) {
  try {
    for (let left = pendingMatches(); left.length; left = pendingMatches()) {
      const result = await uploadMatches({ data: { playerId: getPlayerId(), name, matches: left.slice(0, UPLOAD_BATCH) } });
      markUploads(result.stored, 'stored');
      if (result.achievements) noteNews(result.stored, result.achievements);
      markUploads(result.refused, 'refused');
      if (result.stored.length) markKnown();
      if (result.limited || (!result.stored.length && !result.refused.length)) return false;
    }
    return true;
  } catch {
    // Offline or the server is down: the matches wait for the next try.
    return false;
  }
}

/** A match just finished: kept here first, then sent. One that got no ticket stays here only. */
export function recordMatch(report: MatchReport, name: string) {
  addLocalMatch(report, report.ticket ? 'pending' : 'refused');
  if (!report.ticket) return settleOutcome(report.key, 'local');
  // An upload already under way may have read the queue before this match joined it.
  void (running ?? Promise.resolve())
    .then(() => flushMatches(name))
    .then(() => {
      const upload = localMatches().find((m) => m.key === report.key)?.upload;
      settleOutcome(report.key, upload === 'stored' ? 'stored' : upload === 'refused' ? 'refused' : 'waiting');
    });
}
