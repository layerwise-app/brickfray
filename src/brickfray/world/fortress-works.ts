import { drawBlock, slab, STAIRS, type Masonry, type StairParams } from './blocks';
import { CASTLE_STONE, WALK_TILE } from './castle-parts';
import { core } from './fortress-core';
import { east } from './fortress-east';
import { north } from './fortress-north';
import { F, Works, type Flight, type Kind, type Piece, type Roof } from './fortress-plan';
import { south } from './fortress-south';
import { drawEdge, edges, SEE_THROUGH } from './fortress-edge';
import { exposure, FORTRESS_TRIM, shedRoof } from './fortress-trim';
import { west } from './fortress-west';
import type { Drawer, Element } from './plan';
import { drawRoof, roofHeight } from './roofs';
import { box, type PlanCollider } from './util';

export function fortressWorks(): Works {
  const w = new Works();
  north(w);
  west(w);
  core(w);
  east(w);
  south(w);
  edges(w);
  return w;
}

const WALL: Masonry = { colors: ['#a8a294', '#9c9588', '#b4ae9f'], variance: 0.3, lens: [3, 4, 2] };
const TIMBER: Masonry = { colors: ['#9a6a3f', '#8a5f3a', '#a67c52'], variance: 0.25, lens: [4, 6] };
const STYLE: Partial<Record<Kind, Masonry>> = {
  curtain: CASTLE_STONE,
  wall: WALL,
  screen: WALL,
  hall: { colors: ['#d3ccbb', '#c4bdab', '#ddd7c8', '#b9b2a2'], variance: 0.3, lens: [3, 4, 2, 5] },
  timber: TIMBER,
  stall: TIMBER,
  pillar: TIMBER,
  tower: { colors: ['#7f8287', '#717479', '#8c8f93', '#676a6f'], variance: 0.3, lens: [3, 4, 2, 5] },
  rubble: { colors: ['#8f897c', '#7f796d', '#9c9588'], variance: 0.4, lens: [2, 3] },
  bank: { colors: ['#7d8276', '#6f7469', '#878c80'], variance: 0.4, lens: [2, 3, 5] },
  hay: { colors: ['#e3c25a', '#d6b24a', '#ecd06a'], variance: 0.3, lens: [2, 3], course: 0.64 }
};
const PLAIN: Masonry = { colors: ['#b8b1a3', '#a8a294'], variance: 0.25 };
/** Each district keeps its own stone for its low walls: mossy in the west lane, river grey in the east, ochre in the upper ward, red sandstone in the barbican. */
const MOSSY: Masonry = { colors: ['#8e9a7e', '#828f74', '#9aa588', '#76845f'], variance: 0.35, lens: [2, 3, 4] };
const RIVER: Masonry = { colors: ['#8f989c', '#848c91', '#9aa2a5', '#7a8287'], variance: 0.35, lens: [2, 3, 4] };
const SANDSTONE: Masonry = { colors: ['#b98f72', '#aa8269', '#c59d7f'], variance: 0.3, lens: [3, 4, 2] };
const OCHRE: Masonry = { colors: ['#c09a70', '#b38d66', '#caa67c', '#a7835e'], variance: 0.3, lens: [3, 4, 2] };
const LOCAL = new Set<Kind>(['wall', 'screen', 'parapet', 'block']);

function styleOf(q: Piece): Masonry {
  const base = STYLE[q.kind] ?? PLAIN;
  if (!LOCAL.has(q.kind)) return base;
  const [x, z] = [(q.min[0] + q.max[0]) / 2, (q.min[2] + q.max[2]) / 2];
  if (x < F.core0 - 1.0) return MOSSY;
  if (x > F.core1 + 1.0) return RIVER;
  if (z > F.bandS) return SANDSTONE;
  if (z < F.hall) return OCHRE;
  return base;
}
const SURFACE: Partial<Record<Kind, 'wood' | 'foliage' | 'metal'>> = { timber: 'wood', deck: 'wood', stakes: 'wood', paling: 'wood', gate: 'wood', hay: 'foliage', hedge: 'foliage', grille: 'metal' };

const stairParams = (f: Flight): StairParams => ({
  ...f,
  rise: F.rise,
  run: F.run,
  style: f.wood ? { colors: ['#8a5f3a', '#9a6a3f'], variance: 0.3 } : CASTLE_STONE,
  surface: f.wood ? 'wood' : 'stone',
  topColor: f.wood ? '#b98a5a' : WALK_TILE
});

const roofCollider = (r: Roof) => box([r.x0, r.base, r.z0], [r.x1, r.base + roofHeight('gable', r) - 0.3, r.z1], 'stone');

export const WORKS: Element<Works> = {
  colliders(w) {
    const out: PlanCollider[] = w.pieces.map((q) => box(q.min, q.max, q.surface ?? SURFACE[q.kind] ?? 'stone', { walk: q.walk, bulletsPass: q.bulletsPass ?? (SEE_THROUGH.has(q.kind) || undefined) }));
    for (const f of w.flights) out.push(...STAIRS.colliders!(stairParams(f)));
    for (const r of w.roofs) out.push(roofCollider(r));
    return out;
  },
  nav: (w) => [...w.seeds, ...w.flights.flatMap((f) => STAIRS.nav!(stairParams(f)))],
  draw(d, w) {
    for (const q of w.pieces) drawPiece(d, q, w.pieces);
    for (const f of w.flights) STAIRS.draw(d, stairParams(f));
    for (const r of w.roofs) {
      if (r.small) shedRoof(d, r);
      else drawRoof(d, { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, height: r.base, face: r.face, roof: 'gable', roofColor: r.color, wall: [r.wall], trim: '#e4ddcc' });
    }
    FORTRESS_TRIM.draw(d, w);
  }
};

function drawPiece(d: Drawer, q: Piece, all: Piece[]) {
  if (q.kind === 'wheel' || drawEdge(d, q)) return;
  if (q.kind === 'ford') {
    d.anim.water(q.min[0], q.min[2], q.max[0], q.max[2], F.water, '#3f8f96');
    drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: { colors: ['#6f6a5c'], variance: 0.2 }, faces: [], top: 'studs', topColor: '#7d7560' });
    return;
  }
  const e = exposure(q, all);
  if (!e.faces.length && !e.top) return;
  const style = styleOf(q);
  // Tops over 6 m are seen only from above the map: one flat skin instead of rows of plates.
  const high = e.top && !q.walk && q.max[1] >= 6.0;
  const top = q.kind === 'deck' || q.walk ? 'tiles' : e.top && !high ? (q.max[1] <= 2.5 ? 'studs' : 'tiles') : 'none';
  drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style, faces: e.faces, top, topColor: q.kind === 'deck' ? '#b98a5a' : q.walk ? WALK_TILE : '#b8b1a3' });
  if (high) slab(d, [q.min[0], q.max[1], q.min[2]], [q.max[0], q.max[1] + 0.012, q.max[2]], '#b8b1a3');
}
