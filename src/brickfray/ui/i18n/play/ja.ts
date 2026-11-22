import type { playEn } from './en';

export const playJa: Record<keyof typeof playEn, string> = {
  'col.kills': 'キル',
  'col.deaths': 'デス',
  'col.assists': 'アシスト',
  'col.score': 'スコア',
  'col.headshots': 'ヘッドショット',
  'col.accuracy': '命中率',
  'col.time': 'タイム',
  'col.ping': 'Ping',
  'results.lobby': 'ルームへ戻る',
  'rule.ffa': '誰かが {n} キルで試合終了。スコア最多のプレイヤーが勝ちです。',
  'rule.tdm': '先に {n} キルしたチームの勝ちです。',
  'lobby.size': 'ルーム人数',
  'lobby.count': '{h} + ボット {b}',
  'lobby.open': '空き',
  'death.health': '残り体力',
  'death.streak': '連続キル',
  'paused.title': '一時停止中',
  'notFound.title': 'ここには何もありません',
  'notFound.body': 'このページは存在しません。',
  'notFound.home': 'ゲームに戻る'
};
