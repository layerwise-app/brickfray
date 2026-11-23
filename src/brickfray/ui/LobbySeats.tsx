import type { LobbyPlayer } from '../net/protocol';
import { TEAM_COLORS } from '../game/remotes';
import { roomSize } from '../sim/seats';
import type { MatchSettings } from '../sim/types';
import { Avatar } from './board/Avatar';
import { useT } from './i18n';
import { BotIcon, CrownIcon } from './icons';

/** A seat in the room: a player in it, or a bot that will fill it when the match starts. */
type Seat = { player: LobbyPlayer | null; team: 0 | 1 | -1 };

/**
 * The room's seats as the match will fill them: the players in the order they joined, then a bot for every seat no
 * player holds. A team match deals the players out in turn, Blue first, as the host does when it starts, and gives
 * each side the same number of seats.
 */
export function seatsOf(players: readonly LobbyPlayer[], settings: MatchSettings): Seat[] {
  const size = roomSize(settings, players.length);
  if (settings.mode !== 'tdm') return Array.from({ length: size }, (_, i) => ({ player: players[i] ?? null, team: -1 }));
  return ([0, 1] as const).flatMap((team) => {
    const mine = players.filter((_, i) => i % 2 === team);
    return Array.from({ length: size / 2 }, (_, i) => ({ player: mine[i] ?? null, team }));
  });
}

/** The players list: a row per seat, bots greyed; in a team match, the two teams side by side. */
export function LobbySeats({ players, settings }: { players: readonly LobbyPlayer[]; settings: MatchSettings }) {
  const { t } = useT();
  const seats = seatsOf(players, settings);
  if (settings.mode !== 'tdm') {
    return (
      <ul className='flex flex-col gap-1.5'>
        {seats.map((s, i) => (
          <SeatRow key={s.player?.id ?? `bot${i}`} seat={s} />
        ))}
      </ul>
    );
  }
  return (
    <div className='grid grid-cols-2 gap-2'>
      {([0, 1] as const).map((team) => (
        <div key={team} className='flex min-w-0 flex-col gap-1.5'>
          <div className='bf-display rounded-lg px-2.5 py-0.5 text-lg text-white' style={{ background: TEAM_COLORS[team], boxShadow: 'inset 0 2px 0 rgba(255,255,255,.22), inset 0 -3px 0 rgba(0,0,0,.25)' }}>
            {t(`team.${team}`)}
          </div>
          <ul className='flex flex-col gap-1.5'>
            {seats.map((s, i) => (s.team === team ? <SeatRow key={s.player?.id ?? `bot${i}`} seat={s} /> : null))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SeatRow({ seat }: { seat: Seat }) {
  const { t } = useT();
  const p = seat.player;
  if (!p) {
    return (
      <li className='bf-seat flex h-9 items-center gap-2.5 rounded-xl border border-dashed border-white/15 px-2.5 text-[var(--bf-muted)]'>
        <span className='grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10'>
          <BotIcon size={16} />
        </span>
        <span className='truncate text-sm font-semibold'>{t('bot')}</span>
      </li>
    );
  }
  return (
    <li className='bf-seat flex h-11 min-w-0 items-center gap-2.5 rounded-xl bg-white/10 px-2'>
      <Avatar character={p.character} size={30} />
      <span className='truncate font-semibold'>{p.name}</span>
      {p.host && <CrownIcon size={18} className='ml-auto shrink-0 text-[var(--bf-yellow)]' aria-label={t('host')} />}
    </li>
  );
}
