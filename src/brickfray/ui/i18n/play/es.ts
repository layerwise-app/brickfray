import type { playEn } from './en';

export const playEs: Record<keyof typeof playEn, string> = {
  'col.kills': 'Bajas',
  'col.deaths': 'Muertes',
  'col.assists': 'Asist.',
  'col.score': 'Puntos',
  'col.headshots': 'Headshots',
  'col.accuracy': 'Precisión',
  'col.time': 'Tiempo',
  'col.ping': 'Ping',
  'results.lobby': 'Volver a la sala',
  'rule.ffa': 'La partida acaba cuando alguien llega a {n} bajas. Gana quien tenga más puntos.',
  'rule.tdm': 'Gana el primer equipo en llegar a {n} bajas.',
  'lobby.size': 'Tamaño de la sala',
  'lobby.count': '{h} + {b} bots',
  'lobby.open': 'Plaza libre',
  'death.health': 'Vida restante',
  'death.streak': 'Racha',
  'paused.title': 'Pausa',
  'notFound.title': 'Aquí no hay nada que construir',
  'notFound.body': 'Esta página no existe.',
  'notFound.home': 'Volver al juego'
};
