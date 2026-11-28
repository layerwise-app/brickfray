import type { Piece } from './temple-layout';
import { box, Rng, type PlanCollider, type Vec3 } from './util';

/**
 * A temple piece's colliders: boxes that follow what temple-art and temple-things draw for it, so shots pass where a
 * shape looks open (under a roof, between rail posts, past a rounded rim) and stop where it looks solid.
 */
export function pieceColliders(q: Piece): PlanCollider[] {
  const surface = q.surface ?? 'stone';
  const solid = (parts: [Vec3, Vec3][]) => parts.map(([a, b]) => box(a, b, surface, { walk: q.walk, bulletsPass: q.bulletsPass }));
  if (q.solid) return solid(q.solid);
  if (q.kind === 'rail' && q.tag !== 'handrail') {
    // The run stops players, reaching higher than it looks so no prop's ledge jumps onto it; only its rails and posts
    // stop bullets.
    const top: Vec3 = [q.max[0], q.max[1] + RAIL_CLEAR, q.max[2]];
    return [box(q.min, top, surface, { walk: q.walk, bulletsPass: true }), ...solid(railParts(q))];
  }
  const parts = q.kind === 'prop' ? propParts(q) : q.kind === 'stele' ? steleParts(q) : q.kind === 'ruin' && !q.tag ? ruinParts(q) : undefined;
  return solid(parts ?? [[q.min, q.max]]);
}

/** How far a rail's player barrier reaches above its top. */
const RAIL_CLEAR = 1.2;

/** Rail posts' spacing along a run (temple-art `rail`). */
export const RAIL_POST_STEP = 1.6;

function railParts(q: Piece): [Vec3, Vec3][] {
  const [x0, , z0] = q.min;
  const [x1, h, z1] = q.max;
  const along = x1 - x0 > z1 - z0;
  const c = (along ? z0 + z1 : x0 + x1) / 2;
  const span = (inset: number, y: number, top: number): [Vec3, Vec3] =>
    along ? [[x0, y, z0 + inset], [x1, top, z1 - inset]] : [[x0 + inset, y, z0], [x1 - inset, top, z1]];
  // Only the top rail and the posts: a base and a middle rail inside the run would read as steps up onto it.
  const parts: [Vec3, Vec3][] = [span(0.06, h - 0.2, h)];
  for (let a = (along ? x0 : z0) + 0.2; a <= (along ? x1 : z1); a += RAIL_POST_STEP) {
    const [x, z] = along ? [a, c] : [c, a];
    parts.push([[x - 0.15, 0.24, z - 0.15], [x + 0.15, h - 0.2, z + 0.15]]);
  }
  return parts;
}

/** The piece's footprint turned so `l` runs along its longer side: boxes centred `off` along it with half-extents `hl` × `hd`. */
function frame(q: Piece) {
  const [cx, cz] = [(q.min[0] + q.max[0]) / 2, (q.min[2] + q.max[2]) / 2];
  const [w, h, dd] = [q.max[0] - q.min[0], q.max[1] - q.min[1], q.max[2] - q.min[2]];
  const along = w >= dd;
  const y0 = q.min[1];
  const part = (off: number, hl: number, hd: number, a: number, b: number): [Vec3, Vec3] => {
    const [x, z, hx, hz] = along ? [cx + off, cz, hl, hd] : [cx, cz + off, hd, hl];
    return [[x - hx, y0 + a, z - hz], [x + hx, y0 + b, z + hz]];
  };
  /** A round rim of radius `r` as an octagon of three boxes. */
  const disc = (r: number, a: number, b: number) => [part(0, r * 0.71, r * 0.71, a, b), part(0, r, r * 0.38, a, b), part(0, r * 0.38, r, a, b)];
  return { part, disc, L: Math.max(w, dd), D: Math.min(w, dd), h, w, dd, cx, cz };
}

/** temple-things' open props: a roof on posts over a low solid part, a rounded rim, a planter's bush, a rock. */
function propParts(q: Piece): [Vec3, Vec3][] | undefined {
  const { part, disc, L, D, h } = frame(q);
  const roof = (a: number) => part(0, L / 2, D / 2, a, h);
  const posts = (off: number, r: number, a: number, b: number) => [part(-off, r, r, a, b), part(off, r, r, a, b)];
  switch (q.tag ?? 'boulder') {
    case 'bell':
      return [part(0, L / 2, D / 2, 0, 0.4), part(0, D * 0.45, D * 0.45, 0.4, h - 0.7), ...posts(L / 2 - 0.2, 0.16, 0.4, h - 0.4), roof(h - 0.5)];
    case 'well':
      return [...disc(L / 2 - 0.1, 0, 0.9), ...posts(L / 2 - 0.25, 0.1, 0.9, h - 0.8), roof(h - 0.8)];
    case 'stall':
      return [part(0, L / 2, D / 2, 0, 1.0), roof(h - 0.2)];
    case 'cart':
      return [part(0, L / 2, D / 2, 0, h - 0.4)];
    case 'planter':
      return [part(0, L / 2, D / 2, 0, h - 0.3), part(0, L * 0.42, D * 0.42, h - 0.3, h)];
    case 'boulder':
      // One block: a ledge on its lower lump would be a step up onto its top beside the edge rails.
      return [part(0, L * 0.45, D * 0.42, 0, h)];
    default:
      return undefined;
  }
}

/** temple-art `stele`: plinth, a slimmer shaft, the cap. */
function steleParts(q: Piece): [Vec3, Vec3][] {
  const { part, L, D, h } = frame(q);
  return [part(0, L / 2, D / 2, 0, 0.5), part(0, (L - 0.3) / 2, Math.max(0.3, D - 0.3) / 2, 0.5, h - 0.6), part(0, L / 2, D / 2, h - 0.6, h)];
}

/** temple-art `ruin`: a broken lower course and a narrower block on it, set off to one side by the same seed. */
function ruinParts(q: Piece): [Vec3, Vec3][] {
  const { w, h, dd, cx, cz } = frame(q);
  const off = new Rng(Math.round(cx * 7 + cz * 3)).range(-0.2, 0.2) * w;
  const y0 = q.min[1];
  return [
    [q.min, [q.max[0], y0 + h * 0.55, q.max[2]]],
    [[cx + off - w * 0.35, y0 + h * 0.55, cz - dd * 0.45], [cx + off + w * 0.35, q.max[1], cz + dd * 0.45]]
  ];
}
