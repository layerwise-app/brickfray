import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getAccount } from '../../../lib/board/board.functions';
import { getPlayerId, subscribePlayer } from '../../../lib/board/client/identity';
import type { AccountView, ProfileView } from '../../../lib/board/contract';

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
