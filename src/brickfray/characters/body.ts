import { hand } from './body-hands';
import { FACE_Z, sculptFace, sculptHead } from './body-head';
import { bodyKit } from './body-kit';
import { limbs } from './body-limbs';
import { blockBody, blockFace, blockHead, props } from './body-low';
import { torso } from './body-torso';
import type { Look, PartSet } from './parts';

export type BodyPart = 'hips' | 'abdomen' | 'chest' | 'neck' | 'head' | 'face' | 'upperArms' | 'forearms' | 'hands' | 'thighs' | 'shins' | 'boots' | 'belt';

export interface BodyStyle {
  skin: string;
  shirt: string;
  shirtLook?: Look;
  sleeve?: string;
  /** Forearm color; skin for rolled sleeves. */
  forearm?: string;
  forearmLook?: Look;
  /** Elbow ball color (defaults to the sleeve). */
  elbow?: string;
  glove: string;
  gloveLook?: Look;
  /** Fingerless gloves show skin fingers. */
  fingers?: string;
  pants: string;
  pantsLook?: Look;
  boot: string;
  bootLook?: Look;
  sole?: string;
  belt?: string;
  buckle?: string;
  /** Torso width multiplier at the shoulders. */
  bulk?: number;
  /** Arm/leg thickness multiplier. */
  limbs?: number;
  /** Pupil and lash colour. */
  eyes?: string;
  /** Iris colour on the detailed tiers. */
  iris?: string;
  /** Round cheek blush on the detailed tiers. */
  blush?: string;
  brow?: string;
  browTilt?: number;
  mouth?: 'smile' | 'flat' | 'grin' | 'none';
  omit?: BodyPart[];
}

/** The shared action-figure body: hips, waist, chest, neck, head, jointed limbs, hands, boots. */
export function buildBody(b: PartSet, s: BodyStyle) {
  if (b.detail === 0) return blockBody(b, s);
  const k = bodyKit(b, s);
  torso(k);
  if (!k.omit.has('head')) head(b, s, k.omit.has('face'));
  props(b);
  limbs(k);
}

/** Head shape and face; the face looks along -Z with its eye line at head-local y 0.075. */
export function head(b: PartSet, s: BodyStyle, noFace = false) {
  if (b.detail === 0) return blockHead(b, s, noFace);
  sculptHead(b, s);
  if (!noFace) face(b, s);
}

export function face(b: PartSet, s: BodyStyle, z = FACE_Z) {
  if (b.detail < 2) blockFace(b, s, z);
  else sculptFace(b, s, z);
}

/** Right hand wrapped around a pistol grip; hand-local axes match the weapon (barrel -Z). */
export function gripHand(b: PartSet, s: BodyStyle) {
  hand(b, s, 'R', 'grip');
}

/** Left hand cupping a handguard that runs along -Z, held from below. */
export function supportHand(b: PartSet, s: BodyStyle) {
  hand(b, s, 'L', 'cup');
}
