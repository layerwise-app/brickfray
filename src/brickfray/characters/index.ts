import type { Kit } from '../engine/kit';
import { LOADOUTS } from '../weapons/loadouts';
import { disposePieceMaterials } from './material';
import { clearShapeCache } from './shapes';
import { DESIGNS } from './designs';
import { occlude } from './hero-assets';
import { meleeProp } from './melee';
import { DEFAULT_HANDS, PartSet, type BakedCharacter, type Hands } from './parts';
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
export { loadHeroAssets } from './hero-assets';
export type { Stance } from './stance';

const cache = new Map<string, BakedCharacter>();
const heroKey = (id: CharacterId, hands: Hands) => `${id}:hero:${hands.L}:${hands.R}`;

/** Builds a rigged, animated character; geometry is shared per (id, quality). */
export function createCharacter(id: CharacterId | BotKind, kit: Kit, hero?: { hands: Hands }): CharacterRig {
  const design = DESIGNS[id];
  const rest = restOffsets(design.rest);
  const key = hero ? heroKey(id as CharacterId, hero.hands) : `${id}:${kit.profile.level}`;
  let baked = cache.get(key);
  if (!baked) {
    const parts = new PartSet(kit.profile, hero ? { hero: true, hands: hero.hands } : { lean: id in ROSTER });
    design.build(parts);
    meleeProp(parts, LOADOUTS[id].melee, !(id in ROSTER));
    baked = parts.bake(restModelPositions(rest));
    if (hero) occlude(id, baked.glass ? [baked.main, baked.glass] : [baked.main]);
    cache.set(key, baked);
  }
  const hands = hero ? hero.hands : kit.profile.detail === 2 ? DEFAULT_HANDS : null;
  return new Rig({ id, baked, hands, rest, style: STYLES[id], scale: design.scale ?? 1, grip: design.grip ?? 1, tool: LOADOUTS[id].melee }, kit);
}

/** A fingerprint of a hero's showroom model as built (its vertices' positions, colours and surfaces), or null before it is built. */
export function heroFingerprint(id: CharacterId, hands: Hands) {
  const baked = cache.get(heroKey(id, hands));
  if (!baked) return null;
  let h = 0x811c9dc5;
  for (const geometry of baked.glass ? [baked.main, baked.glass] : [baked.main]) {
    for (const name of ['position', 'color', 'surface']) {
      const array = geometry.getAttribute(name)?.array as Float32Array | undefined;
      if (!array) continue;
      const words = new Uint32Array(array.buffer, array.byteOffset, array.length);
      for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i]!, 0x01000193);
    }
  }
  return (h >>> 0).toString(36);
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
