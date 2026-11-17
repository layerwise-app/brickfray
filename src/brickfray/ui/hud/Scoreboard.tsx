import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import type { ScoreRow } from '../../game/hud';
import { TEAM_COLORS } from '../../game/remotes';
import { useGame, useHud } from '../App';
import { useT } from '../i18n';
import { BotIcon, CrownIcon, DoorIcon } from '../icons';

function Swatch({ row }: { row: ScoreRow }) {
  const info = ROSTER[row.character as CharacterId];
  if (!info) return <BotIcon size={22} className='text-white/70' />;
  return <span className='h-6 w-6 shrink-0 rounded-md' style={{ background: `linear-gradient(160deg, ${info.primary} 0 58%, ${info.secondary} 58%)` }} />;
}

function Table({ rows }: { rows: ScoreRow[] }) {
  const { t } = useT();
  return (
    <table className='w-full border-separate border-spacing-y-1 text-left'>
      <thead>
        <tr className='text-xs uppercase tracking-[0.16em] text-[var(--bf-muted)]'>
          <th className='px-3 font-semibold'>{t('player')}</th>
          <th className='w-12 text-center font-semibold'>{t('kills')}</th>
          <th className='w-12 text-center font-semibold'>{t('deaths')}</th>
          <th className='w-12 text-center font-semibold'>{t('assists')}</th>
          <th className='w-20 text-right font-semibold'>{t('score')}</th>
          <th className='w-16 pr-3 text-right font-semibold'>{t('ping')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={r.me ? 'bg-[var(--bf-yellow)]/90 text-[#2a1a00]' : 'bg-white/6'}>
            <td className='rounded-l-lg px-3 py-1.5'>
              <span className='flex items-center gap-2.5 font-semibold'>
                <Swatch row={r} />
                <span style={{ color: !r.me && r.team !== -1 ? TEAM_COLORS[r.team] : undefined }}>{r.name}</span>
                {r.bot && <span className='rounded bg-black/25 px-1.5 text-[10px] font-bold uppercase tracking-wider'>{t('bot')}</span>}
              </span>
            </td>
            <td className='bf-display text-center text-lg tabular-nums'>{r.kills}</td>
            <td className='bf-display text-center text-lg tabular-nums'>{r.deaths}</td>
            <td className='bf-display text-center text-lg tabular-nums'>{r.assists}</td>
            <td className='bf-display text-right text-lg tabular-nums'>{r.score}</td>
            <td className='rounded-r-lg pr-3 text-right text-sm tabular-nums opacity-75'>{r.bot ? '' : r.ping}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
                <div className='bf-display mb-1 flex items-center gap-3 text-xl' style={{ color: TEAM_COLORS[team] }}>
                  {t(`team.${team}`)} <span className='text-white'>{hud.teamScore[team]}</span>
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
        {mode === 'solo' && <div className='bf-display text-3xl text-white/85'>{t('reachedWave', { n: Math.max(1, hud.wave) })}</div>}
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
