import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { authClient } from '../../../lib/auth-client';
import { claimAccount, getAccount } from '../../../lib/board/board.functions';
import { clearLocalMatches } from '../../../lib/board/client/history';
import { freshPlayer, getPlayerId, markKnown, setPlayerId, subscribePlayer } from '../../../lib/board/client/identity';
import { flushMatches } from '../../../lib/board/client/sync';
import type { ProfileView } from '../../../lib/board/contract';
import type { Game } from '../../game/game';

export const BOARD = ['board'] as const;

export function usePlayerId() {
  return useSyncExternalStore(subscribePlayer, getPlayerId, getPlayerId);
}

export function useAccount() {
  const playerId = usePlayerId();
  return useQuery({ queryKey: [...BOARD, 'account', playerId], queryFn: () => getAccount({ data: { playerId } }) });
}

/** The menu's name field and the game's settings follow the profile's name. */
export function adoptName(game: Game, name: string, onName: (name: string) => void) {
  if (name === game.settings.name) return;
  game.applySettings({ ...game.settings, name });
  onName(name);
}

/** After a sign-in: this browser's player and its matches join the account, and the account's name comes here. */
export async function joinAccount(game: Game, onName: (name: string) => void): Promise<ProfileView> {
  const result = await claimAccount({ data: { playerId: getPlayerId(), name: game.settings.name } });
  if ('refused' in result) throw new Error(result.refused);
  if (result.playerId !== getPlayerId()) {
    clearLocalMatches();
    setPlayerId(result.playerId);
  }
  markKnown();
  adoptName(game, result.profile.name, onName);
  await flushMatches(result.profile.name);
  return result.profile;
}

/** Signing out leaves a new guest behind: a fresh id, no local matches, no name. The account keeps its copy. */
export async function leaveAccount(game: Game, onName: (name: string) => void) {
  await flushMatches(game.settings.name);
  await authClient.signOut();
  clearLocalMatches();
  freshPlayer();
  adoptName(game, '', onName);
}

export function useRefreshBoard() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: BOARD });
}
