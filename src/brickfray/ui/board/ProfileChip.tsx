import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type Ref } from 'react';
import { queueRename } from '../../../lib/board/client/rename';
import type { CharacterId } from '../../characters/types';
import { useGame } from '../App';
import { useT } from '../i18n';
import { Avatar } from './Avatar';
import { BOARD, setLocalName, useAccount, useLocalName, useProfileSaved } from './me';

/** The player's picture and Name#1234 in the menu's top-right corner; opens the profile menu. */
export function ProfileChip({ ref, character, open, onOpen }: { ref: Ref<HTMLButtonElement>; character: CharacterId; open: boolean; onOpen: () => void }) {
  const game = useGame();
  const { t } = useT();
  const account = useAccount();
  const local = useLocalName(game);
  const profileSaved = useProfileSaved();
  const client = useQueryClient();
  const joining = useRef(false);
  const data = account.data;
  const profile = data?.profile ?? null;

  // Keeps this device's name and the board's in step with the server: a session this player has not joined yet joins
  // (the account's name comes here), a linked account's name wins (renamed on another device), and a guest's name the
  // server missed (a save that failed offline) goes up again.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the server's view of the account arrives
  useEffect(() => {
    if (!data) return;
    if (data.signedIn && !data.linked) {
      if (joining.current) return;
      joining.current = true;
      import('./account')
        .then(({ joinAccount }) => joinAccount(game))
        .then(() => client.invalidateQueries({ queryKey: BOARD }))
        .catch(() => {})
        .finally(() => (joining.current = false));
    } else if (data.linked && data.profile) {
      setLocalName(game, data.profile.name);
    } else if (!data.signedIn && game.settings.name && data.profile?.name !== game.settings.name) {
      queueRename(game.settings.name, profileSaved);
    }
  }, [data, game]);

  const name = local || profile?.name || t('player');
  const tag = profile?.tag ?? null;
  return (
    <button ref={ref} className='bf-btn bf-btn-ghost bf-menu-me' aria-haspopup='dialog' aria-expanded={open} aria-label={`${t('board.profile')}: ${name}${tag === null ? '' : `#${tag}`}`} onClick={onOpen}>
      <Avatar avatar={profile?.avatar} character={character} size={40} />
      <span className='bf-menu-me-name'>{name}</span>
      {tag !== null && <span className='bf-menu-me-tag'>#{tag}</span>}
    </button>
  );
}
