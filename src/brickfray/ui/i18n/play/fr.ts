import type { playEn } from './en';

export const playFr: Record<keyof typeof playEn, string> = {
  'col.kills': 'Élim.',
  'col.deaths': 'Morts',
  'col.assists': 'Assist.',
  'col.score': 'Score',
  'col.headshots': 'Headshots',
  'col.accuracy': 'Précision',
  'col.time': 'Temps',
  'col.ping': 'Ping',
  'results.lobby': 'Retour au salon',
  'rule.ffa': 'Le match s’arrête dès {n} éliminations. Le plus de points l’emporte.',
  'rule.tdm': 'La première équipe à {n} éliminations gagne.',
  'lobby.size': 'Taille du salon',
  'lobby.count': '{h} + {b} bots',
  'lobby.open': 'Place libre',
  'death.health': 'Vie restante',
  'death.streak': 'Série',
  'paused.title': 'Pause',
  'notFound.title': 'Rien à construire ici',
  'notFound.body': 'Cette page n’existe pas.',
  'notFound.home': 'Retour au jeu'
};
