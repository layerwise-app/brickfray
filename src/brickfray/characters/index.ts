import type { Kit } from '../engine/kit';
import { LOADOUTS } from '../weapons/loadouts';
import { disposePieceMaterials } from './material';
import { clearShapeCache } from './shapes';
import { DESIGNS } from './designs';
import { meleeProp } from './melee';
import { PartSet, type BakedCharacter, type Hands } from './parts';
import { Rig } from './rig';
import { ROSTER } from './roster';
import { restModelPositions, restOffsets } from './skeleton';
import { STYLES } from './style';
import type { BotKind, CharacterId, CharacterRig } from './types';

export type { AnimState, BotKind, CharacterId, CharacterInfo, CharacterRig, ShatterPiece } from './types';
export { CHARACTER_IDS, ROSTER } from './roster';
export { BOT_KINDS } from './designs';
export { idleState } from './labState';
export { STANCES } from './stances';
export type { Stance } from './stance';

const cache = new Map<string, BakedCharacter>();

/** Builds a rigged, animated character; geometry is shared per (id, quality). */
export function createCharacter(id: CharacterId | BotKind, kit: Kit, hero?: { hands: Hands }): CharacterRig {
  const design = DESIGNS[id];
  const rest = restOffsets(design.rest);
  const key = hero ? `${id}:hero:${hero.hands.L}:${hero.hands.R}` : `${id}:${kit.profile.level}`;
  let baked = cache.get(key);
  if (!baked) {
    const parts = new PartSet(kit.profile, hero ? { hero: true, hands: hero.hands } : {});
    design.build(parts);
    meleeProp(parts, LOADOUTS[id].melee, !(id in ROSTER));
    baked = parts.bake(restModelPositions(rest));
    cache.set(key, baked);
  }
  return new Rig({ id, baked, rest, style: STYLES[id], scale: design.scale ?? 1 }, kit);
}

/** Frees every cached character geometry (after a quality change or when leaving the game). */
export function disposeCharacterCaches() {
  for (const baked of cache.values()) {
    baked.main.dispose();
    baked.glass?.dispose();
    for (const p of baked.pieces) p.geometry.dispose();
  }
  cache.clear();
  clearShapeCache();
  disposePieceMaterials();
}
