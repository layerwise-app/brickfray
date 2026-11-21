import type { Lod } from '../../weapons/shapes';
import type { Surface } from '../../weapons/surface';
import type { MeleeBuilder } from '../../weapons/models/melee-kit';
import type { Look, PartSet } from '../parts';
import type { BoneName, V3 } from '../skeleton';

const LOOK: Record<Surface, Look> = { plastic: 'plastic', satin: 'skin', rubber: 'rubber', metal: 'metal', chrome: 'chrome', glow: 'glow', dark: 'matte' };
/** The mid tier of a first-person weapon build: every part, rounded enough for the showroom camera. */
const LOD: Lod = { detail: 1, bevel: 0.0011, seg: 14, segSmall: 8, curve: 3, glass: true, minor: true, third: false };

/**
 * Puts a melee weapon's own model on a bone as part of the costume, for a figure whose pose leaves it stowed.
 * The model's origin (its grip, head up +Y) goes to `at`, turned by `rot`.
 */
export function stow(b: PartSet, bone: BoneName, build: (m: MeleeBuilder) => void, at: V3, rot: V3) {
  build({
    lod: LOD,
    detail: LOD.detail,
    add: (geometry, color, surface, matrix) => b.add(bone, matrix ? geometry.clone().applyMatrix4(matrix) : geometry, color, { at, rot, look: LOOK[surface] })
  });
}
