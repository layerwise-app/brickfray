import type { playEn } from './en';

export const playKo: Record<keyof typeof playEn, string> = {
  'col.kills': '킬',
  'col.deaths': '데스',
  'col.assists': '어시',
  'col.score': '점수',
  'col.headshots': '헤드샷',
  'col.accuracy': '명중률',
  'col.time': '시간',
  'col.ping': '핑',
  'results.lobby': '방으로 복귀',
  'rule.ffa': '누군가 {n}킬을 하면 경기가 끝나고, 점수가 가장 높은 플레이어가 이깁니다.',
  'rule.tdm': '먼저 {n}킬을 한 팀이 이깁니다.',
  'lobby.size': '방 인원',
  'lobby.perTeam': '팀당 인원',
  'lobby.count': '{h} + 봇 {b}',
  'lobby.open': '빈자리',
  'death.health': '남은 체력',
  'feed.water': '물에 빠졌습니다',
  'feed.self': '스스로 쓰러졌습니다',
  'death.streak': '연속 처치',
  'paused.title': '일시 정지',
  'notFound.title': '여기에는 아무것도 없어요',
  'notFound.body': '존재하지 않는 페이지입니다.',
  'notFound.home': '게임으로 돌아가기'
};
