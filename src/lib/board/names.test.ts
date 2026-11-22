import { describe, expect, it } from 'vitest';
import { cleanName, nameKey, nameText } from './names';

describe('names', () => {
  it('keeps Latin letters (accented too), digits, the full stop and CJK', () => {
    expect(cleanName('Zoë.Ångström')).toBe('Zoë.Ångström');
    expect(cleanName('Nguyễn')).toBe('Nguyễn');
    expect(cleanName('砖块大王')).toBe('砖块大王');
    expect(cleanName('ブロック職人')).toBe('ブロック職人');
    expect(cleanName('スーパー佐々木')).toBe('スーパー佐々木');
    expect(cleanName('벽돌왕')).toBe('벽돌왕');
    expect(cleanName('v1.2')).toBe('v1.2');
  });

  it('drops everything else: spaces, symbols, emoji, other scripts, invisible characters', () => {
    expect(cleanName('  Brick   Layer ')).toBe('BrickLayer');
    expect(cleanName('Ace_!@#$%^&*()-+=Bolt')).toBe('AceBolt');
    expect(cleanName('a‮bc​d\n')).toBe('abcd');
    expect(cleanName('😀Ace😀')).toBe('Ace');
    expect(cleanName('Иван Ace')).toBe('Ace');
    expect(cleanName('ǃAceǀ')).toBe('Ace');
    expect(cleanName('積み木・王様、です。')).toBe('積み木王様です');
    expect(cleanName('😀 ​')).toBeNull();
    expect(cleanName(42)).toBeNull();
  });

  it('folds full-width and compatibility forms first, then cuts to 16', () => {
    expect(cleanName('ＷＩＤＥ．１')).toBe('WIDE.1');
    expect(cleanName('ﾌﾞﾛｯｸ')).toBe('ブロック');
    expect(cleanName('x'.repeat(40))).toBe('x'.repeat(16));
    expect(cleanName('積み木の王様になりたい人です、よろしく')).toHaveLength(16);
    expect(cleanName('𠀀'.repeat(20))).toBe('𠀀'.repeat(16));
  });

  it('cleans as it is typed, so the field never shows what the server would drop', () => {
    expect(nameText('Ace ')).toBe('Ace');
    expect(nameText('')).toBe('');
  });

  it('compares names without case', () => {
    expect(nameKey('ACE')).toBe(nameKey('ace'));
    expect(nameKey('ÉMILE')).toBe('émile');
    expect(nameKey('砖块')).toBe('砖块');
  });
});
