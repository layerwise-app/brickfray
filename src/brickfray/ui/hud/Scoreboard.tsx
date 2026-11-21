import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import type { ScoreRow } from '../../game/hud';
import { TEAM_COLORS } from '../../game/remotes';
import { useGame, useHud } from '../App';
import { useT } from '../i18n';
import { BotIcon, CrownIcon, DoorIcon } from '../icons';

function Swatch({ row }: { row: ScoreRow }) {
  const info = ROSTER[row.character as CharacterId];
  if (!info) return <BotIcon size={22} className='shrink-0 opacity-75' />;
  return <span className='h-6 w-6 shrink-0 rounded-md shadow-[inset_0_-2px_0_rgba(0,0,0,.25)]' style={{ background: `linear-gradient(160deg, ${info.primary} 0 58%, ${info.secondary} 58%)` }} />;
}

const COLUMNS = '30px minmax(0,1fr) 46px 46px 46px 72px 52px';
/** A toy brick plate: lit top lip, shaded bottom, a hard drop below. */
const PLATE = 'inset 0 2px 0 rgba(255,255,255,.22), inset 0 -3px 0 rgba(0,0,0,.25), 0 3px 0 rgba(0,0,0,.35)';

/** Each player is a brick plate in their team's colour (slate in free-for-all), the local player's plate yellow. */
function plateColor(r: ScoreRow) {
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

export function Scoreboard() {
  const hud = useHud();
  const { t } = useT();
  const mode = hud.settings?.mode;
  return (
    <div className='absolute inset-0 grid place-items-center bg-black/30'>
      <div className='bf-panel bf-studs bf-fade-in w-[min(760px,94vw)] p-5'>
        <div className='mb-3 flex items-center justify-between'>
          <span className='bf-display text-2xl'>{mode ? t(`mode.${mode}`) : ''}</span>
          <span className='bf-display text-xl text-[var(--bf-muted)]'>{hud.settings ? t(`map.${hud.settings.map}`) : ''}</span>
        </div>
        {mode === 'tdm' ? (
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

export function Results() {
  const hud = useHud();
  const game = useGame();
  const { t } = useT();
  const mode = hud.settings?.mode;
  const me = hud.rows.find((r) => r.me);
  let title: string;
  let good = false;
  if (mode === 'solo') title = t('gameOver');
  else if (mode === 'tdm') {
    if (hud.winner === null) title = t('draw');
    else {
      good = hud.winner === hud.myTeam;
      title = good ? t('victory') : t('defeat');
    }
  } else {
    good = !!me && hud.winner === me.id;
    const winner = hud.rows.find((r) => r.id === hud.winner);
    title = good ? t('victory') : winner ? t('wins', { name: winner.name }) : t('draw');
  }
  return (
    <div className='pointer-events-auto absolute inset-0 grid place-items-center bg-[#0b1222]/70 backdrop-blur-sm'>
      <div className='bf-pop flex w-[min(760px,94vw)] flex-col items-center gap-5'>
        <div className='flex items-center gap-3'>
          {good && <CrownIcon size={44} className='text-[var(--bf-yellow)]' />}
          <h2 className={`bf-display text-7xl ${good ? 'text-[var(--bf-yellow)]' : ''}`}>{title}</h2>
        </div>
        {mode === 'solo' && hud.settings && (
          <div className='bf-display text-3xl text-white/85'>
            {t('reachedWave', { n: Math.max(1, hud.wave) })} · {t(`difficulty.${hud.settings.difficulty}`)}
          </div>
        )}
        <div className='bf-panel bf-studs w-full p-5'>
          <Table rows={hud.rows} />
        </div>
        <div className='flex items-center gap-4'>
          {mode !== 'solo' && <span className='font-semibold text-white/75'>{t('backToLobby', { n: Math.ceil(hud.phaseLeft) })}</span>}
          {mode === 'solo' && (
            <button className='bf-btn bf-btn-primary' onClick={() => game.startMatch()}>
              <span className='font-bold'>{t('playAgain')}</span>
            </button>
          )}
          <button className='bf-btn bf-btn-red' onClick={() => game.leave()}>
            <DoorIcon size={18} />
            {t('leave')}
          </button>
        </div>
      </div>
    </div>
  );
}
