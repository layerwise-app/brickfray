import type { ReactNode } from 'react';
import type { ScoreRow } from '../../game/hud';
import { TEAM_COLORS } from '../../game/remotes';
import { MATCH } from '../../sim/constants';
import { useHud } from '../App';
import { Avatar } from '../board/Avatar';
import { mapName } from '../board/format';
import { useT } from '../i18n';
import { shownName } from './names';
import { SkullIcon } from '../icons';
import { BountyChip, BountyRule } from './Bounty';
import { AssistsIcon, KillsIcon, ScoreIcon } from './results-art';
import { RunStats } from './RunResult';

/** A toy brick plate: lit top lip, shaded bottom, a hard drop below. */
export const PLATE = 'inset 0 2px 0 rgba(255,255,255,.22), inset 0 -3px 0 rgba(0,0,0,.25), 0 3px 0 rgba(0,0,0,.35)';

/** Each player is a brick plate in their team's colour (slate in free-for-all), the local player's plate yellow. */
export function plateColor(r: ScoreRow) {
  if (r.me) return '#ffcd2e';
  return r.team !== -1 ? `color-mix(in srgb, ${TEAM_COLORS[r.team]} 52%, #101a30)` : '#2a3a5e';
}

/** A column's icon over its word, as on the results table. */
function Head({ text, end, children }: { text: string; end?: boolean; children: ReactNode }) {
  return (
    <span className={`flex flex-col gap-0.5 ${end ? 'items-end' : 'items-center'}`} aria-label={text}>
      {children}
      <small className='whitespace-nowrap text-[10.5px] font-bold leading-none' aria-hidden>
        {text}
      </small>
    </span>
  );
}

/**
 * One table of players in the room's order. A free-for-all numbers its places; a team's table does not (its team's
 * score is its place). Ping shows only when someone else plays over the network.
 */
function Table({ rows, places, ping }: { rows: ScoreRow[]; places: boolean; ping: boolean }) {
  const { t } = useT();
  const columns = `${places ? '30px ' : ''}minmax(0,1fr) 50px 50px 50px 76px${ping ? ' 48px' : ''}`;
  return (
    <div className='flex flex-col gap-2'>
      <div className='grid items-end px-2 text-[var(--bf-muted)]' style={{ gridTemplateColumns: columns }}>
        {places && <span />}
        <span className='pl-1 text-[11px] font-bold uppercase tracking-[0.16em]'>{t('player')}</span>
        <Head text={t('col.kills')}>
          <KillsIcon size={16} />
        </Head>
        <Head text={t('col.deaths')}>
          <SkullIcon size={16} />
        </Head>
        <Head text={t('col.assists')}>
          <AssistsIcon size={16} />
        </Head>
        <Head text={t('col.score')} end>
          <ScoreIcon size={16} />
        </Head>
        {ping && <span className='pr-1 text-right text-[10.5px] font-bold leading-none'>{t('col.ping')}</span>}
      </div>
      {rows.map((r, i) => (
        <div
          key={r.id}
          className={`relative grid items-center rounded-[10px] py-1.5 pl-1.5 pr-2 ${r.me ? 'text-[#2a1a00]' : 'text-white'}`}
          style={{ gridTemplateColumns: columns, background: plateColor(r), boxShadow: PLATE }}
        >
          {places && (
            <span className='bf-display relative grid h-7 w-7 place-items-center rounded-md text-base leading-none' style={{ background: r.me ? '#ffe27a' : 'rgba(255,255,255,.14)', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.25)' }}>
              <span className='absolute left-1/2 top-[-4px] h-[5px] w-[11px] -translate-x-1/2 rounded-full' style={{ background: r.me ? '#ffe27a' : 'rgba(255,255,255,.22)' }} />
              {i + 1}
            </span>
          )}
          <span className='flex min-w-0 items-center gap-2.5 pl-2 font-bold'>
            <Avatar character={r.character} size={28} />
            <span className='truncate'>{shownName(t, r.name, r.character)}</span>
            {r.bot && <span className='rounded bg-black/25 px-1.5 text-[10px] font-bold uppercase tracking-wider'>{t('bot')}</span>}
            {!!r.bounty && <BountyChip amount={r.bounty} size='sm' />}
          </span>
          <span className='bf-display text-center text-xl tabular-nums'>{r.kills}</span>
          <span className='bf-display text-center text-xl tabular-nums opacity-80'>{r.deaths}</span>
          <span className='bf-display text-center text-xl tabular-nums opacity-80'>{r.assists}</span>
          <span className='bf-display text-right text-2xl tabular-nums'>{r.score}</span>
          {ping && <span className='text-right text-sm font-semibold tabular-nums opacity-70'>{r.bot ? '–' : r.ping}</span>}
        </div>
      ))}
    </div>
  );
}

/** What decides the room, above how the bounty works. */
function Rules({ mode }: { mode: 'ffa' | 'tdm' }) {
  const { t } = useT();
  return (
    <>
      <p className='mt-3 text-[13px] font-semibold leading-snug text-white/85'>{t(`rule.${mode}`, { n: mode === 'ffa' ? MATCH.ffaKills : MATCH.tdmKills })}</p>
      <BountyRule />
    </>
  );
}

/** Held Tab: the room's table, or in solo the run so far (snapbots have no place on a table of players). */
export function Scoreboard() {
  const hud = useHud();
  const { t, lang } = useT();
  const mode = hud.settings?.mode;
  const ping = hud.rows.filter((r) => !r.bot).length > 1;
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
                <Table rows={hud.rows.filter((r) => r.team === team)} places={false} ping={ping} />
              </div>
            ))}
          </div>
        ) : (
          <Table rows={hud.rows} places ping={ping} />
        )}
        {mode && mode !== 'solo' && <Rules mode={mode} />}
      </div>
    </div>
  );
}
