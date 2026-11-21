import type { BoardEntry } from '../../../lib/board/contract';
import { translate, type Lang, type MessageKey } from '../i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function number(lang: Lang, n: number) {
  return new Intl.NumberFormat(lang).format(n);
}

/** "now", "5 min ago", "yesterday"; past a week, the date. */
export function ago(lang: Lang, at: number, now = Date.now()) {
  const gap = Math.max(0, now - at);
  const rel = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
  if (gap < MINUTE) return rel.format(0, 'second');
  if (gap < HOUR) return rel.format(-Math.floor(gap / MINUTE), 'minute');
  if (gap < DAY) return rel.format(-Math.floor(gap / HOUR), 'hour');
  if (gap < 7 * DAY) return rel.format(-Math.floor(gap / DAY), 'day');
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(at);
}

export function when(lang: Lang, at: number) {
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(at);
}

/** 9:58, 1:02:03 */
export function clock(seconds: number) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** Hours and minutes for long totals: "3 h 05 min" style, in the language's own units. */
export function playTime(lang: Lang, seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const unit = (value: number, u: 'hour' | 'minute') => new Intl.NumberFormat(lang, { style: 'unit', unit: u, unitDisplay: 'narrow' }).format(value);
  return h ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(m, 'minute');
}

/** A map's name; one added after this build shows its id. */
export function mapName(lang: Lang, id: string) {
  const key = `map.${id}` as MessageKey;
  return (translate(lang, key) as string | undefined) ?? id;
}

/** "18 K · 5 D · 3 A" with the game's own letters. */
export function kda(lang: Lang, e: Pick<BoardEntry, 'kills' | 'deaths' | 'assists'>) {
  return `${number(lang, e.kills)} ${translate(lang, 'kills')} · ${number(lang, e.deaths)} ${translate(lang, 'deaths')} · ${number(lang, e.assists)} ${translate(lang, 'assists')}`;
}
