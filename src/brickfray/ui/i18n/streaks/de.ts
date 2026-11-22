import type { streaksEn } from './en';

export const streaksDe: Record<keyof typeof streaksEn, string> = {
  'streak.2': 'Doppelkill',
  'streak.3': 'Dreifachkill',
  'streak.4': 'Vierfachkill',
  'streak.5': 'Fünffachkill',
  'streak.6': 'Sechsfachkill',
  'bounty.collected': '+{n} Kopfgeld',
  'bounty.on': 'Kopfgeld {n}',
  'bounty.rule': 'Kills entscheiden das Match. Ab einer Serie von 3 Kills steht ein Kopfgeld auf den Spieler: +25 pro Kill, bis +150, für den, der ihn stoppt.'
};
