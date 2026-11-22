import type { streaksEn } from './en';

export const streaksFr: Record<keyof typeof streaksEn, string> = {
  'streak.2': 'Double élimination',
  'streak.3': 'Triple élimination',
  'streak.4': 'Quadruple élimination',
  'streak.5': 'Quintuple élimination',
  'streak.6': 'Sextuple élimination',
  'bounty.collected': '+{n} de prime',
  'bounty.on': 'Prime {n}',
  'bounty.rule': 'Dès 3 éliminations d’affilée, la tête d’un joueur est mise à prix : +25 par élimination, jusqu’à +150, pour qui l’arrête.'
};
