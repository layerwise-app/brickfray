import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { db } from '~/db';
import { BoardError } from '../board/contract';
import { findPlayer } from '../board/players';
import { allowAll, HOUR, ipKey, MINUTE } from '../board/rate';
import { playerId } from '../board/validate';
import type { AchievementsPage } from './contract';
import { achievementsPage } from './store';

/** The asker's achievements (their account's, when this browser joined one). Counts any match not counted yet. */
export const getAchievements = createServerFn({ method: 'GET' })
  .validator((raw: { playerId: string }) => {
    if (!raw || typeof raw !== 'object') throw new BoardError('invalid', 'not an object');
    return { playerId: playerId(raw.playerId) };
  })
  .handler(async ({ data }): Promise<AchievementsPage | { refused: 'rate' }> => {
    const now = Date.now();
    const ip = await ipKey(getRequestHeader('cf-connecting-ip') ?? getRequestHeader('x-real-ip') ?? 'unknown');
    const ok = await allowAll(
      db,
      [
        [`ach:p:${data.playerId}`, 60, 10 * MINUTE],
        [`ach:ip:${ip}`, 600, HOUR]
      ],
      now
    );
    if (!ok) return { refused: 'rate' };
    const player = await findPlayer(db, data.playerId);
    return achievementsPage(db, player?.profileId ?? null, now);
  });
