import type { streaksEn } from './en';

export const streaksDe: Record<keyof typeof streaksEn, string> = {
  'streak.2': 'Doppelkill',
  'streak.3': 'Dreifachkill',
  'streak.4': 'Vierfachkill',
  'streak.5': 'Fünffachkill',
  'bounty.collected': '+{n} Kopfgeld',
  'bounty.on': 'Kopfgeld {n}',
  'bounty.rule': 'Ab einer Serie von 3 Kills steht ein Kopfgeld auf den Spieler: +25 pro Kill, bis +150, für den, der ihn stoppt.'
};
