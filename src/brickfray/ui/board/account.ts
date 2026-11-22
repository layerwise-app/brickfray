import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '../../../lib/auth-client';
import { claimAccount } from '../../../lib/board/board.functions';
import { clearLocalMatches } from '../../../lib/board/client/history';
import { freshPlayer, getPlayerId, markKnown, setPlayerId } from '../../../lib/board/client/identity';
import { flushMatches } from '../../../lib/board/client/sync';
import type { ProfileView } from '../../../lib/board/contract';
import type { Game } from '../../game/game';
import { BOARD, setLocalName } from './me';

/** After a sign-in: this browser's player and its matches join the account, and the account's name comes here. */
export async function joinAccount(game: Game): Promise<ProfileView> {
  const result = await claimAccount({ data: { playerId: getPlayerId(), name: game.settings.name } });
  if ('refused' in result) throw new Error(result.refused);
  if (result.playerId !== getPlayerId()) {
    clearLocalMatches();
    setPlayerId(result.playerId);
  }
  markKnown();
  setLocalName(game, result.profile.name);
  await flushMatches(result.profile.name);
  return result.profile;
}

/** Signing out leaves a new guest behind: a fresh id, no local matches, no name. The account keeps its copy. */
export async function leaveAccount(game: Game) {
  await flushMatches(game.settings.name);
  await authClient.signOut();
  clearLocalMatches();
  freshPlayer();
  setLocalName(game, '');
}

export function useRefreshBoard() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: BOARD });
}
