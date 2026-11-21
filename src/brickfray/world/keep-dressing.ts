import { drawBlock, slab, type Masonry } from './blocks';
import type { Drawer } from './plan';
import { BANNER } from './props-castle';
import { Pen } from './props-kit';
import { box, Frame, type PlanCollider, type Vec3 } from './util';

export interface KeepSize {
  half: number;
  roof: number;
  slab: number;
  door: number;
}

/** How far the corbelled parapet and merlons stand out from the keep walls. */
export const PARAPET_OUT = 0.32;

const BUTTRESS: Masonry = { colors: ['#bdb6a5', '#b1aa99', '#c8c1b0'], variance: 0.25, lens: [2, 3] };
const TRIM = '#e4ddcc';
const CORBEL = '#b3ab98';
const PLINTH = '#8f897c';
const SLIT = '#1b1d20';
const IRON = '#3a4148';
const RED = ['#c8231b', '#f6c624'];
const BLUE = ['#1f62c7', '#f2f2ee'];

const BUTTRESS_W = 0.9;
const STAGES = [
  { y0: 0, y1: 2.2, out: 0.3 },
  { y0: 2.2, y1: 3.4, out: 0.18 }
] as const;
const PORTCULLIS = { bottom: 2.12, z: -0.3 } as const;

interface Side {
  frame: Frame;
  door: boolean;
  /** North and south sides wrap their buttresses and parapet round the corners. */
  wraps: boolean;
}

function sides(k: KeepSize): Side[] {
  const h = k.half;
  return [
    { frame: new Frame(0, 0, h, 0), door: true, wraps: true },
    { frame: new Frame(0, 0, -h, 2), door: true, wraps: true },
    { frame: new Frame(h, 0, 0, 1), door: true, wraps: false },
    { frame: new Frame(-h, 0, 0, 3), door: false, wraps: false }
  ];
}

/** World boxes of the clasping corner buttresses, one per side and corner and stage. */
function buttressBoxes(k: KeepSize) {
  const out: { min: Vec3; max: Vec3; stage: number }[] = [];
  for (const s of sides(k)) {
    for (const end of [-1, 1]) {
      STAGES.forEach((st, stage) => {
        const reach = k.half + (s.wraps ? st.out : 0);
        const u0 = end < 0 ? -reach : k.half - BUTTRESS_W;
        const u1 = end < 0 ? -k.half + BUTTRESS_W : reach;
        const a = s.frame.p(u0, st.y0, 0);
        const b = s.frame.p(u1, st.y1, st.out);
        out.push({ min: [Math.min(a[0], b[0]), st.y0, Math.min(a[2], b[2])], max: [Math.max(a[0], b[0]), st.y1, Math.max(a[2], b[2])], stage });
      });
    }
  }
  return out;
}

/** Colliders for the keep's dressing: buttresses (whole height at the lower stage's depth) and raised portcullis bars. */
export function keepDressColliders(k: KeepSize): PlanCollider[] {
  const out = buttressBoxes(k)
    .filter((b) => b.stage === 0)
    .map((b) => box(b.min, [b.max[0], STAGES[1].y1, b.max[2]], 'stone'));
  for (const s of sides(k)) {
    if (s.door) out.push(s.frame.box([-k.door, PORTCULLIS.bottom, PORTCULLIS.z - 0.06], [k.door, 2.56, PORTCULLIS.z + 0.06], 'metal', { bulletsPass: true }));
  }
  return out;
}

/**
 * Dresses the keep's four faces: clasping corner buttresses, a dark plinth course, arrow slits with stone
 * surrounds, door portals with a stepped arch and a raised portcullis, a corbel table under the projecting
 * parapet, and banners in the colours of the side each face looks at.
 */
export function keepDressing(d: Drawer, k: KeepSize) {
  for (const b of buttressBoxes(k)) {
    drawBlock(d, { min: b.min, max: b.max, surface: 'stone', style: BUTTRESS, faces: ['n', 's', 'e', 'w'] });
    slab(d, [b.min[0] - 0.03, b.max[1], b.min[2] - 0.03], [b.max[0] + 0.03, b.max[1] + 0.1, b.max[2] + 0.03], TRIM);
  }
  for (const s of sides(k)) face(d, k, s);
}

function face(d: Drawer, k: KeepSize, s: Side) {
  const h = k.half;
  const t = new Pen(d, s.frame);
  const inner = h - BUTTRESS_W;
  const runs: [number, number][] = s.door ? [[-inner, -1.2], [1.2, inner]] : [[-inner, inner]];
  for (const [u0, u1] of runs) t.box((u0 + u1) / 2, 0, 0.03, u1 - u0, 0.36, 0.06, PLINTH, undefined, 0.01);

  for (const u of s.door ? [-3.75, 3.75] : [-3.75, 0, 3.75]) slit(t, u, 2.4);

  if (s.door) portal(t, k);

  for (let u = -h + 0.4; u < h - 0.2; u += 0.8) {
    t.box(u, 3.64, 0.1, 0.3, 0.18, 0.2, CORBEL, undefined, 0.01);
    t.box(u, 3.82, 0.15, 0.3, 0.18, 0.3, CORBEL, undefined, 0.01);
  }
  for (const u of [-2.5, 2.5]) {
    const [x, , z] = s.frame.p(u, 0, 0);
    BANNER.draw(d, { x, z, y: 3.58, turns: s.frame.turns, colors: z > 0 ? RED : BLUE, width: 1.0, height: 1.5, pattern: 'border' });
  }
}

/** Tall arrow slit: a dark core behind protruding jambs, sill and lintel, so it reads as cut into the wall. */
function slit(t: Pen, u: number, y0: number) {
  const h = 1.1;
  t.box(u, y0, 0.012, 0.14, h, 0.024, SLIT, undefined, 0);
  for (const s of [-1, 1]) t.box(u + s * 0.15, y0 - 0.04, 0.05, 0.16, h + 0.08, 0.1, TRIM, undefined, 0.01);
  t.box(u, y0 - 0.16, 0.07, 0.6, 0.12, 0.14, TRIM, undefined, 0.01);
  t.box(u, y0 + h + 0.04, 0.06, 0.52, 0.16, 0.12, TRIM, undefined, 0.01);
}

/** Dressed jambs, a stepped arch with keystone over the lintel, and the raised portcullis in the doorway. */
function portal(t: Pen, k: KeepSize) {
  for (const s of [-1, 1]) t.box(s * 1.05, 0, 0.07, 0.3, 2.56, 0.14, TRIM, undefined, 0.02);
  t.box(0, 2.88, 0.06, 1.9, 0.2, 0.12, TRIM, undefined, 0.01);
  t.box(0, 3.08, 0.06, 1.1, 0.18, 0.12, TRIM, undefined, 0.01);
  t.box(0, 2.86, 0.11, 0.36, 0.52, 0.22, '#f0ead9', undefined, 0.02);
  const z = PORTCULLIS.z;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = -k.door + 0.1 + (i * (2 * k.door - 0.2)) / (n - 1);
    t.box(x, PORTCULLIS.bottom + 0.1, z, 0.06, 2.56 - PORTCULLIS.bottom - 0.1, 0.06, IRON, 'metal', 0);
    t.cone(x, PORTCULLIS.bottom, z, 0.006, 0.04, 0.1, IRON, 'metal', 4);
  }
  t.box(0, PORTCULLIS.bottom + 0.18, z, 2 * k.door, 0.06, 0.08, IRON, 'metal', 0);
}
