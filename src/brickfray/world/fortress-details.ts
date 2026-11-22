import { FLANK_SHEDS } from './fortress-core';
import { MILL, WHEEL } from './fortress-east';
import { HEARTH, OVEN } from './fortress-north';
import { F, type Works } from './fortress-plan';
import { exposure } from './fortress-trim';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { Frame, Rng, type Face } from './util';

const SOOT = '#231c18';
const DRESSED = '#d8cfba';
const OAK = '#5e3f27';
const PLANK = '#8a5f3a';
const EMBER = '#ffb060';

/** Fires, the mill wheel, reeds and foam on the ford, and the small furniture that tells each room what it is. */
export const FORTRESS_DETAILS: Element<Works> = {
  draw(d, w) {
    fires(d);
    millWheel(d);
    river(d);
    furniture(d);
    tufts(d, w);
  }
};

/** Grass tufts where the yards meet the outdoor walls (no collider: ankle high). */
function tufts(d: Drawer, w: Works) {
  if (d.detail === 0) return;
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const rng = new Rng(17);
  const greens = ['#5f9a3c', '#6fa845', '#4f8a34', '#7fb04f'];
  for (const q of w.pieces) {
    if (q.min[1] > 0.01 || !(q.kind === 'curtain' || q.kind === 'wall' || q.kind === 'tower' || q.kind === 'bank')) continue;
    for (const face of exposure(q, w.pieces).faces) {
      const alongX = face === 'n' || face === 's';
      const [a0, a1] = alongX ? [q.min[0], q.max[0]] : [q.min[2], q.max[2]];
      const out = face === 's' ? q.max[2] + 0.18 : face === 'n' ? q.min[2] - 0.18 : face === 'e' ? q.max[0] + 0.18 : q.min[0] - 0.18;
      for (let a = a0 + 0.6; a < a1 - 0.6; a += rng.range(2.2, 3.6)) {
        if (rng.chance(0.35)) continue;
        const blades = rng.int(3, 5);
        for (let k = 0; k < blades; k++) {
          const u = a + rng.range(-0.25, 0.25);
          const v = out + (face === 's' || face === 'e' ? 1 : -1) * rng.range(0, 0.22);
          const [x, z] = alongX ? [u, v] : [v, u];
          t.cone(x, 0, z, 0.07, 0.01, rng.range(0.22, 0.42), rng.pick(greens), undefined, 4, rng.range(0, 3));
        }
      }
    }
  }
}

/** Frame on the given face of a box, local +z pointing out of the face, origin at the face's middle on the floor. */
function onFace(face: Face, x0: number, z0: number, x1: number, z1: number, y = 0): Frame {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  if (face === 's') return new Frame(cx, y, z1, 0);
  if (face === 'n') return new Frame(cx, y, z0, 2);
  if (face === 'e') return new Frame(x1, y, cz, 1);
  return new Frame(x0, y, cz, 3);
}

/** A hearth mouth with its surround, logs and a flame on a wall face. */
function hearth(d: Drawer, f: Frame, w: number, h: number) {
  const t = new Pen(d, f);
  t.box(0, 0, 0.01, w, h, 0.05, SOOT, undefined, 0);
  for (const s of [-1, 1]) t.box(s * (w / 2 + 0.16), 0, 0.08, 0.32, h + 0.12, 0.2, DRESSED, undefined, 0.03);
  t.box(0, h, 0.1, w + 0.8, 0.26, 0.26, DRESSED, undefined, 0.03);
  t.cylX(-w / 2 + 0.25, 0.14, 0.2, 0.1, w - 0.5, OAK, undefined, 0.02);
  if (d.detail > 0) t.cylX(-w / 2 + 0.35, 0.3, 0.24, 0.08, w - 0.8, '#4a3220', undefined, 0.02);
  d.anim.flame(f.p(0, 0.32, 0.26));
  const [x, , z] = f.p(0, 0, 1.0);
  d.anim.pools.add(x, z, 0.006, 2.2, EMBER, 0.45);
}

function fires(d: Drawer) {
  // Great hall hearth stack, both long faces; the garden's bake oven; the smithy's forge; the bakehouse oven.
  hearth(d, onFace('n', ...HEARTH), 1.8, 1.2);
  hearth(d, onFace('s', ...HEARTH), 1.8, 1.2);
  hearth(d, onFace('s', ...OVEN), 1.4, 0.9);
  hearth(d, onFace('s', ...FLANK_SHEDS[3]!), 1.4, 0.9);
  hearth(d, onFace('n', 16.0, 23.2, 20.0, 27.6), 1.2, 0.8);
}

/** Undershot wheel on the mill's north face, its foot in the ford. */
function millWheel(d: Drawer) {
  const [cx, cz] = [(F.ford0 + WHEEL.x1) / 2, WHEEL.z0 - 0.3];
  const t = new Pen(d, new Frame(cx, 1.0, cz, 0));
  const r = 2.1;
  for (const z of [-0.26, 0.26]) t.ringUp(0, 0, z, r, 0.09, OAK);
  t.cylZ(0, 0, 0, 0.3, 0.8, '#3a4148', 'metal', 0.03);
  const n = d.detail === 0 ? 8 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    t.beam(0, 0, -0.26, c * r, s * r, -0.26, 0.09, PLANK);
    t.beam(0, 0, 0.26, c * r, s * r, 0.26, 0.09, PLANK);
    t.box(c * (r + 0.05), s * (r + 0.05) - 0.25, 0, 0.12, 0.5, 0.62, PLANK, undefined, 0.01, 0);
  }
  d.anim.foam.edge(F.ford0, WHEEL.z0 - 0.6, WHEEL.x1, WHEEL.z0 - 0.6, F.water, 0, -1, 0.7);
  d.anim.foam.edge(MILL.x1, MILL.z0, MILL.x1, MILL.z1, F.water, 1, 0, 0.5);
  d.anim.foam.edge(F.ford0, MILL.z1, MILL.x1, MILL.z1, F.water, 0, 1, 0.5);
}

/** Reeds along the near bank of the ford and round the island, foam where the water meets the bank, the jetty's posts. */
function river(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const rng = new Rng(41);
  const clear = (z: number) => (z > WHEEL.z0 - 0.8 && z < MILL.z1 + 0.8) || (z > 17.6 && z < 22.4);
  const step = d.detail === 0 ? 4.8 : 2.6;
  for (const [x, dir] of [[F.ford0 + 0.35, 1]] as const) {
    for (let z = F.bandN + 1.2; z < 39; z += step) {
      if (clear(z) || rng.chance(0.25)) continue;
      const n = d.detail === 0 ? 3 : 6;
      for (let k = 0; k < n; k++) {
        const rx = x + dir * rng.range(0, 0.5);
        const rz = z + rng.range(-0.6, 0.6);
        const h = rng.range(0.7, 1.3);
        t.cyl(rx, F.ford, rz, 0.03, h + 0.4, rng.pick(['#5d8a3a', '#6f9a44', '#4f7a34']), undefined, 0, 5);
        if (k % 2 === 0) t.cyl(rx, F.ford + h + 0.1, rz, 0.05, 0.22, '#6e4a2f', undefined, 0.02, 6);
      }
    }
    d.anim.foam.edge(x - dir * 0.35, F.bandN, x - dir * 0.35, WHEEL.z0, F.water, dir, 0, 0.7);
    d.anim.foam.edge(x - dir * 0.35, MILL.z1, x - dir * 0.35, 40, F.water, dir, 0, 0.7);
  }
  for (const [x, z] of [[37.0, 18.6], [37.0, 21.4]] as const) {
    t.cyl(x, F.ford, z, 0.14, 1.1, '#6e4a2f', undefined, 0.03);
    d.anim.foam.ring(x, z, F.water, 0.16, 0.25, 8);
  }
}

/** Boards on the hall tables, the altar cloth, market produce, hay wagon wheels, log ends in the court's timber stack. */
function furniture(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const fine = d.detail > 0;
  // Great hall: cloth and plates on the long table and the high table.
  t.box(-10.4, 0.96, -34.8, 4.6, 0.04, 0.7, '#c7b08a', undefined, 0);
  t.box(-1.2, 0.96, -33.2, 0.7, 0.04, 3.8, '#c7b08a', undefined, 0);
  if (fine) {
    for (const x of [-12.0, -10.8, -9.6, -8.4]) t.cyl(x, 1.0, -34.8, 0.18, 0.03, '#d9d2c3', undefined, 0, 10);
    for (const z of [-34.4, -33.2, -32.0]) t.cyl(-1.2, 1.0, z, 0.18, 0.03, '#d9d2c3', undefined, 0, 10);
  }
  // Altar cloth and candles.
  t.box(14.4, 1.2, -32.8, 1.7, 0.04, 4.1, '#f2ede0', undefined, 0);
  for (const z of [-34.0, -31.6]) t.box(15.22, 0.5, z, 0.04, 0.74, 0.5, '#b8402f', undefined, 0);
  for (const z of [-33.8, -31.8]) {
    t.cyl(14.4, 1.24, z, 0.05, 0.36, '#f4ecd2', undefined, 0, 6);
    d.anim.flame([14.4, 1.66, z]);
  }
  // Market stalls: a tray of produce at each end of every counter.
  const fruit = ['#c8231b', '#f6c624', '#4f9a3c', '#e07a2a'];
  const top = F.rail;
  [-17.6, -13.6, -9.6].forEach((x0, i) => {
    for (const [k, x] of [x0 + 0.7, x0 + 2.5].entries()) {
      t.box(x, top, 19.6, 0.8, 0.18, 0.56, PLANK, undefined, 0.01);
      if (fine) for (let j = 0; j < 4; j++) t.ball(x - 0.2 + (j % 2) * 0.4, top + 0.28, 19.48 + Math.floor(j / 2) * 0.24, 0.1, fruit[(i + k) % 4]!);
    }
  });
  // Hay wagons in the inner court and the outer bailey, the bailey's timber cart: wheels on their long sides, shafts.
  for (const [x0, z0, x1, z1, dir] of [[-15.2, -21.6, -12.0, -19.2, -1], [5.6, 21.6, 8.8, 24.0, 1], [-16.0, 13.6, -13.6, 15.2, 1]] as const) {
    for (const x of [x0 + 0.7, x1 - 0.7]) for (const z of [z0 - 0.06, z1 + 0.06]) {
      t.cylZ(x, 0.5, z, 0.5, 0.1, OAK, undefined, 0.02);
      if (fine) t.cylZ(x, 0.5, z, 0.12, 0.16, '#3a4148', 'metal');
    }
    const end = dir < 0 ? x0 : x1;
    for (const z of [(z0 + z1) / 2 - 0.5, (z0 + z1) / 2 + 0.5]) t.beam(end, 0.6, z, end + dir * 1.2, 0.45, z, 0.08, OAK);
  }
  // Log ends in the faces of the court's timber stack and the bailey woodpile.
  if (fine) {
    const rng = new Rng(7);
    const logs = (x: number, z0: number, z1: number, rows: number) => {
      for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.6) for (let j = 0; j < rows; j++) {
        t.cylX(x - 0.03, 0.3 + j * 0.5, z + (j % 2) * 0.3 - 0.15, 0.22, 0.06, rng.pick(['#c9a27a', '#b88f62', '#d4b088']), undefined, 0.02);
      }
    };
    logs(14.4 - 0.03, -21.6, -16.0, 4);
    logs(-17.6, 22.4, 24.8, 4);
  }
}
