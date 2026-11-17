import { useSyncExternalStore } from 'react';
import { de } from './de';
import { en, type Dictionary, type MessageKey } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';
import { zh } from './zh';

const dictionaries = { en, zh, es, fr, de, ja, ko } satisfies Record<string, Dictionary>;
export type Lang = keyof typeof dictionaries;
export type { MessageKey };

/** Native names, so a player can find their language even in an unfamiliar UI. */
export const LANGUAGES: readonly { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' }
];

const KEY = 'brickfray.lang';

export function normalizeLang(value: string | null | undefined): Lang | null {
  const code = value?.trim().toLowerCase().split(/[-_]/)[0];
  return code && code in dictionaries ? (code as Lang) : null;
}

function detect(): Lang {
  if (typeof window === 'undefined') return 'en';
  const fromUrl = normalizeLang(new URLSearchParams(location.search).get('lang'));
  if (fromUrl) return fromUrl;
  try {
    const saved = normalizeLang(localStorage.getItem(KEY));
    if (saved) return saved;
  } catch {
    // Storage can be blocked; fall through to the browser language.
  }
  for (const code of navigator.languages ?? [navigator.language]) {
    const lang = normalizeLang(code);
    if (lang) return lang;
  }
  return 'en';
}

let current: Lang = 'en';
let initialized = false;
const listeners = new Set<() => void>();

export function getLang(): Lang {
  if (!initialized && typeof window !== 'undefined') {
    initialized = true;
    current = detect();
    document.documentElement.lang = current;
  }
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  initialized = true;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // The choice still applies for this visit.
  }
  for (const fn of listeners) fn();
}

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>) {
  let text: string = dictionaries[lang][key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Current language and a translator bound to it; re-renders on language change. */
export function useT() {
  const lang = useSyncExternalStore(subscribe, getLang, () => 'en' as Lang);
  return { lang, t: (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars) };
}
