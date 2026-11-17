import * as THREE from 'three';
import { box, latheZ, tube } from '../shapes';
import type { Surface } from '../surface';

/** Color slots the character palette fills in: sleeve = primary, trim = secondary. */
export type Slot = 'sleeve' | 'trim' | 'glove' | 'pad' | 'seam';

export interface ArmPiece {
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  slot: Slot;
  surface: Surface;
}

/**
 * Hand frame: origin on the axis of whatever the hand holds, +Y along that
 * axis (pinky → index), back of the hand toward +X, fingers wrapping around
 * through -Z, thumb through +Z. Right hand; the left one is mirrored.
 */
export const WRIST = new THREE.Vector3(0.024, -0.014, 0.064);

const Y = new THREE.Vector3(0, 1, 0);
const tmpZ = new THREE.Vector3();
const tmpX = new THREE.Vector3();
const tmpY = new THREE.Vector3();

/** A rounded block from a to b, its width along the hand's Y. */
function bone(out: ArmPiece[], a: THREE.Vector3, b: THREE.Vector3, width: number, thick: number, bevel: number, slot: Slot, extend = 0.3) {
  tmpZ.subVectors(b, a);
  const len = tmpZ.length() + thick * extend;
  tmpZ.normalize();
  tmpX.crossVectors(Y, tmpZ);
  if (tmpX.lengthSq() < 1e-6) tmpX.set(1, 0, 0);
  tmpX.normalize();
  tmpY.crossVectors(tmpZ, tmpX).normalize();
  const m = new THREE.Matrix4().makeBasis(tmpX, tmpY, tmpZ);
  m.setPosition(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5));
  out.push({ geometry: box(thick, width, len, bevel), matrix: m, slot, surface: 'satin' });
}

function polar(r: number, deg: number, y: number) {
  const a = (deg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
}

/** Gloved hand pieces in the hand frame. `trigger` straightens the index finger onto a trigger. */
export function handPieces(detail: 0 | 1 | 2, trigger: boolean): ArmPiece[] {
  const out: ArmPiece[] = [];
  const bevel = detail === 0 ? 0 : detail === 1 ? 0.004 : 0.0055;
  const fb = detail === 0 ? 0 : detail === 1 ? 0.0035 : 0.0048;
  // Palm, wrapping the right-rear of the held object, and the back-of-hand pad.
  const palm = new THREE.Matrix4().compose(new THREE.Vector3(0.029, -0.002, 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.16, 0)), new THREE.Vector3(1, 1, 1));
  out.push({ geometry: box(0.023, 0.08, 0.07, bevel * 1.6), matrix: palm, slot: 'glove', surface: 'satin' });
  if (detail >= 1) {
    const pad = new THREE.Matrix4().compose(new THREE.Vector3(0.0415, 0.003, 0.006), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.16, 0)), new THREE.Vector3(1, 1, 1));
    out.push({ geometry: box(0.006, 0.066, 0.034, 0.0022), matrix: pad, slot: 'pad', surface: 'rubber' });
  }
  // Fingers: index, middle, ring, pinky (or one block for the three outer fingers on low).
  const fingers = [
    { y: 0.028, r: 0.034, joints: [-34, -104, -152, -192], w: 0.0185 },
    { y: 0.008, r: 0.035, joints: [-32, -104, -154, -196], w: 0.0195 },
    { y: -0.012, r: 0.034, joints: [-30, -100, -150, -190], w: 0.0185 },
    { y: -0.03, r: 0.031, joints: [-28, -94, -140, -176], w: 0.016 }
  ];
  const list = detail === 0 ? [fingers[0]!, { y: -0.011, r: 0.034, joints: [-30, -100, -150, -190], w: 0.056 }] : fingers;
  list.forEach((f, i) => {
    let pts = f.joints.map((deg) => polar(f.r, deg, f.y));
    if (i === 0 && trigger) {
      pts = [polar(f.r, -34, f.y), new THREE.Vector3(0.019, f.y + 0.006, -0.064), new THREE.Vector3(0.006, f.y + 0.002, -0.084), new THREE.Vector3(0.0, f.y - 0.012, -0.092)];
    }
    for (let k = 0; k < 3; k++) {
      const thick = k === 0 ? 0.019 : k === 1 ? 0.017 : 0.0155;
      bone(out, pts[k]!, pts[k + 1]!, f.w * (k === 2 ? 0.94 : 1), thick, fb, 'glove');
    }
    if (detail >= 2) {
      const knuckle = new THREE.Matrix4().makeTranslation(pts[0]!.x + 0.006, pts[0]!.y, pts[0]!.z - 0.002);
      out.push({ geometry: box(0.012, f.w * 0.8, 0.014, 0.003), matrix: knuckle, slot: 'pad', surface: 'rubber' });
    }
  });
  // Thumb: thick base over the back of the grip, then forward along the far side.
  const t0 = new THREE.Vector3(0.016, 0.022, 0.05);
  const t1 = new THREE.Vector3(-0.008, 0.042, 0.034);
  const t2 = new THREE.Vector3(-0.022, 0.049, 0.008);
  const t3 = new THREE.Vector3(-0.024, 0.047, -0.016);
  bone(out, t0, t1, 0.026, 0.024, bevel, 'glove', 0.5);
  bone(out, t1, t2, 0.02, 0.019, fb, 'glove');
  bone(out, t2, t3, 0.018, 0.017, fb, 'glove');
  // Gauntlet cuff around the wrist, aimed back along the forearm.
  const dir = WRIST.clone().sub(new THREE.Vector3(0.03, -0.002, 0.018)).normalize();
  const cuff = new THREE.Matrix4().compose(WRIST.clone().addScaledVector(dir, -0.008), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), new THREE.Vector3(1, 1, 1));
  const segs = detail === 0 ? 8 : detail === 1 ? 12 : 16;
  out.push({ geometry: tube(0.036, 0.044, segs, detail >= 1 ? 0.004 : 0, 0.039), matrix: cuff, slot: 'glove', surface: 'satin' });
  if (detail >= 1) out.push({ geometry: tube(0.0395, 0.009, segs, 0.002), matrix: cuff.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.018)), slot: 'trim', surface: 'plastic' });
  return out;
}

/** Upper arm along +Y from the shoulder; length in meters. */
export function upperArmPieces(detail: 0 | 1 | 2, length: number): ArmPiece[] {
  const segs = detail === 0 ? 8 : detail === 1 ? 12 : 16;
  const up = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  return [
    { geometry: latheZ([[0, 0], [0.054, 0], [0.05, length * 0.6], [0.047, length], [0, length + 0.02]], segs), matrix: up, slot: 'sleeve', surface: 'satin' }
  ];
}

/**
 * Forearm along +Y from the elbow to the wrist: sleeve to mid-forearm with a
 * rolled trim band, then the glove's gauntlet down to the wrist.
 */
export function forearmPieces(detail: 0 | 1 | 2, length: number): ArmPiece[] {
  const segs = detail === 0 ? 8 : detail === 1 ? 12 : 18;
  const up = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const at = (y: number) => up.clone().premultiply(new THREE.Matrix4().makeTranslation(0, y, 0));
  const cut = length * 0.5;
  const out: ArmPiece[] = [
    { geometry: latheZ([[0, -0.035], [0.037, -0.03], [0.042, 0.0], [0.04, cut * 0.6], [0.0375, cut + 0.004], [0, cut + 0.004]], segs), matrix: up, slot: 'sleeve', surface: 'satin' },
    { geometry: latheZ([[0, cut - 0.01], [0.032, cut - 0.01], [0.031, length * 0.8], [0.029, length], [0, length]], segs), matrix: up, slot: 'glove', surface: 'satin' },
    { geometry: tube(0.041, 0.02, segs, detail >= 1 ? 0.006 : 0, 0.039), matrix: at(cut), slot: 'trim', surface: 'plastic' }
  ];
  if (detail >= 1) {
    out.push({ geometry: tube(0.0328, 0.012, segs, 0.003), matrix: at(cut + 0.03), slot: 'pad', surface: 'rubber' });
  }
  if (detail >= 2) {
    out.push({ geometry: tube(0.0425, 0.004, segs, 0.0015), matrix: at(cut * 0.45), slot: 'seam', surface: 'dark' });
    out.push({ geometry: tube(0.0318, 0.003, segs), matrix: at(length * 0.78), slot: 'seam', surface: 'dark' });
  }
  return out;
}
