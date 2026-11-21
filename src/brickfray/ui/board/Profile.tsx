import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { CHARACTER_IDS, ROSTER } from '../../characters/roster';
import { saveProfile, uploadAvatar } from '../../../lib/board/board.functions';
import { getPlayerId, markKnown } from '../../../lib/board/client/identity';
import { NAME_MAX, type AccountView, type ProfileView } from '../../../lib/board/contract';
import { cleanName } from '../../../lib/board/validate';
import { useGame } from '../App';
import { useT } from '../i18n';
import { adoptName, useRefreshBoard } from './account';
import { Avatar } from './Avatar';
import { Crop } from './Crop';
import { UploadIcon } from './icons';
import { SignIn } from './SignIn';

type Saved = ProfileView | { refused: 'rate' | 'invalid' };

export function Profile({ account, onName }: { account: AccountView | undefined; onName: (name: string) => void }) {
  const game = useGame();
  const { t } = useT();
  const refresh = useRefreshBoard();
  const profile = account?.profile;
  const [draft, setDraft] = useState<string | null>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // Resolves once the account is fetched again, so a change stays on screen until the server's copy shows it.
  const settle = async (result: Saved) => {
    if ('refused' in result) {
      setNotice(t(result.refused === 'rate' ? 'board.tooFast' : 'board.badPicture'));
      return;
    }
    markKnown();
    setNotice(null);
    await refresh();
  };
  const rename = useMutation({
    mutationFn: (name: string) => saveProfile({ data: { playerId: getPlayerId(), name } }),
    onSuccess: settle
  });
  const pick = useMutation({
    mutationFn: (hero: string) => saveProfile({ data: { playerId: getPlayerId(), hero } }),
    onSuccess: settle
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
    }
  });

  const current = (rename.isPending ? rename.variables : undefined) ?? profile?.name ?? game.settings.name;
  const name = draft ?? current;
  const commitName = () => {
    if (draft === null) return;
    const clean = cleanName(draft);
    setDraft(null);
    if (!clean || clean === current) return;
    adoptName(game, clean, onName);
    rename.mutate(clean);
  };

  const avatar = pick.isPending ? { hero: pick.variables, image: null } : (profile?.avatar ?? null);
  const chosen = avatar?.image ? 'upload' : (avatar?.hero ?? null);

  return (
    <div className='bf-board-tab bf-board-profile bf-scroll'>
      <section className='bf-board-me'>
        <Avatar avatar={avatar} character={game.settings.character} size={88} className='bf-board-me-avatar' />
        <div className='flex min-w-0 flex-1 flex-col gap-2'>
          <label className='bf-board-label' htmlFor='bf-board-name'>
            {t('board.name')}
          </label>
          <input
            id='bf-board-name'
            className='bf-input bf-board-name-input'
            value={name}
            maxLength={NAME_MAX}
            spellCheck={false}
            autoComplete='nickname'
            placeholder={t('namePlaceholder')}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <p className='bf-board-hint'>{account?.signedIn ? t('board.synced') : t('board.guest')}</p>
        </div>
      </section>

      <section className='flex flex-col gap-2'>
        <h3 className='bf-board-label'>{t('board.picture')}</h3>
        <div className='bf-board-pictures'>
          {CHARACTER_IDS.map((id) => (
            <button key={id} className='bf-board-pick' aria-pressed={chosen === id} aria-label={ROSTER[id].name} disabled={pick.isPending} onClick={() => pick.mutate(id)}>
              <Avatar avatar={{ hero: id, image: null }} size={56} />
            </button>
          ))}
          <button className='bf-board-pick bf-board-pick-upload' aria-pressed={chosen === 'upload'} onClick={() => file.current?.click()}>
            {avatar?.image ? <Avatar avatar={avatar} size={56} /> : <UploadIcon size={24} />}
            <span>{t('board.upload')}</span>
          </button>
          <input
            ref={file}
            type='file'
            accept='image/png,image/jpeg,image/webp'
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setPicked(f);
            }}
          />
        </div>
        <p className='bf-board-hint'>{t('board.uploadHint')}</p>
        {notice && (
          <p className='bf-board-error' role='alert'>
            {notice}
          </p>
        )}
      </section>

      <SignIn account={account} onName={onName} />

      {picked && <Crop file={picked} pending={upload.isPending} onCancel={() => setPicked(null)} onDone={(blob) => upload.mutate(blob)} onFail={() => setNotice(t('board.badPicture'))} />}
    </div>
  );
}
