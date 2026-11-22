import type { BoardEntry } from '../../../lib/board/contract';
import { translate, type Lang, type MessageKey } from '../i18n';

export function number(lang: Lang, n: number) {
  return new Intl.NumberFormat(lang).format(n);
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

/** Hours and minutes for long totals ("3 h 05 min" style, in the language’s own units); seconds under a minute. */
export function playTime(lang: Lang, seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const unit = (value: number, u: 'hour' | 'minute' | 'second') => new Intl.NumberFormat(lang, { style: 'unit', unit: u, unitDisplay: 'narrow' }).format(value);
  if (h) return `${unit(h, 'hour')} ${unit(m, 'minute')}`;
  // Under a minute played still shows: "45s", not "0m".
  return m ? unit(m, 'minute') : unit(Math.round(seconds), 'second');
}

/** A map's name; one added after this build shows its id. */
export function mapName(lang: Lang, id: string) {
  const key = `map.${id}` as MessageKey;
  return (translate(lang, key) as string | undefined) ?? id;
}

/** How a match ended for its player: the wave a run reached, a team's result, a free-for-all win or place. */
export function outcome(lang: Lang, m: Pick<BoardEntry, 'mode' | 'wave' | 'result' | 'placement' | 'players'>) {
  if (m.mode === 'solo') return translate(lang, 'wave', { n: m.wave });
  if (m.mode === 'tdm' || m.result === 'win') return translate(lang, m.result === 'win' ? 'victory' : m.result === 'draw' ? 'draw' : 'defeat');
  return translate(lang, 'board.place', { n: m.placement, total: m.players });
}
