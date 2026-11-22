import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getAccount } from '../../../lib/board/board.functions';
import { getPlayerId, subscribePlayer } from '../../../lib/board/client/identity';
import type { AccountView, ProfileView } from '../../../lib/board/contract';
import type { Game } from '../../game/game';

// The player's own board identity, light enough for the main menu (the sign-in client stays in account.ts).

export const BOARD = ['board'] as const;

export function usePlayerId() {
  return useSyncExternalStore(subscribePlayer, getPlayerId, getPlayerId);
}

export function useAccount() {
  const playerId = usePlayerId();
  return useQuery({ queryKey: [...BOARD, 'account', playerId], queryFn: () => getAccount({ data: { playerId } }) });
}

/** A profile the server just returned (a rename may have moved its tag): every view of the name and tag follows at once. */
export function useProfileSaved() {
  const client = useQueryClient();
  return (profile: ProfileView) => {
    const key = [...BOARD, 'account', getPlayerId()];
    if (client.getQueryData<AccountView>(key)) client.setQueryData<AccountView>(key, (old) => old && { ...old, profile });
    void client.invalidateQueries({ queryKey: BOARD });
  };
}

const nameListeners = new Set<() => void>();
const subscribeName = (fn: () => void) => {
  nameListeners.add(fn);
  return () => {
    nameListeners.delete(fn);
  };
};

/** The name this device plays under (the game's settings), for every view that shows it. */
export function useLocalName(game: Game) {
  return useSyncExternalStore(
    subscribeName,
    () => game.settings.name,
    () => ''
  );
}

export function setLocalName(game: Game, name: string) {
  if (name === game.settings.name) return;
  game.applySettings({ ...game.settings, name });
  for (const fn of nameListeners) fn();
}
