import { localMatches } from '../../../lib/board/client/history';
import type { BotKind } from '../../characters/types';
import { DIFFICULTIES, type MatchSettings } from '../../sim/types';
import { MAP_IDS } from '../../game/settings';
import { mapName } from '../board/format';
import { useT } from '../i18n';
import { BotFace } from './SoloHud';

const KINDS: readonly BotKind[] = ['grunt', 'rusher', 'sniper', 'boss'];

/** The four snapbot kinds a run meets, each with what it does. */
export function SnapbotPrimer() {
  const { t } = useT();
  return (
    <div className='flex flex-col gap-2'>
      <div className='text-xs font-semibold uppercase tracking-[0.2em] text-[var(--bf-muted)]'>{t('lobby.kinds')}</div>
      <ul className='grid gap-2 sm:grid-cols-2'>
        {KINDS.map((kind) => (
          <li key={kind} className='flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2'>
            <BotFace kind={kind} size={38} />
            <span className='flex min-w-0 flex-col'>
              <span className='bf-display text-lg leading-tight'>{t(`kind.${kind}`)}</span>
              <span className='text-xs font-medium leading-snug text-white/70'>{t(`kindHint.${kind}`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The solo setup's side panel: what a run is, and the player's best wave on each map and difficulty. */
export function SoloBrief({ settings }: { settings: MatchSettings }) {
  const { t, lang } = useT();
  const best = new Map<string, number>();
  for (const m of localMatches()) {
    if (m.mode !== 'solo' || !m.difficulty) continue;
    const at = `${m.map}:${m.difficulty}`;
    best.set(at, Math.max(best.get(at) ?? 0, m.wave));
  }
  return (
    <div className='flex flex-col gap-3'>
      <p className='text-sm font-medium leading-snug text-white/85'>{t('lobby.how')}</p>
      <div className='rounded-xl bg-black/25 p-3'>
        <div className='mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bf-muted)]'>
          {t('lobby.best')} · {t('board.col.wave')}
        </div>
        <table className='w-full border-separate border-spacing-y-1 text-sm'>
          <thead>
            <tr>
              <th />
              {DIFFICULTIES.map((d) => (
                <th key={d} scope='col' className='pb-0.5 text-center text-xs font-semibold' style={{ color: d === settings.difficulty ? 'var(--bf-yellow)' : 'var(--bf-muted)' }}>
                  {t(`difficulty.${d}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MAP_IDS.map((map) => (
              <tr key={map}>
                <th scope='row' className='pr-2 text-left font-semibold' style={{ color: map === settings.map ? '#fff' : 'rgba(255,255,255,.7)' }}>
                  {mapName(lang, map)}
                </th>
                {DIFFICULTIES.map((d) => {
                  const wave = best.get(`${map}:${d}`);
                  const chosen = map === settings.map && d === settings.difficulty;
                  return (
                    <td key={d} className='text-center'>
                      <span
                        className={`bf-display inline-grid h-7 min-w-11 place-items-center rounded-md px-1.5 text-lg leading-none tabular-nums ${wave ? 'text-white' : 'text-white/30'}`}
                        style={{ background: chosen ? 'rgba(255,205,46,.18)' : 'rgba(255,255,255,.05)', boxShadow: chosen ? 'inset 0 0 0 2px var(--bf-yellow)' : undefined }}
                      >
                        {wave ?? '–'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {best.size === 0 && <p className='mt-1 text-center text-xs font-semibold text-[var(--bf-muted)]'>{t('lobby.noRuns')}</p>}
      </div>
    </div>
  );
}
