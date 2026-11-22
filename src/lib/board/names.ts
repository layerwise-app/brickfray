// Player names: what a name may hold, and the key that makes Name#1234 unique. Shared by the menu, the profile and the server.

export const NAME_MAX = 16;
export const DEFAULT_NAME = 'Player';

/**
 * Code points a name may use: digits, the full stop, Latin letters (English and accented), Chinese characters,
 * Japanese kana and Korean hangul. The board migration (drizzle/…_board_names_tags) cleans stored names with the same ranges.
 */
export const NAME_RANGES: readonly (readonly [number, number])[] = [
  [0x2e, 0x2e],
  [0x30, 0x39],
  [0x41, 0x5a],
  [0x61, 0x7a],
  [0xc0, 0xd6],
  [0xd8, 0xf6],
  // Ext-B without U+01C0–01C3, click letters drawn like | ‖ ǂ !
  [0xf8, 0x1bf],
  [0x1c4, 0x24f],
  [0x1100, 0x11ff],
  [0x1e00, 0x1eff],
  [0x3005, 0x3007],
  [0x3041, 0x3096],
  [0x309d, 0x309f],
  [0x30a1, 0x30fa],
  [0x30fc, 0x30ff],
  [0x3131, 0x318e],
  [0x31f0, 0x31ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0x20000, 0x323af]
];

const hex = (n: number) => `\\u{${n.toString(16)}}`;
const OTHER = new RegExp(`[^${NAME_RANGES.map(([a, b]) => (a === b ? hex(a) : `${hex(a)}-${hex(b)}`)).join('')}]`, 'gu');

/** What is left of typed text under the rule: full-width and compatibility forms folded (NFKC), everything else dropped, cut to NAME_MAX. */
export function nameText(value: string) {
  return [...value.normalize('NFKC').replace(OTHER, '')].slice(0, NAME_MAX).join('');
}

/** A name as the server keeps it, or null when nothing allowed is left. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return nameText(value) || null;
}

/** Names compare without case: "ace" and "Ace" share one set of tags. */
export function nameKey(name: string) {
  return name.toLowerCase();
}
