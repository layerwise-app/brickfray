import type { ForeEnd } from './body-grasp';
import { hand } from './body-hands';
import { FACE_Z, sculptFace, sculptHead } from './body-head';
import { bodyKit } from './body-kit';
import { limbs } from './body-limbs';
import { blockBody, blockFace, blockHead, props } from './body-low';
import { torso } from './body-torso';
import type { Look, PartSet } from './parts';

export type BodyPart = 'hips' | 'abdomen' | 'chest' | 'neck' | 'head' | 'face' | 'upperArms' | 'forearms' | 'hands' | 'thighs' | 'shins' | 'boots' | 'belt';

/** How the eyes and brows are set on the sculpted face. */
export interface Expression {
  /** Upper lids: 0 shut, 1 wide open; 0.8 is awake and relaxed. */
  open?: number;
  /** Lower lids pushed up by the cheeks, 0…1: a smiling or narrowed eye. */
  squint?: number;
  /** Slant of the lids in radians; positive drops the outer corners. Follows the brows when omitted. */
  lidTilt?: number;
  /** Where the eyes look, each -1…1: toward the character's right, and up. */
  gaze?: [number, number];
  /** Brow height offsets [left, right] in model units; unequal values cock one brow. */
  brows?: [number, number];
}

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
  /** Glove cuff girth on the detailed tiers; 1 is a gauntlet a little wider than the forearm. */
  cuff?: number;
  /** Finger thickness on the detailed tiers; plate gauntlets have fingers to match their cuffs. */
  fingerGirth?: number;
  /** The gun's fore-end a `hold` hand closes round, when it holds one rather than a melee haft. */
  fore?: ForeEnd;
  /** Fingerless gloves show skin fingers. */
  fingers?: string;
  pants: string;
  pantsLook?: Look;
  boot: string;
  bootLook?: Look;
  sole?: string;
  belt?: string;
  /** Belt surface on the detailed tiers (rubber by default). */
  beltLook?: Look;
  buckle?: string;
  /** Torso width multiplier at the shoulders. */
  bulk?: number;
  /** Arm/leg thickness multiplier. */
  limbs?: number;
  /** Leg thickness when it differs from the arms'. */
  legs?: number;
  /** Pupil and lash colour. */
  eyes?: string;
  /** Iris colour on the detailed tiers. */
  iris?: string;
  /** Round cheek blush on the detailed tiers. */
  blush?: string;
  brow?: string;
  browTilt?: number;
  mouth?: 'smile' | 'flat' | 'grin' | 'smirk' | 'none';
  /** Lashes flicking out from the outer corners of the eyes, on the detailed tiers. */
  lashes?: boolean;
  /** Nose size on the detailed tiers; 1 is the small default. */
  nose?: number;
  expression?: Expression;
  /** What closes the showroom boot: laces, armour lames (the default on metal), or nothing, for a costume that seals it itself. */
  bootClosure?: 'laces' | 'lames' | 'sealed';
  /** The showroom's elbows and knees: cloth bending over the joint by default; a hard suit or armour keeps hinge barrels. */
  joints?: 'cloth' | 'hinge';
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
  if (b.detail === 0 || b.lean) blockFace(b, s, z);
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
