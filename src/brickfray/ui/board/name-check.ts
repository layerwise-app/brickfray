import { NAME_MAX, nameText } from '../../../lib/board/names';

export type NameProblem = { kind: 'char'; char: string } | { kind: 'space' } | { kind: 'long' };

/** Characters as the player sees them: an emoji with its skin tone or a flag is one. */
function graphemes(text: string) {
  if (typeof Intl.Segmenter !== 'function') return [...text];
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
}

/**
 * Why typed text cannot be a name, or null when it can: the first character the rule in names.ts refuses, then the
 * length (in code points, as names.ts counts). Folded forms (full-width letters, NFKC) pass, as the rule folds them.
 */
export function nameProblem(value: string): NameProblem | null {
  const text = value.normalize('NFKC');
  const refused = graphemes(text).find((g) => nameText(g) !== g);
  if (refused !== undefined) return /^\s+$/u.test(refused) ? { kind: 'space' } : { kind: 'char', char: refused };
  return [...text].length > NAME_MAX ? { kind: 'long' } : null;
}
