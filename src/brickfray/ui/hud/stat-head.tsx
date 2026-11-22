import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { SkullIcon } from '../icons';
import { AccuracyIcon, AssistsIcon, HeadshotsIcon, KillsIcon, ScoreIcon, TimeIcon } from './results-art';

export type Stat = 'kills' | 'deaths' | 'assists' | 'score' | 'headshots' | 'accuracy' | 'time';

/** The one mark each number wears everywhere it is shown: results, the Tab table, the leaderboard. */
export function StatIcon({ stat, size = 16, className }: { stat: Stat; size?: number; className?: string }) {
  const p = { size, className };
  const icons: Record<Stat, ReactNode> = {
    kills: <KillsIcon {...p} />,
    deaths: <SkullIcon {...p} />,
    assists: <AssistsIcon {...p} />,
    score: <ScoreIcon {...p} />,
    headshots: <HeadshotsIcon {...p} />,
    accuracy: <AccuracyIcon {...p} />,
    time: <TimeIcon {...p} />
  };
  return icons[stat];
}

/** A column head: the stat's mark over its word. */
export function StatHead({ stat, size = 16, className = '' }: { stat: Stat; size?: number; className?: string }) {
  const { t } = useT();
  const word = t(`col.${stat}`);
  return (
    <span className={`bf-stat-head ${className}`} aria-label={word}>
      <StatIcon stat={stat} size={size} />
      <small aria-hidden>{word}</small>
    </span>
  );
}
