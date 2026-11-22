import { describe, expect, it } from 'vitest';
import { nameProblem } from './name-check';

describe('nameProblem', () => {
  it('passes what the name rule keeps', () => {
    for (const name of ['Ace', 'ace.01', 'Zoë', 'Ñandú', '砖块', 'かな', 'カタカナ', '한글', '𠀀𠀁', 'ＡＢＣ１２', '']) expect(nameProblem(name), name).toBeNull();
  });

  it('names the first refused character, as the player sees it', () => {
    expect(nameProblem('Ace_01')).toEqual({ kind: 'char', char: '_' });
    expect(nameProblem('Ace!')).toEqual({ kind: 'char', char: '!' });
    expect(nameProblem('Hi👍🏽x')).toEqual({ kind: 'char', char: '👍🏽' });
    expect(nameProblem('Иван')).toEqual({ kind: 'char', char: 'И' });
    expect(nameProblem('Ace！')).toEqual({ kind: 'char', char: '!' });
  });

  it('calls a space a space, full-width ones too', () => {
    expect(nameProblem('Ace Ventura')).toEqual({ kind: 'space' });
    expect(nameProblem('砖　块')).toEqual({ kind: 'space' });
  });

  it('counts length in code points, up to 16', () => {
    expect(nameProblem('a'.repeat(16))).toBeNull();
    expect(nameProblem('a'.repeat(17))).toEqual({ kind: 'long' });
    expect(nameProblem('𠀀'.repeat(16))).toBeNull();
    expect(nameProblem('𠀀'.repeat(17))).toEqual({ kind: 'long' });
  });
});
