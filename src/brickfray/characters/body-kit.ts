import * as THREE from 'three';
import type { BodyPart, BodyStyle } from './body';
import type { Look, PartOptions, PartSet } from './parts';
import * as S from './shapes';
import type { BoneName } from './skeleton';

const c = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');

/** A darker (k < 1) or lighter (k > 1) tone of a colour, for seams, recesses and laces. */
export function tone(color: string, k: number) {
  c.set(color);
  if (k <= 1) c.multiplyScalar(k);
  else c.lerp(WHITE, k - 1);
  return `#${c.getHexString()}`;
}

/** A ball with its own segment count: small close-up parts stay cheap whatever their size bucket. */
export function orb(b: PartSet, bone: BoneName, r: number, segments: number, color: string, o: PartOptions = {}) {
  return b.add(bone, S.sphere(r, segments, Math.max(3, Math.round(segments * 0.6))), color, o);
}

export const even = (n: number) => n + (n % 2);

/** What every body region needs: the part set, the style and the values derived from them. */
export interface BodyKit {
  b: PartSet;
  s: BodyStyle;
  omit: Set<BodyPart>;
  /** Limb thickness and shoulder width multipliers. */
  L: number;
  bulk: number;
  sleeve: string;
  shirtLook: Look;
  pantsLook: Look;
  /** In-between rings a loft adds per span on this tier; limbs and boots have gentler profiles and take fewer. */
  steps: number;
  limbSteps: number;
  /** High and showroom tiers. */
  fine: boolean;
}

export function bodyKit(b: PartSet, s: BodyStyle): BodyKit {
  return {
    b,
    s,
    omit: new Set(s.omit ?? []),
    L: s.limbs ?? 1,
    bulk: s.bulk ?? 1,
    sleeve: s.sleeve ?? s.shirt,
    shirtLook: s.shirtLook ?? 'cloth',
    pantsLook: s.pantsLook ?? 'cloth',
    steps: b.hero ? 3 : b.detail,
    limbSteps: b.hero ? 2 : 1,
    fine: b.detail >= 2
  };
}
