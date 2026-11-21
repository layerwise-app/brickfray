import * as THREE from 'three';
import * as S from '../shapes';
import type { LoftRing } from '../shapes';
import { surface, type Spot } from './plate-forms';

/**
 * A fold standing up in the canvas of a right limb: a ridge whose crest runs round the limb from height y0 at angle a0
 * to y1 at a1 (angles from the front toward the character's right, a0 < a1), about `w` to either side of the crest and `h` high,
 * gentle above, steeper below, with a shallow groove along each side. The left limb wears the same folds mirrored.
 */
export type Fold = [y0: number, y1: number, a0: number, a1: number, w: number, h: number];

const TAU = Math.PI * 2;
const sgnPow = (x: number, e: number) => Math.sign(x) * Math.abs(x) ** e;
const turn = (a: number) => ((a % TAU) + TAU) % TAU;
const bump = (d: number) => (Math.abs(d) < 1 ? (1 - d * d) ** 2 : 0);
const smooth = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How far the folds raise the canvas at height y and angle a on the limb of side `sign`. They die out at the stiff outer seam. */
export function foldLift(folds: readonly Fold[], sign: number, y: number, a: number) {
  const m = sign * a;
  let lift = 0;
  for (const [y0, y1, a0, a1, w, h] of folds) {
    const t = turn(m - a0) / (a1 - a0);
    if (t >= 1) continue;
    const dy = y - y0 - (y1 - y0) * t;
    const d = Math.abs(dy / (dy > 0 ? 1.25 * w : 0.85 * w));
    if (d < 1.8) lift += h * Math.sin(Math.PI * t) ** 0.6 * (bump(d) - 0.4 * bump((d - 1.3) / 0.5));
  }
  return lift * smooth(Math.abs(turn(m - Math.PI / 2 + Math.PI) - Math.PI), 0.08, 0.32);
}

/** A point on one of the suit's limbs with its outward normal, `lift` off the canvas: `a` round from the front toward the character's right. */
export function on(limb: LoftRing[], y: number, a: number, lift = 0): Spot {
  const r = S.loftRingAt(limb, y);
  const p = 2 / r.e;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const depth = c >= 0 ? r.rz : r.back;
  const normal = new THREE.Vector3(sgnPow(s, 2 - p) / r.rx, 0, -sgnPow(c, 2 - p) / depth).normalize();
  return [new THREE.Vector3(r.rx * sgnPow(s, p), y, r.cz - depth * sgnPow(c, p)).addScaledVector(normal, lift), normal];
}

/**
 * The canvas of a limb as one skin with its folds standing up in it, closed by domes `bottom` and `top` high like a loft.
 * Rows crowd into the folds, so they shade as soft ridges instead of drawn lines.
 */
export function foldedLoft(limb: LoftRing[], folds: readonly Fold[], sign: number, radial: number, ends: { bottom: number; top: number }) {
  const lo = limb[0]!.y;
  const hi = limb[limb.length - 1]!.y;
  const keys = limb.flatMap((r, i) => (i ? [(limb[i - 1]!.y + r.y) / 2, r.y] : [r.y]));
  const extra = folds.flatMap(([y0, y1, , , w]) => Array.from({ length: Math.floor((Math.abs(y1 - y0) + 3.8 * w) / (w * 0.6)) + 1 }, (_, i) => Math.min(y0, y1) - 1.5 * w + i * w * 0.6));
  const body: number[] = [];
  for (const y of [...keys, ...extra.filter((y) => y > lo && y < hi && keys.every((k) => Math.abs(k - y) > 0.003))].sort((p, q) => p - q)) {
    if (!body.length || y - body[body.length - 1]! > 0.003) body.push(y);
  }
  const domes = Math.max(1, Math.round(radial / 6));
  const dome = (at: number, h: number, dir: number) =>
    h > 0
      ? Array.from({ length: domes + 1 }, (_, j) => {
          const a = ((domes + 1 - j) / (domes + 1)) * (Math.PI / 2);
          return { y: at + dir * h * Math.sin(a), at, k: Math.cos(a) };
        })
      : [{ y: at, at, k: 0 }];
  const rows = [...dome(lo, ends.bottom, -1), ...body.map((y) => ({ y, at: y, k: 1 })), ...dome(hi, ends.top, 1).reverse()];
  return surface(
    radial,
    rows.length - 1,
    (u, v, out) => {
      const row = rows[Math.round(v * (rows.length - 1))]!;
      const a = Math.PI + u * TAU;
      const [p, n] = on(limb, row.at, a);
      out.set(p.x * row.k, row.y, row.k * (p.z - S.loftRingAt(limb, row.at).cz) + S.loftRingAt(limb, row.at).cz);
      if (row.k === 1) out.addScaledVector(n, foldLift(folds, sign, row.y, a));
    },
    { closed: true, inward: true }
  );
}
