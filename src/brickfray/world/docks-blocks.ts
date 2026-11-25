import type { Face } from './blocks';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, hashString, shade } from './util';

const L = 6.0;
const W = 2.4;
const H = 2.56;
const FRAME = '#2f363d';
const BAR = '#b7bcc2';

export interface ContainerBlockParams {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  levels: number;
  /** Containers run along x or along z; the block's sides along that axis must be whole multiples of 6 m. */
  along: 'x' | 'z';
  colors: readonly string[];
  /** Faces that can be seen (others are against another mass); default all four. */
  faces?: Face[];
  /** Extra boxes standing on top (silhouette only): grid cells [i, j] from the block's min corner. */
  crown?: [number, number][];
}

/**
 * A solid block of stacked containers that reads as a yard wall: one collider, and only the outer containers' faces
 * drawn (corrugated panel, frame rails, corner posts, door bars on the ends), with plain lids on top. It costs a
 * fraction of the same containers drawn one by one, and nobody can tell: no gaps, nothing behind the faces.
 */
export const CONTAINER_BLOCK: Element<ContainerBlockParams> = {
  colliders: (p) => [box([p.x0, 0, p.z0], [p.x1, p.levels * H, p.z1], 'metal')],
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    // Whole containers: a side that is not a multiple of the container size stretches each one a little to fit.
    const nx = Math.max(1, Math.round((p.x1 - p.x0) / (p.along === 'x' ? L : W)));
    const nz = Math.max(1, Math.round((p.z1 - p.z0) / (p.along === 'x' ? W : L)));
    const cx = (p.x1 - p.x0) / nx;
    const cz = (p.z1 - p.z0) / nz;
    const seed = hashString(`${p.x0},${p.z0}`);
    const color = (i: number, j: number, k: number) => p.colors[(seed + i * 7 + j * 13 + k * 5 + ((i * j + k) % 3)) % p.colors.length]!;
    const top = p.levels * H;
    t.span(p.x0 + 0.06, 0, p.z0 + 0.06, p.x1 - 0.06, top - 0.02, p.z1 - 0.06, '#3a3f44', undefined, 0);
    for (const face of p.faces ?? (['n', 's', 'e', 'w'] as Face[])) {
      const alongFace = face === 'n' || face === 's';
      const count = alongFace ? nx : nz;
      const size = alongFace ? cx : cz;
      const doorEnd = (p.along === 'z') === alongFace;
      for (let k = 0; k < p.levels; k++) {
        for (let i = 0; i < count; i++) {
          const [gi, gj] = alongFace ? [i, face === 'n' ? 0 : nz - 1] : [face === 'w' ? 0 : nx - 1, i];
          containerFace(d, t, p, face, i * size, size, k * H, color(gi, gj, k), doorEnd);
        }
      }
    }
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const c = shade(color(i, j, p.levels - 1), -0.12);
        t.span(p.x0 + i * cx + 0.04, top - 0.02, p.z0 + j * cz + 0.04, p.x0 + (i + 1) * cx - 0.04, top + 0.03, p.z0 + (j + 1) * cz - 0.04, c, 'metal', 0);
      }
    }
    for (const [i, j] of p.crown ?? []) {
      const c = color(i + 3, j + 1, p.levels);
      d.siding.box([p.x0 + i * cx + 0.05, top + 0.03, p.z0 + j * cz + 0.05], [p.x0 + (i + 1) * cx - 0.05, top + H, p.z0 + (j + 1) * cz - 0.05], c);
    }
  }
};

/** One container's face on a block side: `u` along the face from its start corner, `size` its width there. */
function containerFace(d: Drawer, t: Pen, p: ContainerBlockParams, face: Face, u: number, size: number, y: number, c: string, doorEnd: boolean) {
  const out = 0.05;
  const rect = (a: number, b: number, y0: number, y1: number, depth: number, color: string, finish: 'metal' | undefined = 'metal') => {
    if (face === 'n') t.span(p.x0 + u + a, y0, p.z0 - depth, p.x0 + u + b, y1, p.z0, color, finish, 0);
    else if (face === 's') t.span(p.x0 + u + a, y0, p.z1, p.x0 + u + b, y1, p.z1 + depth, color, finish, 0);
    else if (face === 'w') t.span(p.x0 - depth, y0, p.z0 + u + a, p.x0, y1, p.z0 + u + b, color, finish, 0);
    else t.span(p.x1, y0, p.z0 + u + a, p.x1 + depth, y1, p.z0 + u + b, color, finish, 0);
  };
  const panel = (a: number, b: number, y0: number, y1: number, color: string) => {
    if (face === 'n') d.siding.box([p.x0 + u + a, y0, p.z0 - out], [p.x0 + u + b, y1, p.z0], color);
    else if (face === 's') d.siding.box([p.x0 + u + a, y0, p.z1], [p.x0 + u + b, y1, p.z1 + out], color);
    else if (face === 'w') d.siding.box([p.x0 - out, y0, p.z0 + u + a], [p.x0, y1, p.z0 + u + b], color);
    else d.siding.box([p.x1, y0, p.z0 + u + a], [p.x1 + out, y1, p.z0 + u + b], color);
  };
  const frame = shade(c, -0.25);
  panel(0.14, size - 0.14, y + 0.16, y + H - 0.14, c);
  rect(0, size, y, y + 0.16, out + 0.02, frame);
  rect(0, size, y + H - 0.14, y + H, out + 0.02, frame);
  for (const a of [0, size - 0.14]) rect(a, a + 0.14, y, y + H, out + 0.03, FRAME);
  if (!doorEnd) {
    if (d.detail > 0) rect(size - 1.3, size - 0.55, y + H - 0.8, y + H - 0.4, out + 0.01, '#e9e6dc', undefined);
    return;
  }
  rect(size / 2 - 0.02, size / 2 + 0.02, y + 0.16, y + H - 0.14, out + 0.01, frame);
  if (d.detail === 0) return;
  for (const a of [size * 0.3, size * 0.7]) rect(a - 0.03, a + 0.03, y + 0.2, y + H - 0.2, out + 0.04, BAR);
}

/**
 * Sign gantry over a lane's mouth on the base road: two posts flush with the masses either side, a beam at 5.2 m and
 * the lane's colour band (quay blue, yard yellow, shed red), so a player leaving the base reads which road is which.
 */
export const SIGN_GANTRY: Element<{ x: number; z0: number; z1: number; band: string }> = {
  colliders: (p) => [box([p.x - 0.15, 0, p.z0], [p.x + 0.15, 5.6, p.z0 + 0.3], 'metal'), box([p.x - 0.15, 0, p.z1 - 0.3], [p.x + 0.15, 5.6, p.z1], 'metal')],
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    const steel = '#4a5259';
    for (const z of [p.z0 + 0.15, p.z1 - 0.15]) t.box(p.x, 0, z, 0.3, 5.6, 0.3, steel, 'metal', 0.02);
    t.span(p.x - 0.2, 5.0, p.z0, p.x + 0.2, 5.6, p.z1, steel, 'metal', 0);
    const mid = (p.z0 + p.z1) / 2;
    t.span(p.x - 0.26, 4.1, mid - 2.4, p.x + 0.26, 5.0, mid + 2.4, p.band, undefined, 0);
    t.span(p.x - 0.3, 4.35, mid - 1.6, p.x + 0.3, 4.75, mid + 1.6, '#f2f2ee', undefined, 0);
  }
};

/** Concrete jersey barrier, 3.2 m along local x, 0.8 m high: crouch cover that stops nothing above it. */
export const JERSEY: Element<{ x: number; z: number; turns?: number; color?: string }> = {
  colliders: (p) => [new Frame(p.x, 0, p.z, p.turns ?? 0).box([-1.6, 0, -0.3], [1.6, 0.8, 0.3], 'stone')],
  draw(d, p) {
    const t = new Pen(d, new Frame(p.x, 0, p.z, p.turns ?? 0));
    const c = p.color ?? '#d9d4c7';
    t.prism('jersey', [[-0.3, 0], [0.3, 0], [0.12, 0.3], [0.1, 0.8], [-0.1, 0.8], [-0.12, 0.3]], 3.2, 0, 0, 0, c);
    if (d.detail > 0) for (const x of [-1.2, 1.2]) t.box(x, 0.45, 0, 0.5, 0.12, 0.42, shade(c, -0.35), undefined, 0);
  }
};

