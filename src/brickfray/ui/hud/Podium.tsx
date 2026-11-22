import { CHARACTER_IDS, ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import type { ScoreRow } from '../../game/hud';
import { TEAM_COLORS } from '../../game/remotes';
import { useApp } from '../App';
import { BotIcon } from '../icons';
import { ordinal } from './standings';
import { useT } from '../i18n';

type Spot = { row: ScoreRow; place: number };

/**
 * The match's result as a toy podium: the top three standing on gold, silver and bronze bricks (second left, first
 * in the middle and tallest, third right), each brick carrying its place. A player who finished lower stands on a
 * low slate brick of their own at the end, with their place on it, so everyone sees where they ended up.
 */
export function Podium({ rows, teams }: { rows: readonly ScoreRow[]; teams: boolean }) {
  const top: Spot[] = rows.slice(0, 3).map((row, i) => ({ row, place: i + 1 }));
  const order = [top[1], top[0], top[2]].filter((s): s is Spot => !!s);
  const mine = rows.findIndex((r) => r.me);
  return (
    <div className='bf-pod' data-count={order.length + (mine >= 3 ? 1 : 0)}>
      <div className='bf-pod-stand'>
        {order.map((s) => (
          <PodiumSpot key={s.row.id} spot={s} teams={teams} />
        ))}
        {mine >= 3 && (
          <>
            <span className='bf-pod-gap bf-in' aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <PodiumSpot spot={{ row: rows[mine]!, place: mine + 1 }} teams={teams} floor />
          </>
        )}
      </div>
      <div className='bf-pod-base bf-in' aria-hidden />
    </div>
  );
}

function PodiumSpot({ spot, teams, floor }: { spot: Spot; teams: boolean; floor?: boolean }) {
  const { lang } = useT();
  const { row, place } = spot;
  return (
    <div className='bf-pod-spot' data-place={floor ? 'floor' : place} data-me={row.me || undefined} aria-label={`${ordinal(lang, place)} · ${row.name}`}>
      <div className='bf-pod-fig bf-in'>
        {row.me && <span className='bf-pod-mark' aria-hidden />}
        <Figure row={row} />
      </div>
      <span className='bf-pod-tag' style={teams && !row.me ? { background: `color-mix(in srgb, ${TEAM_COLORS[row.team] ?? '#2a3a5e'} 70%, #0b1222)` } : undefined}>
        <span className='truncate'>{row.name}</span>
        {row.bot && <BotIcon size={13} className='shrink-0 opacity-70' />}
      </span>
      <div className='bf-pod-block bf-in'>
        <span className='bf-pod-studs' aria-hidden>
          <i />
          <i />
        </span>
        <span className='bf-pod-face'>
          <b className='bf-display'>{place}</b>
        </span>
      </div>
    </div>
  );
}

/** The character's head-and-shoulders shot from the menu, or its colours until the shot is drawn. */
function Figure({ row }: { row: ScoreRow }) {
  const app = useApp();
  const id = CHARACTER_IDS.includes(row.character as CharacterId) ? (row.character as CharacterId) : null;
  const shot = id ? app.portraits[id] : undefined;
  if (shot) return <img src={shot} alt='' draggable={false} />;
  const info = ROSTER[id ?? 'rivet'];
  return <span className='bf-pod-blank' style={{ background: `linear-gradient(160deg, ${info.primary} 0 55%, ${info.secondary} 55%)` }} />;
}
