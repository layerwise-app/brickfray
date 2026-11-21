import { DECAL, GROUND, VISUAL, type GroundParams } from './blocks';
import type { Element, Plan } from './plan';
import { Pen } from './props-kit';
import { Frame, Rng, shade } from './util';
import { WH } from './warehouse';

const STUD = 0.4;
const PLATE = 4.8;
const CONCRETE = '#c4b9a2';
const ASPHALT = '#8a8378';
const INTERIOR = '#a2a39e';
const YELLOW = '#f6c624';
const WHITE = '#f2f2ee';
const PAINT = 0.004;
const YARD = { z0: -14.4, z1: 4.8 } as const;

/** The quay's walkable floor; its look comes from separate plates so no two studded layers overlap. */
const FLOOR: Element<GroundParams> = { colliders: GROUND.colliders, draw() {} };

const down = (v: number) => Math.floor(v / STUD + 1e-6) * STUD;
const up = (v: number) => Math.ceil(v / STUD - 1e-6) * STUD;
const inside = (x: number, z: number) => x >= WH.x0 - 0.01 && x < WH.x1 && z < WH.z1;

/**
 * Quay surface in the brick language: concrete baseplates (each a slightly different pour) around a darker yard,
 * worn patches and oil stains as off-tone plates, markings as smooth one-stud tiles, drain grates and manhole
 * covers as 2x2 tiles.
 */
export function docksGround(p: Plan, edge: number, back: number, quay: number) {
  p.add(FLOOR, { x0: -edge, z0: back, x1: edge, z1: quay, y: 0, color: CONCRETE, surface: 'stone' });
  const rng = new Rng(77);
  const plate = (x0: number, z0: number, x1: number, z1: number, color: string, y = 0) =>
    p.add(DECAL, { x0, z0, x1, z1, y, color, surface: 'stone' });
  const tile = (x0: number, z0: number, x1: number, z1: number, color: string, y = PAINT) =>
    p.add(DECAL, { x0, z0, x1, z1, y, color, surface: 'stone', smooth: true });

  const xs = [-edge];
  for (let x = -Math.floor(edge / PLATE) * PLATE; x < edge; x += PLATE) if (x > -edge) xs.push(x);
  xs.push(edge);
  const zs = [back, -23.6, -18.8, YARD.z0, -9.6, -4.8, 0, YARD.z1, quay];
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const yard = zs[j]! >= YARD.z0 && zs[j + 1]! <= YARD.z1;
      const tone = rng.pick(yard ? [0.04, 0, -0.03, -0.06] : [0.05, 0.02, 0, -0.03, -0.05]);
      plate(xs[i]!, zs[j]!, xs[i + 1]!, zs[j + 1]!, shade(yard ? ASPHALT : inside(xs[i]!, zs[j]!) ? INTERIOR : CONCRETE, tone));
    }
  }

  for (let i = 0; i < 10; i++) {
    const x = down(rng.range(-edge + 2, edge - 5));
    const z = down(rng.pick([rng.range(back + 1, YARD.z0 - 3), rng.range(YARD.z1 + 0.4, quay - 2.4)]));
    const base = inside(x, z) ? INTERIOR : CONCRETE;
    plate(x, z, x + rng.int(3, 8) * STUD, z + rng.int(2, 5) * STUD, shade(base, rng.chance(0.5) ? -0.09 : 0.08), 0.002);
  }
  for (let i = 0; i < 12; i++) {
    const x = down(rng.range(-edge + 2, edge - 2));
    const z = down(rng.range(YARD.z0 + 1, YARD.z1 - 1.6));
    const w = rng.int(2, 4) * STUD;
    const h = rng.int(1, 2) * STUD;
    const c = shade(ASPHALT, -rng.range(0.16, 0.26));
    plate(x - w, z, x + w, z + h, c, 0.002);
    plate(x - w + STUD, z + h, x + w - STUD, z + h + STUD, c, 0.002);
    plate(x - w + STUD, z - STUD, x + w - 2 * STUD, z, c, 0.002);
  }

  tile(-edge, YARD.z1, edge, YARD.z1 + STUD, YELLOW);
  for (let x = -36; x < edge - 2; x += 4) tile(x, -7.2, x + 2, -6.8, WHITE);
  for (const s of [-1, 1]) {
    tile(s > 0 ? 15.2 : -35.6, -12.8, s > 0 ? 35.6 : -15.2, -12.4, WHITE);
    for (let i = 0; i < 4; i++) {
      const x = s * (28 + i * 2.4);
      tile(Math.min(x, x + s * STUD), -27.2, Math.max(x, x + s * STUD), -22.4, WHITE);
    }
  }
  tile(-5.2, -14.0, 5.2, -13.6, YELLOW);
  tile(-5.2, -12.4, 5.2, -12.0, YELLOW);
  for (let x = -4.8; x < 4.8; x += 1.6) tile(x, -13.6, x + 0.8, -12.4, YELLOW);

  const grates: [number, number][] = [[-28, -6.4], [-16, -6.4], [15.2, -6.4], [27.2, -6.4], [-31.2, 4], [-14, 4], [13.2, 4], [30.4, 4], [-22, 7.2], [21.2, 7.2], [-31.2, -20], [30.4, -20]];
  for (const [x, z] of grates) {
    tile(x, z, x + 2 * STUD, z + 2 * STUD, '#33363a', PAINT + 0.0005);
    for (let k = 0; k < 3; k++) tile(x + 0.1, z + 0.14 + k * 0.2, x + 0.7, z + 0.22 + k * 0.2, '#6a6f74', PAINT + 0.001);
  }
  p.add(VISUAL, (d) => {
    const t = new Pen(d, new Frame(0, 0, 0));
    for (const [x, z] of [[-17.6, -8.4], [18.4, -0.8], [-10.4, 7.6], [26.4, 6.8], [-26.4, -18.4]] as const) {
      t.cyl(x, 0, z, 0.38, 0.03, '#5b5d5f', undefined, 0.01, 12);
      if (d.detail > 0) t.cyl(x, 0.03, z, 0.26, 0.004, '#4a4c4f', undefined, 0, 12);
    }
  });
}

/** Yellow corner marks of a container slot, one stud clear of the box (turns 1 or 3 run it along z). */
export function containerSlot(p: Plan, x: number, z: number, turns = 0, length = 6, width = 2.4) {
  const [hx, hz] = turns % 2 ? [width / 2, length / 2] : [length / 2, width / 2];
  const x0 = down(x - hx - 0.2);
  const x1 = up(x + hx + 0.2);
  const z0 = down(z - hz - 0.2);
  const z1 = up(z + hz + 0.2);
  const paint = (a: number, b: number, c: number, e: number, color: string) =>
    p.add(DECAL, { x0: a, z0: b, x1: c, z1: e, y: PAINT, color, surface: 'stone', smooth: true });
  cornerMarks(paint, x0, z0, x1, z1, 3 * STUD, YELLOW);
}

/** One-stud L marks of length `leg` in the four corners of a rectangle on the stud grid. */
export function cornerMarks(
  paint: (x0: number, z0: number, x1: number, z1: number, color: string) => void,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  leg: number,
  color: string
) {
  const tile = (a: number, b: number, c: number, e: number) => paint(Math.min(a, c), Math.min(b, e), Math.max(a, c), Math.max(b, e), color);
  for (const [cx, sx] of [[x0, 1], [x1, -1]] as const) {
    for (const [cz, sz] of [[z0, 1], [z1, -1]] as const) {
      tile(cx, cz, cx + sx * leg, cz + sz * STUD);
      tile(cx, cz + sz * STUD, cx + sx * STUD, cz + sz * leg);
    }
  }
}
