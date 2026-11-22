import { TEAM_COLORS } from '../../game/remotes';
import { useT } from '../i18n';
import { CrownIcon } from '../icons';
import { CountUp } from './results-intro';

/** A team match's score as one bar split in the two teams' colours, the winners crowned, the player's team marked. */
export function TeamBar({ score, mine, winner }: { score: [number, number]; mine: number; winner: number | null }) {
  const { t } = useT();
  const total = score[0] + score[1];
  return (
    <div className='bf-teams bf-in' role='img' aria-label={`${t('team.0')} ${score[0]} · ${t('team.1')} ${score[1]}`}>
      {([0, 1] as const).map((team) => (
        <span key={team} className='bf-teams-score bf-display' data-team={team} data-mine={mine === team || undefined} style={{ ['--team' as string]: TEAM_COLORS[team] }} title={t(`team.${team}`)}>
          {winner === team && <CrownIcon size={22} className='bf-teams-crown' />}
          <CountUp value={score[team]} delay={0.35} />
        </span>
      ))}
      <span className='bf-teams-bar' aria-hidden>
        {([0, 1] as const).map((team) => (
          <i key={team} data-team={team} style={{ flexGrow: total ? score[team] : 1, background: TEAM_COLORS[team] }} />
        ))}
      </span>
    </div>
  );
}
