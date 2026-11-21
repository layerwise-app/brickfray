import type { MatchSettings } from '~/brickfray/sim/types';
import { startMatch } from '../board.functions';
import type { MatchStart } from '../contract';
import { getPlayerId } from './identity';

/** Asks the server for the ticket of a match that is starting. Null when it can't be had: the match then stays off the leaderboard. */
export async function requestTicket(settings: MatchSettings): Promise<MatchStart | null> {
  try {
    const solo = settings.mode === 'solo';
    const result = await startMatch({ data: { playerId: getPlayerId(), mode: settings.mode, map: settings.map, difficulty: solo ? settings.difficulty : null } });
    return 'refused' in result ? null : result;
  } catch {
    return null;
  }
}
