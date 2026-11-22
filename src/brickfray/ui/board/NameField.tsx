import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { saveProfile } from '../../../lib/board/board.functions';
import { getPlayerId, markKnown } from '../../../lib/board/client/identity';
import { NAME_MAX, nameText } from '../../../lib/board/names';
import { useGame } from '../App';
import { useT, type MessageKey } from '../i18n';
import { setLocalName, useLocalName, useProfileSaved } from './me';
import { nameProblem } from './name-check';

const ERROR_ID = 'bf-me-name-error';

/**
 * The player's name, edited in place and saved when the field is left (Enter, a tap elsewhere). Nothing shows under it
 * while the name is fine: one line appears when the typed name breaks the rule or the save fails, and goes with the cause.
 */
export function NameField({ saved, tag, children }: { saved: string | null; tag: number | null; children: ReactNode }) {
  const game = useGame();
  const { t } = useT();
  const local = useLocalName(game);
  const profileSaved = useProfileSaved();
  const [draft, setDraft] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [failure, setFailure] = useState<{ name: string; key: MessageKey } | null>(null);
  const rename = useMutation({
    mutationFn: (name: string) => saveProfile({ data: { playerId: getPlayerId(), name } }),
    onSuccess: (result, name) => {
      if ('refused' in result) return setFailure({ name, key: 'board.tooFast' });
      markKnown();
      setFailure(null);
      profileSaved(result);
    },
    onError: (_, name) => setFailure({ name, key: 'board.nameFailed' })
  });

  const current = local || saved || '';
  const value = draft ?? current;
  // An input method's text passes as typed (pinyin with its spaces) until it is committed.
  const problem = draft === null || composing ? null : nameProblem(draft);
  const error = problem
    ? problem.kind === 'char'
      ? t('board.nameBadChar', { char: problem.char })
      : problem.kind === 'space'
        ? t('board.nameSpace')
        : t('board.nameLong', { n: NAME_MAX })
    : draft === null && failure?.name === current
      ? t(failure.key)
      : null;

  // A name the server does not have yet is saved, so one whose save failed goes again when the field is left again.
  const commit = () => {
    if (composing || (draft !== null && nameProblem(draft))) return;
    const next = draft === null ? current : nameText(draft);
    setDraft(null);
    if (!next) return;
    setLocalName(game, next);
    if (next !== saved) rename.mutate(next);
  };

  return (
    <div className='bf-me-name'>
      <div className='bf-me-id'>
        {children}
        <label className='bf-me-field' data-invalid={!!problem || undefined}>
          <input
            className='bf-me-input'
            value={value}
            spellCheck={false}
            autoComplete='nickname'
            enterKeyHint='done'
            placeholder={t('namePlaceholder')}
            aria-label={t('namePlaceholder')}
            aria-invalid={!!problem}
            aria-describedby={error ? ERROR_ID : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setFailure(null);
            }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              setDraft(e.currentTarget.value);
            }}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
          />
          {tag !== null && <span className='bf-me-tag'>#{tag}</span>}
        </label>
      </div>
      {error && (
        <p id={ERROR_ID} className='bf-me-error' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
}
