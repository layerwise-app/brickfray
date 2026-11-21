import type { WeaponId } from '../weapons/defs';
import { reloadClip } from '../weapons/view/clips-guns';
import { PEAK_AT } from './sync';
import type { FoleyId, SoundId } from './types';

export interface ReloadLayer {
  /** Seconds after the reload starts. */
  at: number;
  id: SoundId;
}

interface Plan {
  /** The clip's nominal length: its key times below are seconds of it. */
  beats: number;
  layers: readonly (readonly [number, FoleyId])[];
}

/**
 * What a reload shows between its cues, by clip (weapons/view/clips-*.ts): the support hand leaving the grip, the
 * hand at the belt pouch (magSwap `pouch`), the fresh magazine at the well's mouth (magSwap `mouth`, before the
 * seat), the hand back on the grip. The reload's own cues (cloth, mag out, mag in, bolt) play from the view model.
 */
const PLANS: Record<string, Plan> = {
  arReload: { beats: 1.9, layers: [[0.09, 'gripOff'], [0.77, 'pouch'], [1.2, 'magScrape'], [1.66, 'regrip']] },
  arReloadEmpty: { beats: 2.4, layers: [[0.09, 'gripOff'], [0.74, 'pouch'], [1.15, 'magScrape'], [2.16, 'regrip']] },
  pistolReload: { beats: 1.4, layers: [[0.07, 'gripOff'], [0.61, 'pouch'], [0.95, 'magScrape'], [1.3, 'regrip']] },
  pistolReloadEmpty: { beats: 1.7, layers: [[0.07, 'gripOff'], [0.42, 'pouch'], [0.72, 'magScrape'], [1.6, 'regrip']] },
  sniperReload: { beats: 2.6, layers: [[0.14, 'gripOff'], [1.12, 'pouch'], [1.68, 'magScrape'], [2.34, 'regrip']] },
  sniperReloadEmpty: { beats: 3.2, layers: [[0.64, 'gripOff'], [1.46, 'pouch'], [1.96, 'magScrape'], [2.6, 'regrip']] },
  revolverReload: { beats: 2.1, layers: [[0.95, 'pouch'], [1.92, 'regrip']] },
  harpoonReload: { beats: 1.2, layers: [[1.12, 'regrip']] }
};

/** The layers of one reload, each started early by its sound's build-up so its loudest moment meets the shown one. */
export function reloadLayers(weapon: WeaponId, empty: boolean, duration: number): { duration: number; layers: ReloadLayer[] } {
  const clip = reloadClip(weapon, empty, duration);
  const plan = PLANS[clip.name];
  if (!plan) return { duration: clip.duration, layers: [] };
  const scale = clip.duration / plan.beats;
  const layers = plan.layers.map(([t, foley]) => {
    const id = `foley:${foley}` as const;
    return { at: Math.max(t * scale - (PEAK_AT[id] ?? 0), 0), id };
  });
  return { duration: clip.duration, layers };
}
