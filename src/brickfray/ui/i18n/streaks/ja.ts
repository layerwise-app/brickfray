import type { streaksEn } from './en';

export const streaksJa: Record<keyof typeof streaksEn, string> = {
  'streak.2': 'ダブルキル',
  'streak.3': 'トリプルキル',
  'streak.4': 'クアドラキル',
  'streak.5': 'ペンタキル',
  'streak.6': 'ヘキサキル',
  'bounty.collected': '賞金 +{n}',
  'bounty.on': '賞金首 {n}',
  'bounty.rule': '勝敗はキル数で決まります。3 連続キルから賞金首になり、1 キルごとに +25（最大 +150）。倒したプレイヤーが獲得します。'
};
