import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { CHARACTER_IDS, ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import { saveProfile, uploadAvatar } from '../../../lib/board/board.functions';
import { getPlayerId, markKnown } from '../../../lib/board/client/identity';
import type { Avatar as AvatarData, ProfileView } from '../../../lib/board/contract';
import { useT } from '../i18n';
import { HistoryIcon } from '../icons';
import { useRefreshBoard } from './account';
import { Avatar } from './Avatar';
import { Crop } from './Crop';
import { ChevronIcon, UploadIcon } from './icons';
import { useAccount } from './me';
import { NameField } from './NameField';
import { SignIn } from './SignIn';
import './profile.css';

type Saved = ProfileView | { refused: 'rate' | 'invalid' };

/** The profile element's menu, under its button in the menu's corner: name, picture, own matches and sign-in. */
export default function ProfilePanel({ character, onClose, onMatches }: { character: CharacterId; onClose: () => void; onMatches: () => void }) {
  const { t } = useT();
  const account = useAccount();
  const panel = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = useRefreshBoard();
  const data = account.data;
  const profile = data?.profile ?? null;

  // Esc leaves the field first (which saves the name), then closes; the crop dialog takes its own Esc before this.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      (document.activeElement as HTMLElement | null)?.blur();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus starts in the panel (not the field: a phone would open its keyboard).
  useEffect(() => panel.current?.focus(), []);

  // Resolves once the account is fetched again, so a new picture stays on screen until the server's copy shows it.
  const settle = async (result: Saved) => {
    if ('refused' in result) return setNotice(t(result.refused === 'rate' ? 'board.tooFast' : 'board.badPicture'));
    markKnown();
    setNotice(null);
    await refresh();
  };
  const pick = useMutation({
    mutationFn: (hero: string) => saveProfile({ data: { playerId: getPlayerId(), hero } }),
    onSuccess: settle,
    onError: () => setNotice(t('board.error'))
  });
  const upload = useMutation({
    mutationFn: (blob: Blob) => {
      const form = new FormData();
      form.set('playerId', getPlayerId());
      form.set('file', blob);
      return uploadAvatar({ data: form });
    },
    onSuccess: async (result) => {
      await settle(result);
      if (!('refused' in result)) setPicked(null);
    },
    onError: () => setNotice(t('board.badPicture'))
  });
  const avatar: AvatarData | null = pick.isPending ? { hero: pick.variables, image: null } : (profile?.avatar ?? null);

  return (
    <div className='bf-me-layer' onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={panel} tabIndex={-1} role='dialog' aria-modal aria-label={t('board.profile')} className='bf-panel bf-studs bf-pop bf-me-panel'>
        <div className='bf-me-body bf-scroll'>
          <NameField saved={profile?.name ?? null} tag={profile?.tag ?? null}>
            <Avatar avatar={avatar} character={character} size={60} />
          </NameField>
          <Pictures avatar={avatar} busy={pick.isPending} onHero={(id) => pick.mutate(id)} onFile={setPicked} />
          {notice && (
            <p className='bf-me-error' role='alert'>
              {notice}
            </p>
          )}
          <button className='bf-me-row' onClick={onMatches}>
            <HistoryIcon size={20} />
            <span>{t('board.myMatches')}</span>
            <ChevronIcon size={16} flip />
          </button>
          <SignIn account={data} />
        </div>
      </section>
      {picked && <Crop file={picked} pending={upload.isPending} onCancel={() => setPicked(null)} onDone={(blob) => upload.mutate(blob)} onFail={() => setNotice(t('board.badPicture'))} />}
    </div>
  );
}

function Pictures({ avatar, busy, onHero, onFile }: { avatar: AvatarData | null; busy: boolean; onHero: (id: CharacterId) => void; onFile: (file: File) => void }) {
  const { t } = useT();
  const file = useRef<HTMLInputElement>(null);
  const chosen = avatar?.image ? 'upload' : (avatar?.hero ?? null);
  return (
    <section className='bf-me-section'>
      <h3 className='bf-me-label'>{t('board.picture')}</h3>
      <div className='bf-me-pictures'>
        {CHARACTER_IDS.map((id) => (
          <button key={id} className='bf-me-pick' aria-pressed={chosen === id} aria-label={ROSTER[id].name} disabled={busy} onClick={() => onHero(id)}>
            <Avatar avatar={{ hero: id, image: null }} size={48} />
          </button>
        ))}
        <button className='bf-me-pick bf-me-pick-upload' aria-pressed={chosen === 'upload'} aria-label={t('board.upload')} title={t('board.upload')} onClick={() => file.current?.click()}>
          {avatar?.image ? <Avatar avatar={avatar} size={48} /> : <UploadIcon size={22} />}
        </button>
        <input
          ref={file}
          type='file'
          accept='image/png,image/jpeg,image/webp'
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onFile(f);
          }}
        />
      </div>
    </section>
  );
}
