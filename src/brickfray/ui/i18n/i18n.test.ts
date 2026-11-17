import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';
import { zh } from './zh';

const all = { zh, es, fr, de, ja, ko };

describe('translations', () => {
  it('every language has every key, non-empty, with the same placeholders', () => {
    for (const [lang, dict] of Object.entries(all)) {
      for (const [key, source] of Object.entries(en)) {
        const text = (dict as Record<string, string>)[key];
        expect(text, `${lang}.${key}`).toBeTruthy();
        const want = [...source.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        const got = [...text!.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(got, `${lang}.${key} placeholders`).toEqual(want);
      }
    }
  });
});
