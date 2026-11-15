/**
 * Typed, localStorage-backed player preferences. Every key starts with `doodle_`; values are read
 * once when the game starts and written back the moment they change.
 */
import { NAME_MAX } from './config';
import { isZh } from './core/i18n';
import { LEVELS } from './world/level';
import type { MapKey } from './world/level';

const KEY = {
  best: 'doodle_best',
  music: 'doodle_music',
  checkpoint: 'doodle_checkpoint',
  name: 'doodle_name',
  sens: 'doodle_sens',
  invert: 'doodle_invert',
  map: 'doodle_map',
  uiLang: 'doodle_ui_lang',
} as const;

/** A map key that is on the menu, falling back to the district for anything else. */
export function knownMap(key: string | null | undefined): MapKey {
  const found = LEVELS.find((m) => m.key === key);
  return found ? found.key : 'district';
}

export class Preferences {
  /** The map picked for solo play (and offered first when hosting). */
  map: MapKey = knownMap(localStorage.getItem(KEY.map) || 'district');
  /** Best solo score. */
  best = Number(localStorage.getItem(KEY.best) || 0);
  music = localStorage.getItem(KEY.music) !== '0';
  /** Highest checkpoint wave reached (every fifth wave). */
  checkpoint = Number(localStorage.getItem(KEY.checkpoint) || 0);
  name = (localStorage.getItem(KEY.name) || '').slice(0, NAME_MAX) || (isZh ? '涂鸦' : 'Doodle') + Math.floor(Math.random() * 90 + 10);
  /** Look sensitivity in percent. */
  sens = Number(localStorage.getItem(KEY.sens) || 100);
  invert = localStorage.getItem(KEY.invert) === '1';

  setMap(key: MapKey): void {
    this.map = key;
    localStorage.setItem(KEY.map, key);
  }

  setBest(score: number): void {
    this.best = score;
    localStorage.setItem(KEY.best, String(score));
  }

  setMusic(on: boolean): void {
    this.music = on;
    localStorage.setItem(KEY.music, on ? '1' : '0');
  }

  setCheckpoint(wave: number): void {
    this.checkpoint = wave;
    localStorage.setItem(KEY.checkpoint, String(wave));
  }

  setName(name: string): void {
    this.name = name;
    localStorage.setItem(KEY.name, name);
  }

  /** Writes the look settings (sensitivity and invert). */
  saveLook(): void {
    localStorage.setItem(KEY.sens, String(this.sens));
    localStorage.setItem(KEY.invert, this.invert ? '1' : '0');
  }

  /** The interface language the player picked, or null for automatic. */
  static readUiLang(): 'en' | 'zh' | null {
    try {
      const saved = localStorage.getItem(KEY.uiLang);
      if (saved === 'en' || saved === 'zh') return saved;
    } catch {
      /* ignore storage failures */
    }
    return null;
  }

  static writeUiLang(value: string): void {
    try {
      localStorage.setItem(KEY.uiLang, value);
    } catch {
      /* ignore storage failures */
    }
  }
}
