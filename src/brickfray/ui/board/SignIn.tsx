import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import type { AccountView } from '../../../lib/board/contract';
import { useGame } from '../App';
import { useT, type MessageKey } from '../i18n';
import { joinAccount, leaveAccount, useRefreshBoard } from './account';
import { PendingButton } from './Avatar';
import { MailIcon } from './icons';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What a failed code check tells the player: better-auth's codes mapped to the game's words. */
function codeError(code: string | undefined): MessageKey {
  if (code === 'OTP_EXPIRED') return 'board.codeExpired';
  if (code === 'TOO_MANY_ATTEMPTS') return 'board.codeTries';
  if (code === 'JOIN') return 'board.error';
  return 'board.badCode';
}

/** Optional email sign-in with a one-time code, or the signed-in account and its sign-out. */
export function SignIn({ account }: { account: AccountView | undefined }) {
  const game = useGame();
  const { t } = useT();
  const refresh = useRefreshBoard();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  const send = useMutation({
    mutationFn: async (to: string) => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email: to, type: 'sign-in' });
      if (error) throw new Error(error.code ?? 'send');
      return to;
    },
    onSuccess: (to) => {
      setSentTo(to);
      setCode('');
      setError(null);
    },
    onError: () => setError('board.sendFailed')
  });
  const verify = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signIn.emailOtp({ email: sentTo!, otp: code.trim() });
      if (error) throw new Error(error.code ?? 'otp');
      // Signed in but not joined yet: the panel joins again the next time it reads the account.
      await joinAccount(game).catch(() => {
        throw new Error('JOIN');
      });
    },
    onSuccess: async () => {
      setSentTo(null);
      setError(null);
      await refresh();
    },
    onError: (e) => setError(codeError(e.message))
  });
  const leave = useMutation({
    mutationFn: () => leaveAccount(game),
    onSuccess: () => refresh()
  });

  if (account?.signedIn) {
    return (
      <section className='bf-me-account'>
        <p className='bf-me-signed' title={account.email ?? undefined}>
          <MailIcon size={18} />
          <span className='truncate'>{t('board.signedInAs', { email: account.email ?? '' })}</span>
        </p>
        <div className='flex flex-wrap items-center gap-3'>
          <PendingButton className='bf-btn-ghost !h-11' pending={leave.isPending} onClick={() => leave.mutate()}>
            {t('board.signOut')}
          </PendingButton>
          <span className='bf-me-hint'>{t('board.signOutHint')}</span>
        </div>
      </section>
    );
  }

  return (
    <section className='bf-me-account'>
      <h3 className='bf-me-label'>{t('board.signIn')}</h3>
      <p className='bf-me-hint'>{t('board.signInWhy')}</p>
      {!sentTo ? (
        <form
          className='bf-me-form'
          onSubmit={(e) => {
            e.preventDefault();
            const to = email.trim().toLowerCase();
            if (!EMAIL.test(to)) return setError('board.badEmail');
            send.mutate(to);
          }}
        >
          <input
            className='bf-input flex-1'
            type='email'
            inputMode='email'
            autoComplete='email'
            placeholder={t('board.email')}
            aria-label={t('board.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PendingButton type='submit' className='bf-btn-primary !h-11' pending={send.isPending}>
            {t('board.sendCode')}
          </PendingButton>
        </form>
      ) : (
        <>
          <p className='bf-me-hint'>{t('board.codeSent', { email: sentTo })}</p>
          <form
            className='bf-me-form'
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().length === 6) verify.mutate();
            }}
          >
            <input
              className='bf-input bf-display bf-me-code'
              inputMode='numeric'
              autoComplete='one-time-code'
              pattern='[0-9]*'
              maxLength={6}
              placeholder='000000'
              aria-label={t('board.code')}
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <PendingButton type='submit' className='bf-btn-primary !h-11' pending={verify.isPending} disabled={code.length !== 6}>
              {t('board.signIn')}
            </PendingButton>
          </form>
          <div className='flex flex-wrap gap-x-4 gap-y-1'>
            <button className='bf-me-link' disabled={send.isPending} onClick={() => send.mutate(sentTo)}>
              {t('board.resend')}
            </button>
            <button
              className='bf-me-link'
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
            >
              {t('board.otherEmail')}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className='bf-me-error' role='alert'>
          {t(error)}
        </p>
      )}
    </section>
  );
}
