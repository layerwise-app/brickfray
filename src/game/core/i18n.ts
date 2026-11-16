// Locale selection and shared markup for the standalone game.
import { en } from './locales/en';
import { zh } from './locales/zh';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import type { Dictionary, TranslationKey } from './locales/en';

const dictionaries = { en, zh, es, fr, de, ja, ko } satisfies Record<string, Dictionary>;

export type Lang = keyof typeof dictionaries;
export type { TranslationKey } from './locales/en';
export type TranslationVars = Readonly<Record<string, string | number | null | undefined>>;

/** Native names stay recognizable even if the selected language is unfamiliar. */
export const LANGUAGES: readonly { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
];

const LANG_STORAGE_KEY = 'doodle_ui_lang';

/** Accept regional browser/URL codes such as es-MX, fr-CA and zh_TW. */
export function normalizeLang(value: string | null | undefined): Lang | null {
  const code = value?.trim().toLowerCase().split(/[-_]/)[0];
  return code && Object.prototype.hasOwnProperty.call(dictionaries, code) ? code as Lang : null;
}

function detectLang(): Lang {
  if (typeof location !== 'undefined') {
    const wanted = normalizeLang(new URLSearchParams(location.search).get('lang'));
    if (wanted) return wanted;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = normalizeLang(localStorage.getItem(LANG_STORAGE_KEY));
      if (saved) return saved;
    } catch {
      // Browsing still works when storage is unavailable.
    }
  }
  if (typeof navigator !== 'undefined') {
    for (const code of [navigator.language, ...(navigator.languages || [])]) {
      const supported = normalizeLang(code);
      if (supported) return supported;
    }
  }
  return 'en';
}

export let lang: Lang = detectLang();

/** Set a supported language, or detect it from URL, saved choice, then browser. */
export function setLang(next: string): void {
  lang = normalizeLang(next) ?? detectLang();
}

export function currentLang(): Lang {
  return lang;
}

/** Substitute positional variables, including repeated or reordered placeholders. */
export function t(key: TranslationKey, vars: TranslationVars = {}): string {
  const values = Object.values(vars);
  return dictionaries[lang][key].replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''));
}

/** HUD structure is shared by every locale. */
export function hudHTML(): string {
  return `
      <div class="scope" id="scope"><div class="mask"></div><div class="ring"></div><div class="cx"></div><div class="cy"></div><div class="dot"></div></div>
      <div class="focus-meter" id="focusmeter"><div class="fm-label">${t('focusMeterLabel')}</div><div class="fm-tube"><div class="fm-fill" id="fmfill"></div><i class="fm-f1"></i><i class="fm-f2"></i><i class="fm-f3"></i></div><div class="fm-ready" id="fmready">${t('focusReadySign')}</div></div>
      <div class="focus-mark" id="focusmark"><i></i><i></i><i></i><i></i></div>
      <div class="crosshair" id="crosshair"><i class="ch-t"></i><i class="ch-b"></i><i class="ch-l"></i><i class="ch-r"></i><i class="ch-dot"></i></div>
      <div class="grapple-ret" id="gret"></div><div class="gstam" id="gstam" hidden><i id="gstamfill"></i></div>
      <div class="hitmarker" id="hitmarker"><i></i><i></i></div>
      <div class="dmg-ind" id="dmg"></div>
      <div class="hud-tl"><div class="score">${t('score')} <b id="score">0</b></div><div class="combo" id="combo"></div></div>
      <div class="hud-tr"><div class="wave">${t('wave')} <b id="wave">1</b></div><div class="modifier" id="modifier"></div><div class="left"><b id="left">0</b> ${t('enemiesLeft')}</div><div class="timer" id="timer"></div><div class="pvpscore" id="pvpscore" hidden></div></div><div class="board" id="board" hidden></div>
      <div class="bossbar" id="bossbar"><div class="bossname" id="bossname"></div><div class="bar big"><div class="fill red" id="bossfill"></div></div></div>
      <div class="hud-bl">
        <div class="health"><span>${t('health')}</span><div class="bar"><div class="fill" id="hpfill"></div></div><span id="hpnum">100</span></div>
        <div class="ammo"><b id="mag">30</b><span id="reserve">/120</span><span class="reloading" id="reloading"></span><span class="nades" id="nades" title="${t('howGrenade')}"></span></div>
        <div class="tally" id="tally"></div>
      </div>
      <div class="hud-br"><div class="slots" id="slots"></div><div class="weapon" id="weapon">${t('rifle')}</div><div class="hint" id="hint"></div></div>
      <div class="tip" id="tip"></div>
      <div class="message"><div class="msg-main" id="msg"></div><div class="msg-sub" id="msgsub"></div></div>
      <div class="killfeed" id="killfeed"></div>
      <div class="screen" id="screen"><div class="panel" id="panel"></div></div>`;
}

const mouseRows: readonly TranslationKey[] = [
  'controlsMouse1', 'controlsMouse2', 'controlsMouse3', 'controlsMouse4',
  'controlsMouse5', 'controlsMouse6', 'controlsMouse7', 'controlsMouse8',
  'controlsMouse9', 'controlsMouse10', 'controlsMouse11',
];
const padRows: readonly TranslationKey[] = [
  'controlsPad1', 'controlsPad2', 'controlsPad3', 'controlsPad4', 'controlsPad5',
  'controlsPad6', 'controlsPad7', 'controlsPad8', 'controlsPad9',
];

export function controlsHTML(): string {
  return `<section class="controls">
    <div class="control-tabs" role="tablist" aria-label="${t('controlsLabel')}">
      <button type="button" id="controls-mouse-tab" role="tab" data-controls-tab="mouse" aria-selected="true" aria-controls="controls-mouse">${t('tabMouse')}</button>
      <button type="button" id="controls-controller-tab" role="tab" data-controls-tab="controller" aria-selected="false" aria-controls="controls-controller" tabindex="-1">${t('tabController')}</button>
    </div>
    <div class="cols">
      <div id="controls-mouse" role="tabpanel" data-controls-panel="mouse" aria-labelledby="controls-mouse-tab" tabindex="0">
        ${mouseRows.map((key) => `<div>${t(key)}</div>`).join('')}
      </div>
      <div id="controls-controller" role="tabpanel" data-controls-panel="controller" aria-labelledby="controls-controller-tab" tabindex="0" hidden>
        ${padRows.map((key) => `<div>${t(key)}</div>`).join('')}
      </div>
    </div>
  </section>`;
}

export const _dict = dictionaries;
