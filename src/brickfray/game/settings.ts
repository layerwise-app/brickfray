import type { AudioMix } from '../audio/types';
import type { CharacterId } from '../characters/types';
import type { QualityLevel } from '../engine/quality';
import type { Difficulty, MatchSettings } from '../sim/types';
import type { MapId } from '../world/types';
import { DEFAULT_BINDINGS, type InputSettings } from './input';

export const MAP_IDS: MapId[] = ['plaza', 'fortress', 'docks'];

export interface CrosshairSettings {
  color: string;
  size: number;
  gap: number;
  dot: boolean;
}

export interface Settings {
  name: string;
  character: CharacterId;
  quality: QualityLevel;
  /** Horizontal field of view in degrees (80–110). */
  fov: number;
  input: InputSettings;
  mix: AudioMix;
  crosshair: CrosshairSettings;
  damageNumbers: boolean;
  showStats: boolean;
  /** Last solo difficulty picked. */
  difficulty: Difficulty;
  /** Last map picked for a solo run, and the last room set up as host. */
  soloMap: MapId;
  room: Pick<MatchSettings, 'mode' | 'map' | 'minutes' | 'bots'>;
}

const KEY = 'brickfray.settings.v2';

export function defaultQuality(): QualityLevel {
  if (typeof navigator === 'undefined') return 'medium';
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  return mobile ? 'low' : cores >= 8 ? 'high' : 'medium';
}

export function defaultSettings(): Settings {
  return {
    name: '',
    character: 'rivet',
    quality: defaultQuality(),
    fov: 90,
    input: {
      bindings: DEFAULT_BINDINGS,
      sensitivity: 2,
      adsSensitivity: 1,
      invertY: false,
      toggleAds: false,
      gamepadSensitivity: 1,
      aimAssist: 0.5
    },
    mix: { master: 0.8, effects: 1, music: 0.5, ui: 0.7 },
    crosshair: { color: '#ffffff', size: 1, gap: 1, dot: true },
    damageNumbers: false,
    showStats: false,
    difficulty: 'normal',
    soloMap: 'plaza',
    room: { mode: 'ffa', map: 'plaza', minutes: 10, bots: 5 }
  };
}

export function loadSettings(): Settings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Settings>;
    return {
      ...base,
      ...saved,
      input: { ...base.input, ...saved.input, bindings: { ...base.input.bindings, ...saved.input?.bindings } },
      mix: { ...base.mix, ...saved.mix },
      crosshair: { ...base.crosshair, ...saved.crosshair },
      soloMap: MAP_IDS.includes(saved.soloMap as MapId) ? saved.soloMap! : base.soloMap,
      room: { ...base.room, ...saved.room, map: MAP_IDS.includes(saved.room?.map as MapId) ? saved.room!.map : base.room.map }
    };
  } catch {
    return base;
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Settings still apply for this session.
  }
}
