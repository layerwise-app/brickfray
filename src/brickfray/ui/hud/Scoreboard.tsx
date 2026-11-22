import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import type { ScoreRow } from '../../game/hud';
import { TEAM_COLORS } from '../../game/remotes';
import { useHud } from '../App';
import { mapName } from '../board/format';
import { useT } from '../i18n';
import { BotIcon } from '../icons';
import { RunStats } from './RunResult';

export function Swatch({ row }: { row: ScoreRow }) {
  const info = ROSTER[row.character as CharacterId];
  if (!info) return <BotIcon size={22} className='shrink-0 opacity-75' />;
  return <span className='h-6 w-6 shrink-0 rounded-md shadow-[inset_0_-2px_0_rgba(0,0,0,.25)]' style={{ background: `linear-gradient(160deg, ${info.primary} 0 58%, ${info.secondary} 58%)` }} />;
}

const COLUMNS = '30px minmax(0,1fr) 46px 46px 46px 72px 52px';
/** A toy brick plate: lit top lip, shaded bottom, a hard drop below. */
export const PLATE = 'inset 0 2px 0 rgba(255,255,255,.22), inset 0 -3px 0 rgba(0,0,0,.25), 0 3px 0 rgba(0,0,0,.35)';

/** Each player is a brick plate in their team's colour (slate in free-for-all), the local player's plate yellow. */
export function plateColor(r: ScoreRow) {
  if (r.me) return '#ffcd2e';
  return r.team !== -1 ? `color-mix(in srgb, ${TEAM_COLORS[r.team]} 52%, #101a30)` : '#2a3a5e';
}

function Table({ rows }: { rows: ScoreRow[] }) {
  const { t } = useT();
  return (
    <div className='flex flex-col gap-2'>
      <div className='grid items-end px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--bf-muted)]' style={{ gridTemplateColumns: COLUMNS }}>
        <span />
        <span className='pl-1'>{t('player')}</span>
        <span className='text-center'>{t('kills')}</span>
        <span className='text-center'>{t('deaths')}</span>
        <span className='text-center'>{t('assists')}</span>
        <span className='text-right'>{t('score')}</span>
        <span className='pr-1 text-right'>{t('ping')}</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.id}
          className={`relative grid items-center rounded-[10px] py-1.5 pl-1.5 pr-2 ${r.me ? 'text-[#2a1a00]' : 'text-white'}`}
          style={{ gridTemplateColumns: COLUMNS, background: plateColor(r), boxShadow: PLATE }}
        >
          <span className='bf-display relative grid h-7 w-7 place-items-center rounded-md text-base leading-none' style={{ background: r.me ? '#ffe27a' : 'rgba(255,255,255,.14)', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.25)' }}>
            <span className='absolute left-1/2 top-[-4px] h-[5px] w-[11px] -translate-x-1/2 rounded-full' style={{ background: r.me ? '#ffe27a' : 'rgba(255,255,255,.22)' }} />
            {i + 1}
          </span>
          <span className='flex min-w-0 items-center gap-2.5 pl-2 font-bold'>
            <Swatch row={r} />
            <span className='truncate'>{r.name}</span>
            {r.bot && <span className='rounded bg-black/25 px-1.5 text-[10px] font-bold uppercase tracking-wider'>{t('bot')}</span>}
          </span>
          <span className='bf-display text-center text-xl tabular-nums'>{r.kills}</span>
          <span className='bf-display text-center text-xl tabular-nums opacity-80'>{r.deaths}</span>
          <span className='bf-display text-center text-xl tabular-nums opacity-80'>{r.assists}</span>
          <span className='bf-display text-right text-2xl tabular-nums'>{r.score}</span>
          <span className='text-right text-sm font-semibold tabular-nums opacity-70'>{r.bot ? '' : r.ping}</span>
        </div>
      ))}
    </div>
  );
}

/** Held Tab: the room's table, or in solo the run so far (snapbots have no place on a table of players). */
export function Scoreboard() {
  const hud = useHud();
  const { t, lang } = useT();
  const mode = hud.settings?.mode;
  return (
    <div className='bf-scoreboard absolute inset-0 grid place-items-center bg-black/30 p-3'>
      <div className='bf-panel bf-studs bf-fade-in bf-scroll max-h-full w-[min(760px,94vw)] overflow-y-auto p-5'>
        <div className='mb-3 flex items-center justify-between gap-3'>
          <span className='bf-display text-2xl'>{mode === 'solo' ? t('run.title') : mode ? t(`mode.${mode}`) : ''}</span>
          <span className='bf-display truncate text-xl text-[var(--bf-muted)]'>
            {hud.settings && (mode === 'solo' ? `${t(`difficulty.${hud.settings.difficulty}`)} · ${mapName(lang, hud.settings.map)}` : mapName(lang, hud.settings.map))}
          </span>
        </div>
        {mode === 'solo' ? (
          <>
            {hud.phase === 'playing' && hud.waveLeft > 0 && (
              <div className='mb-3 text-sm font-semibold text-white/80'>
                {t('wave', { n: Math.max(1, hud.wave) })} · {t('run.left')} <span className='bf-display text-lg tabular-nums text-[var(--bf-yellow)]'>{hud.waveLeft}</span>
              </div>
            )}
            <RunStats compact />
          </>
        ) : mode === 'tdm' ? (
          <div className='flex flex-col gap-4'>
            {([0, 1] as const).map((team) => (
              <div key={team}>
                <div className='bf-display mb-2 inline-flex items-center gap-3 rounded-lg px-3 py-0.5 text-xl text-white' style={{ background: TEAM_COLORS[team], boxShadow: PLATE }}>
                  {t(`team.${team}`)} <span className='tabular-nums'>{hud.teamScore[team]}</span>
                </div>
                <Table rows={hud.rows.filter((r) => r.team === team)} />
              </div>
            ))}
          </div>
        ) : (
          <Table rows={hud.rows} />
        )}
      </div>
    </div>
  );
}
