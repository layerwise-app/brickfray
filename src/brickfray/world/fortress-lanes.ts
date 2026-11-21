import { DECAL, VISUAL } from './blocks';
import { C } from './castle-parts';
import { collectColliders, type Plan } from './plan';
import { Pen } from './props-kit';
import { Frame, mix, Rng, shade } from './util';

const STUD = 0.4;
const GREENS = ['#5f9a3a', '#4f8a32', '#73a947'] as const;
const PETALS = ['#f6c624', '#f2f2ee', '#c8231b', '#f3a6c3'] as const;
const DIRT = '#8f6e47';
const snap = (v: number) => Math.round(v / STUD) * STUD;

/**
 * Ground-level life for the open courtyard lanes, none of it in the way: worn off-tone and dirt plates on the sand,
 * two-stud trodden tracks along the routes round the yard, a flagstone kerb along the cobbled roads, straw near the
 * carts and hay, and grass tufts with a few flowers where the ground meets walls, stairs and the moat bank. Nothing
 * here has a collider or stands above 0.3 m.
 */
export function fortressLanes(p: Plan, sand: string, market: string) {
  const rng = new Rng(311);
  const solid = collectColliders(p);
  const free = (x: number, z: number, r: number) => !solid.some((c) => c.min[1] < 0.3 && c.max[1] > 0.02 && x + r > c.min[0] && x - r < c.max[0] && z + r > c.min[2] && z - r < c.max[2]);
  const plate = (x0: number, z0: number, x1: number, z1: number, color: string, y: number, smooth = false) =>
    p.add(DECAL, { x0, z0, x1, z1, y, color, surface: 'plastic', smooth });

  const lanes: [number, number, number, number, string][] = [
    [-28, -28.4, 28, -14.4, sand],
    [-28, 14.4, 28, 28.4, sand],
    [14.4, -12.4, 28.4, 12.4, sand],
    [-28.4, -12.4, -14.4, 12.4, market]
  ];
  for (const [x0, z0, x1, z1, base] of lanes) {
    const n = Math.round(((x1 - x0) * (z1 - z0)) / 26);
    for (let i = 0; i < n; i++) {
      const w = rng.int(3, 8) * STUD;
      const dd = rng.int(2, 5) * STUD;
      const x = snap(rng.range(x0, x1 - w));
      const z = snap(rng.range(z0, z1 - dd));
      plate(x, z, x + w, z + dd, rng.chance(0.4) ? mix(base, DIRT, rng.range(0.3, 0.5)) : shade(base, rng.pick([-0.1, 0.1, 0.14])), 0.002);
    }
  }

  const track = (along: 'x' | 'z', from: number, to: number, at: number, base: string) => {
    const tone = mix(base, DIRT, 0.62);
    for (let u = from; u < to - 0.01; u += STUD) {
      const lo = at - STUD - (rng.chance(0.25) ? STUD : 0);
      const hi = at + STUD + (rng.chance(0.25) ? STUD : 0);
      if (along === 'x') plate(u, lo, u + STUD, hi, tone, 0.003);
      else plate(lo, u, hi, u + STUD, tone, 0.003);
    }
  };
  for (const s of [-1, 1]) {
    track('x', s > 0 ? 2.4 : -26.4, s > 0 ? 26.4 : -2.4, s * 22.0, sand);
    track('x', s > 0 ? -26.4 : 2.4, s > 0 ? -2.4 : 26.4, s * 21.2, sand);
    track('z', -12.4, 12.4, s * 26.0, s > 0 ? sand : market);
  }

  const kerb = (along: 'x' | 'z', from: number, to: number, lo: number, hi: number) => {
    for (let u = from; u < to - 0.7; u += 0.8) {
      if (rng.chance(0.3)) continue;
      const tone = shade('#a8a294', rng.pick([-0.14, -0.08, 0.05]));
      if (along === 'z') plate(lo, u, hi, u + 0.8, tone, 0.006);
      else plate(u, lo, u + 0.8, hi, tone, 0.006);
    }
  };
  for (const s of [-1, 1]) {
    const [a, b] = s > 0 ? [13.6, 28.8] : [-28.8, -13.6];
    kerb('z', a, b, -2.4, -2.0);
    kerb('z', a, b, 2.0, 2.4);
    const [c, e] = s > 0 ? [13.6, 24.8] : [-24.8, -13.6];
    kerb('x', c, e, -1.6, -1.2);
    kerb('x', c, e, 1.2, 1.6);
  }

  for (const [cx, cz] of [[-17.6, -10.4], [-17.6, 10.4], [-24.0, 0], [8.0, 20.0], [-8.0, -20.0], [17.6, -13.6], [17.6, 13.6]] as const) {
    for (let i = 0; i < 7; i++) {
      const x = snap(cx + rng.range(-1.8, 1.8));
      const z = snap(cz + rng.range(-1.8, 1.8));
      const long = rng.chance(0.5);
      plate(x, z, x + (long ? 0.8 : 0.4), z + (long ? 0.4 : 0.8), rng.pick(['#e2c35a', '#d4b04a', '#ecd27a']), 0.008, true);
    }
  }

  const spots: [number, number][] = [];
  const edge = C.inner - 0.3;
  for (let k = 0; k < 44; k++) {
    const t = rng.range(-26, 26);
    const side = rng.int(0, 3);
    const [x, z] = side === 0 ? [t, -edge] : side === 1 ? [t, edge] : side === 2 ? [-edge, t] : [edge, t];
    spots.push([x, z]);
  }
  for (let k = 0; k < 16; k++) {
    const t = rng.range(-11, 11);
    const side = rng.int(0, 3);
    const e = 13.9;
    spots.push(side === 0 ? [t, -e] : side === 1 ? [t, e] : side === 2 ? [-e, t] : [e, t]);
  }
  for (const [x, z] of [[-25.6, -22.4], [25.6, 22.4], [-9.2, 25.2], [9.2, -25.2], [-27.6, -18.4], [27.6, 18.4], [5.6, 26.8], [-5.6, -26.8]] as const) {
    for (let i = 0; i < 3; i++) {
      const a = rng.range(0, Math.PI * 2);
      spots.push([x + Math.cos(a) * 1.1, z + Math.sin(a) * 1.1]);
    }
  }
  const tufts = spots.filter(([x, z]) => Math.abs(x) > 2.6 && Math.abs(z) > 2.6 && free(x, z, 0.2));
  const seeds = tufts.map(() => rng.next());
  p.add(VISUAL, (d) => {
    const t = new Pen(d, new Frame(0, 0, 0));
    const r = new Rng(97);
    tufts.forEach(([x, z], i) => {
      const blades = d.detail === 0 ? 3 : 5;
      for (let b = 0; b < blades; b++) {
        const a = (b / blades) * Math.PI * 2 + seeds[i]! * 6;
        const o = b === 0 ? 0 : r.range(0.06, 0.13);
        t.cone(x + Math.cos(a) * o, 0, z + Math.sin(a) * o, r.range(0.035, 0.05), 0, r.range(0.12, 0.26), GREENS[(b + i) % 3]!, undefined, 4, a);
      }
      if (seeds[i]! < 0.35) {
        for (let f = 0; f < 3; f++) {
          const a = r.range(0, Math.PI * 2);
          t.cyl(x + Math.cos(a) * 0.22, 0, z + Math.sin(a) * 0.22, 0.07, 0.04, PETALS[(i + f) % PETALS.length]!, undefined, 0.015, 6);
        }
      }
    });
  });
}
