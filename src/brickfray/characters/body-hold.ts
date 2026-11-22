import * as THREE from 'three';
import { FINGERS, foreCentre, foreDistance, SIZE, THUMB, wrapDigit, type ForeEnd } from './body-grasp';
import type { V3 } from './skeleton';

/** A hand's fingers and thumb closed round a gun's fore-end (see `HandPose` in body-hands). */
export interface Grasp {
  fingers: [V3, V3, V3, V3];
  spread: [number, number, number, number];
  thumb: { dir: V3; toward: V3; flex: V3 };
  root: number;
}

/**
 * A fist closed hard round a fore-end: the knuckles roll toward the palm, the fingers keep a curl at their middle and end
 * joints, and the soft tips press into its top edge as they hook over it.
 */
const HOLD = { root: -0.006, press: [0.0012, 0.002, 0.007] as V3, curl: [0, 0.35, 0.25] as V3, thumbLean: 0.6 };

/** Where a `hold` hand's fore-end is centred, in the hand bone's space as a right hand: the stance seats the gun's fore-end there. */
export function foreAt(fore: ForeEnd): V3 {
  const [x, y, z] = foreCentre(unscaled(fore));
  return [x * SIZE, y * SIZE, z * SIZE];
}

const unscaled = (f: ForeEnd): ForeEnd => ({ ...f, half: [f.half[0] / SIZE, f.half[1] / SIZE], corner: f.corner / SIZE, seat: (f.seat ?? 0) / SIZE, sink: (f.sink ?? 0) / SIZE });

/**
 * A `hold` hand closed round a gun's fore-end: palm under it, each finger laid up its far face and over the top edge.
 * The thumb hooks over the top edge too, unless a barrel lies along the top; then it lies along the near face toward the muzzle.
 */
export function foreGrip(fore: ForeEnd, girth: number, spread: Grasp['spread']): Grasp {
  const f = unscaled(fore);
  const centre = foreCentre(f);
  const arch = fore.arch ?? 1;
  const curl = HOLD.curl.map((c) => c * arch) as V3;
  spread = spread.map((a) => a * (fore.fan ?? 1)) as Grasp['spread'];
  const fingers = FINGERS.map((g, i) =>
    wrapDigit(f, centre, { from: [g.at[0] + HOLD.root, g.at[1], g.at[2]], dir: [0, Math.sin(spread[i]!), -Math.cos(spread[i]!)], toward: [-1, 0, 0], len: g.len, r: g.r * girth * 0.96, max: [1.75, 1.8, 1.35], press: HOLD.press, curl })
  ) as Grasp['fingers'];
  return { fingers, spread, thumb: (fore.thumb ?? (f.over ? 'along' : 'over')) === 'along' ? thumbAlong(f, centre) : thumbOver(f, centre), root: HOLD.root };
}

/** The fore-end's axis (toward the muzzle), its near face's outward normal and its top, in the hand's space. */
function foreAxes(f: ForeEnd) {
  const yaw = f.yaw ?? 0;
  const roll = f.roll ?? 0;
  return {
    along: new THREE.Vector3(0, Math.cos(yaw), -Math.sin(yaw)),
    face: new THREE.Vector3(-Math.sin(roll), Math.cos(roll) * Math.sin(yaw), Math.cos(roll) * Math.cos(yaw)),
    up: new THREE.Vector3(-Math.cos(roll), -Math.sin(roll) * Math.sin(yaw), -Math.sin(roll) * Math.cos(yaw))
  };
}

/** The thumb climbs the near face, leaning toward the muzzle, and hooks over the top edge to meet the fingertips. */
function thumbOver(f: ForeEnd, centre: V3): Grasp['thumb'] {
  const { along, face, up } = foreAxes(f);
  const dir = up.multiplyScalar(Math.cos(HOLD.thumbLean)).addScaledVector(along, Math.sin(HOLD.thumbLean)).toArray() as V3;
  const toward = face.negate().toArray() as V3;
  return { dir, toward, flex: wrapDigit(f, centre, { from: THUMB.at, dir, toward, len: THUMB.len, r: THUMB.r[1], max: [0.3, 1.3, 1.1], min: [-0.7, 0, 0], curl: [0, 0.2, 0.15] }) };
}

/**
 * The thumb lies along the near face toward the muzzle: its first bone reaches from the root to a line on that face, as
 * high up it as it reaches without cutting the bottom edge, and the rest lies on the line, the tip pressing in a little.
 */
function thumbAlong(f: ForeEnd, centre: V3): Grasp['thumb'] {
  const { along, face, up } = foreAxes(f);
  const root = new THREE.Vector3(...THUMB.at);
  const reach = THUMB.len[0] * 0.98;
  const target = new THREE.Vector3();
  const probe = new THREE.Vector3();
  for (let h = 0.6; h >= -0.9; h -= 0.05) {
    const line = new THREE.Vector3(...centre).addScaledVector(face, f.half[1] + THUMB.r[1]).addScaledVector(up, f.half[0] * h);
    const w = root.clone().sub(line);
    const closest = w.dot(along);
    const off = w.lengthSq() - closest * closest;
    target.copy(line).addScaledVector(along, closest + Math.sqrt(Math.max(0, reach * reach - off)));
    if (off > reach * reach) continue;
    let clear = Infinity;
    for (let k = 1; k <= 6; k++) {
      probe.lerpVectors(root, target, k / 6);
      clear = Math.min(clear, foreDistance(f, centre, probe.x, probe.y, probe.z) - THUMB.r[0] * 0.8);
    }
    if (clear > -0.002) break;
  }
  const dir = target.sub(root).normalize();
  return { dir: dir.toArray() as V3, toward: along.toArray() as V3, flex: [0, Math.acos(Math.min(1, dir.dot(along))), 0.12] };
}

