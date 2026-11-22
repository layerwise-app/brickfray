import type { playEn } from './en';

export const playZh: Record<keyof typeof playEn, string> = {
  'col.kills': '击倒',
  'col.deaths': '阵亡',
  'col.assists': '助攻',
  'col.score': '得分',
  'col.headshots': '爆头',
  'col.accuracy': '命中率',
  'col.time': '用时',
  'col.ping': '延迟',
  'results.lobby': '返回房间',
  'rule.ffa': '先拿到 {n} 次击倒即结束比赛，得分最高者获胜。',
  'rule.tdm': '先拿到 {n} 次击倒的队伍获胜。',
  'lobby.size': '房间人数',
  'lobby.count': '{h} + {b} 个机器人',
  'lobby.open': '空位',
  'death.health': '剩余生命',
  'death.streak': '连杀',
  'paused.title': '已暂停',
  'notFound.title': '这里什么都没有',
  'notFound.body': '这个页面不存在。',
  'notFound.home': '返回游戏'
};
