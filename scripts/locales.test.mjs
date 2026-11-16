import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { test } from 'node:test';

// The app uses bundler-style extensionless imports; resolve those for Node's TS loader.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !extname(specifier) && context.parentURL?.includes('/src/game/')) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null },
});

const { _dict, LANGUAGES, controlsHTML, currentLang, hudHTML, normalizeLang, setLang, t } =
  await import('../src/game/core/i18n.ts');

const keys = Object.keys(_dict.en).sort();
const placeholders = (text) => (text.match(/\{\d+\}/g) ?? []).sort();

function browser({ search = '', saved = null, languages = ['en-US'], storageBlocked = false } = {}) {
  Object.defineProperties(globalThis, {
    location: { configurable: true, value: { search } },
    navigator: { configurable: true, value: { language: languages[0], languages } },
    localStorage: {
      configurable: true,
      value: { getItem() { if (storageBlocked) throw new Error('Storage blocked'); return saved; } },
    },
  });
  setLang('auto');
  return currentLang();
}

test('all seven dictionaries cover every key with matching placeholders and safe markup', () => {
  assert.deepEqual(LANGUAGES.map(({ code }) => code).sort(), ['de', 'en', 'es', 'fr', 'ja', 'ko', 'zh']);
  for (const [code, dictionary] of Object.entries(_dict)) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, code);
    for (const key of keys) {
      const value = dictionary[key];
      assert.ok(value.trim().length, `${code}.${key} is empty`);
      assert.deepEqual(placeholders(value), placeholders(_dict.en[key]), `${code}.${key}`);
      assert.doesNotMatch(value.replace(/<\/?b>/g, ''), /[<>]/, `${code}.${key} has unexpected HTML`);
      assert.equal((value.match(/<b>/g) ?? []).length, (value.match(/<\/b>/g) ?? []).length, `${code}.${key}`);
    }
  }
});

test('regional codes normalize and unknown language codes are rejected', () => {
  for (const [input, expected] of Object.entries({
    'es-MX': 'es', 'ES_es': 'es', 'fr-CA': 'fr', 'de-AT': 'de',
    'ja-JP': 'ja', 'ko-KR': 'ko', 'zh_TW': 'zh', 'en-GB': 'en',
  })) assert.equal(normalizeLang(input), expected);
  for (const input of [null, undefined, '', 'auto', 'pt-BR', 'constructor', '__proto__']) {
    assert.equal(normalizeLang(input), null);
  }
});

test('URL overrides saved choice; saved choice overrides browser preference', () => {
  assert.equal(browser({ search: '?lang=es-MX', saved: 'ja', languages: ['ko-KR'] }), 'es');
  assert.equal(browser({ search: '?lang=invalid', saved: 'fr-CA', languages: ['de'] }), 'fr');
  assert.equal(browser({ saved: 'ko', languages: ['ja-JP'] }), 'ko');
});

test('automatic mode respects browser preference order and falls back to English', () => {
  assert.equal(browser({ languages: ['fr-CA', 'zh-CN'] }), 'fr');
  assert.equal(browser({ languages: ['en-US', 'zh-CN'] }), 'en');
  assert.equal(browser({ languages: ['pt-BR', 'de-DE'] }), 'de');
  assert.equal(browser({ saved: 'unsupported', languages: ['ja-JP'] }), 'ja');
  assert.equal(browser({ languages: ['pt-BR', 'ru-RU'] }), 'en');
  assert.equal(browser({ languages: ['ko-KR'], storageBlocked: true }), 'ko');
});

test('every locale renders localized HUD and both complete control panels', () => {
  for (const { code } of LANGUAGES) {
    setLang(code);
    assert.equal(currentLang(), code);
    const controls = controlsHTML();
    assert.ok(controls.includes(t('tabMouse')));
    assert.ok(controls.includes(t('tabController')));
    assert.equal((controls.match(/role="tab"/g) ?? []).length, 2);
    assert.equal((controls.match(/<div>/g) ?? []).length, 20);
    for (const key of keys.filter((key) => /^controls(Mouse|Pad)\d+$/.test(key))) {
      assert.ok(controls.includes(t(key)), `${code}.${key}`);
    }
    assert.match(controls, /id="controls-controller"[^>]* hidden/);
    for (const key of ['score', 'wave', 'health', 'focusReadySign', 'rifle', 'howGrenade']) {
      assert.ok(hudHTML().includes(t(key)), `${code}.${key}`);
    }
    assert.match(t('deathStats', { waves: 5, kills: 12, score: 400, extra: '!' }), /400/);
    assert.doesNotMatch(t('deathStats', { waves: 5, kills: 12, score: 400, extra: '!' }), /\{\d+\}/);
  }
});
