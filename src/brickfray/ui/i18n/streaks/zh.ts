import type { streaksEn } from './en';

export const streaksZh: Record<keyof typeof streaksEn, string> = {
  'streak.2': '双杀',
  'streak.3': '三杀',
  'streak.4': '四杀',
  'streak.5': '五杀',
  'bounty.collected': '赏金 +{n}',
  'bounty.on': '悬赏 {n}',
  'bounty.rule': '连杀 3 人起身上就有悬赏：每多杀一人 +25，最高 +150，终结他的人拿走。'
};
