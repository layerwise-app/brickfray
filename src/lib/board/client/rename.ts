import { saveProfile } from '../board.functions';
import { getPlayerId, isKnown } from './identity';

let timer: ReturnType<typeof setTimeout> | undefined;

/** The menu's name field changed: once typing settles, the leaderboard profile takes the new name too. */
export function queueRename(name: string) {
  clearTimeout(timer);
  if (!name.trim()) return;
  timer = setTimeout(() => {
    if (!isKnown()) return;
    // A failed rename is retried by the next one; the next upload never renames.
    saveProfile({ data: { playerId: getPlayerId(), name } }).catch(() => {});
  }, 1500);
}
