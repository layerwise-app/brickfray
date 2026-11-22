import type { streaksEn } from './en';

export const streaksKo: Record<keyof typeof streaksEn, string> = {
  'streak.2': '더블 킬',
  'streak.3': '트리플 킬',
  'streak.4': '쿼드라 킬',
  'streak.5': '펜타 킬',
  'streak.6': '헥사 킬',
  'bounty.collected': '현상금 +{n}',
  'bounty.on': '현상금 {n}',
  'bounty.rule': '승패는 처치 수로 정해집니다. 3연속 처치부터 현상금이 붙어 처치할 때마다 +25(최대 +150), 그 플레이어를 쓰러뜨린 사람이 가져갑니다.'
};
