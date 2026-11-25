import { describe, expect, it } from 'vitest';
import { CATEGORIES, type Falloff } from '../audio/catalog';
import { SOUNDS } from '../audio/sounds';
import type { WeaponId } from '../weapons/defs';
import { GUN_LOUDNESS, HEAR, noiseLevel, SOUND } from './bot-ears';

const spec = (id: string) => {
  const s = (SOUNDS as Record<string, { category: keyof typeof CATEGORIES; loudness?: number; falloff?: Falloff }>)[id]!;
  return { loudness: s.loudness ?? CATEGORIES[s.category].loudness, falloff: s.falloff ?? CATEGORIES[s.category].falloff };
};
/** Farthest distance (m) at which a noise still reaches `level`. */
const reach = (n: Parameters<typeof noiseLevel>[0], level: number, occlusion = 0) => {
  let d = 1;
  while (d < 400 && noiseLevel(n, d, occlusion) >= level) d += 0.5;
  return d;
};
const step = (volume: number) => ({ kind: 'step' as const, volume, weapon: 'ar' as WeaponId });

describe('what bots hear', () => {
  it('uses the audio catalog’s own levels and falloffs', () => {
    expect(spec('step:stone')).toEqual({ loudness: SOUND.step.loudness, falloff: SOUND.step.falloff });
    for (const id of ['jump', 'land', 'slide'] as const) expect(spec(id)).toEqual({ loudness: SOUND.move.loudness, falloff: SOUND.move.falloff });
    expect(spec('cue:magIn')).toEqual({ loudness: SOUND.reload.loudness, falloff: SOUND.reload.falloff });
    expect(spec('cue:pinPull')).toEqual({ loudness: SOUND.pin.loudness, falloff: SOUND.pin.falloff });
    expect(spec('cue:throw')).toEqual({ loudness: SOUND.throw.loudness, falloff: SOUND.throw.falloff });
    expect(spec('meleeSwing:blunt')).toEqual({ loudness: SOUND.swing.loudness, falloff: SOUND.swing.falloff });
    for (const [w, [near, far]] of Object.entries(GUN_LOUDNESS)) {
      expect(spec(`fire:${w}`).loudness, w).toBe(near);
      expect(spec(`fireFar:${w}`).loudness, w).toBe(far);
    }
  });

  it('a walking step carries about as far as the catalog says a player hears one, a sprint a little farther, a wall cuts it short', () => {
    // The catalog: over the map's bed at 25 m in a quiet moment, under it by 45 m.
    expect(reach(step(SOUND.step.walk), HEAR.sure)).toBeGreaterThan(25);
    expect(reach(step(SOUND.step.walk), HEAR.gone)).toBeLessThan(46);
    expect(reach(step(SOUND.step.sprint), HEAR.sure)).toBeGreaterThan(reach(step(SOUND.step.walk), HEAR.sure));
    expect(reach(step(SOUND.step.walk), HEAR.sure, 1)).toBeLessThan(12);
  });

  it('a gunshot is heard across a map, a sniper’s farthest', () => {
    const shot = (weapon: WeaponId) => ({ kind: 'shot' as const, volume: 1, weapon });
    expect(reach(shot('ar'), HEAR.sure)).toBeGreaterThan(50);
    expect(reach(shot('sniper'), HEAR.sure)).toBeGreaterThan(reach(shot('ar'), HEAR.sure));
    expect(reach(shot('nailer'), HEAR.sure, 1)).toBeLessThan(reach(shot('nailer'), HEAR.sure));
  });
});
