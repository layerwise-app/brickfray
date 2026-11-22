import { saveProfile } from '../board.functions';
import type { ProfileView } from '../contract';
import { getPlayerId, markKnown } from './identity';

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * The menu's name field changed: once typing settles, the leaderboard profile takes the new name (made now if the
 * server has none yet, so the tag shows at once). `onSaved` gets the profile back, with a new tag if the name had ours.
 */
export function queueRename(name: string, onSaved: (profile: ProfileView) => void) {
  clearTimeout(timer);
  if (!name) return;
  timer = setTimeout(() => {
    // A failed rename is retried by the next one; the next upload never renames.
    saveProfile({ data: { playerId: getPlayerId(), name } })
      .then((result) => {
        if ('refused' in result) return;
        markKnown();
        onSaved(result);
      })
      .catch(() => {});
  }, 1500);
}
