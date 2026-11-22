import type { playEn } from './en';

export const playDe: Record<keyof typeof playEn, string> = {
  'col.kills': 'Kills',
  'col.deaths': 'Tode',
  'col.assists': 'Assists',
  'col.score': 'Punkte',
  'col.headshots': 'Kopftreffer',
  'col.accuracy': 'Präzision',
  'col.time': 'Zeit',
  'col.ping': 'Ping',
  'results.lobby': 'Zurück zum Raum',
  'rule.ffa': 'Bei {n} Kills endet das Match. Die meisten Punkte gewinnen.',
  'rule.tdm': 'Das Team, das zuerst {n} Kills hat, gewinnt.',
  'lobby.size': 'Raumgröße',
  'lobby.count': '{h} + {b} Bots',
  'lobby.open': 'Freier Platz',
  'death.health': 'Leben übrig',
  'death.streak': 'Serie',
  'paused.title': 'Pause',
  'notFound.title': 'Hier gibt’s nichts zu bauen',
  'notFound.body': 'Diese Seite gibt es nicht.',
  'notFound.home': 'Zurück zum Spiel'
};
