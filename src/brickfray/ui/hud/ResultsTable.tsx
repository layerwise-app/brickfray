import type { ReactNode } from 'react';
import type { ScoreRow } from '../../game/hud';
import { TEAM_COLORS } from '../../game/remotes';
import { Avatar } from '../board/Avatar';
import { number } from '../board/format';
import { useT, type MessageKey } from '../i18n';
import { BotIcon, CrownIcon, SkullIcon } from '../icons';
import { MedalIcon, type Medal } from './Medal';
import { AssistsIcon, KillsIcon, ScoreIcon, Tip } from './results-art';

export const medalKey = (m: Medal) => `results.medal.${m.kind}.${m.tier}` as MessageKey;

/**
 * Everyone in the match, one brick plate each: place, face, name, medals, kills, deaths, assists, score; the player's
 * own plate yellow. Team matches list each team together, the winners first, each plate edged in its team colour.
 */
export function ResultsTable({ rows, medals, winner, teams }: { rows: readonly ScoreRow[]; medals: Map<number, Medal[]>; winner: number | null; teams: boolean }) {
  const { t } = useT();
  const place = new Map(rows.map((r, i) => [r.id, i + 1]));
  const groups = teams
    ? ([0, 1] as const)
        .map((team) => rows.filter((r) => r.team === team))
        .filter((g) => g.length)
        .sort((a, b) => (b[0]!.team === winner ? 1 : 0) - (a[0]!.team === winner ? 1 : 0))
    : [rows];
  return (
    <div className='bf-table' role='table' data-n={rows.length} style={{ ['--n' as string]: rows.length + (teams ? 1 : 0) }}>
      <div className='bf-table-head' role='row'>
        <span role='columnheader' aria-label='#' />
        <span role='columnheader' className='bf-table-name' aria-label={t('player')} />
        <span role='columnheader' />
        <Head text={t('results.kills')}>
          <KillsIcon size={18} />
        </Head>
        <Head text={t('results.deaths')}>
          <SkullIcon size={18} />
        </Head>
        <Head text={t('results.assists')}>
          <AssistsIcon size={18} />
        </Head>
        <Head text={t('score')} end>
          <ScoreIcon size={18} />
        </Head>
      </div>
      {groups.map((group, g) => (
        <div key={g} className='bf-table-group' role='rowgroup' data-team={teams ? group[0]?.team : undefined} style={teams && group[0] ? { ['--team' as string]: TEAM_COLORS[group[0].team] } : undefined}>
          {group.map((r) => (
            <Row key={r.id} row={r} place={place.get(r.id)!} medals={medals.get(r.id) ?? []} crown={!teams && r.id === winner} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Head({ text, end, children }: { text: string; end?: boolean; children: ReactNode }) {
  return (
    <span role='columnheader' className='bf-table-icon' data-end={end || undefined}>
      <Tip text={text}>{children}</Tip>
    </span>
  );
}

function Row({ row: r, place, medals, crown }: { row: ScoreRow; place: number; medals: Medal[]; crown: boolean }) {
  const { t, lang } = useT();
  return (
    <div role='row' className='bf-table-row bf-in' data-me={r.me || undefined} style={{ ['--i' as string]: place }}>
      <span role='cell' className='bf-display bf-table-place' data-place={place <= 3 ? place : undefined}>
        {place}
      </span>
      <span role='cell' className='bf-table-name'>
        <Avatar character={r.character} size={30} className='bf-table-av' />
        <span className='truncate'>{r.name}</span>
        {crown && <CrownIcon size={16} className='shrink-0 text-[var(--bf-yellow)]' />}
        {r.bot && <BotIcon size={14} className='shrink-0 opacity-60' aria-label={t('bot')} />}
      </span>
      <span role='cell' className='bf-table-medals'>
        {medals.map((m) => (
          <Tip key={m.kind} text={t(medalKey(m))}>
            <MedalIcon medal={m} size={20} />
          </Tip>
        ))}
      </span>
      <span role='cell' className='bf-display bf-table-num'>
        {r.kills}
      </span>
      <span role='cell' className='bf-display bf-table-num' data-soft>
        {r.deaths}
      </span>
      <span role='cell' className='bf-display bf-table-num' data-soft>
        {r.assists}
      </span>
      <span role='cell' className='bf-display bf-table-score'>
        {number(lang, r.score)}
      </span>
    </div>
  );
}
