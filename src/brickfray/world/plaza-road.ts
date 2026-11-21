import { DECAL, VISUAL } from './blocks';
import { FLOOR } from './docks-ground';
import type { Plan } from './plan';
import { Pen } from './props-kit';
import { Frame, Rng, shade } from './util';

const STUD = 0.4;
const WHITE = '#f2f2ee';
const PAINT = 0.004;

const snap = (v: number) => Math.round(v / STUD) * STUD;

/**
 * Ring road round the plaza in the brick language: smooth road plates laid in panels of slightly different
 * tone, stud-aligned repair patches, parking-bay ticks by the kerbs, drain grates and manhole covers.
 * `ring` is the road's outer rectangle, `inner` the raised paving it surrounds.
 */
export function plazaRoad(p: Plan, road: string, ring: [number, number, number, number], inner: [number, number, number, number]) {
  const [rx0, rz0, rx1, rz1] = ring;
  const [ix0, iz0, ix1, iz1] = inner;
  p.add(FLOOR, { x0: -38, z0: -36, x1: 38, z1: 36, y: 0, color: road, surface: 'stone', smooth: true });
  const rng = new Rng(41);
  const tile = (x0: number, z0: number, x1: number, z1: number, color: string, y = 0) =>
    p.add(DECAL, { x0, z0, x1, z1, y, color, surface: 'stone', smooth: true, matte: true });

  tile(-38, -36, 38, rz0, road);
  tile(-38, rz1, 38, 36, road);
  tile(-38, rz0, rx0, rz1, road);
  tile(rx1, rz0, 38, rz1, road);

  const tones = [0.07, 0.03, -0.02, -0.06];
  let last = -1;
  const panels = (x0: number, z0: number, x1: number, z1: number) => {
    const alongX = x1 - x0 > z1 - z0;
    const [a, b] = alongX ? [x0, x1] : [z0, z1];
    const n = Math.max(1, Math.round((b - a) / 4.8));
    for (let k = 0; k < n; k++) {
      const u0 = k === 0 ? a : snap(a + ((b - a) * k) / n);
      const u1 = k === n - 1 ? b : snap(a + ((b - a) * (k + 1)) / n);
      let pick = rng.int(0, tones.length - 1);
      if (pick === last) pick = (pick + 1) % tones.length;
      last = pick;
      const c = shade(road, tones[pick]!);
      if (alongX) tile(u0, z0, u1, z1, c);
      else tile(x0, u0, x1, u1, c);
    }
  };
  panels(rx0, rz0, rx1, iz0);
  panels(rx0, iz1, rx1, rz1);
  panels(rx0, iz0, ix0, iz1);
  panels(ix1, iz0, rx1, iz1);

  const inRoad = (x: number, z: number) => x > rx0 + 0.4 && x < rx1 - 0.4 && z > rz0 + 0.4 && z < rz1 - 0.4 && !(x > ix0 - 0.4 && x < ix1 + 0.4 && z > iz0 - 0.4 && z < iz1 + 0.4);
  for (let placed = 0, tries = 0; placed < 26 && tries < 300; tries++) {
    const x = snap(rng.range(rx0, rx1));
    const z = snap(rng.range(rz0, rz1));
    const w = rng.int(2, 4) * STUD;
    const h = rng.int(1, 3) * STUD;
    if (![[x - w, z], [x + w, z], [x - w, z + h + STUD], [x + w, z + h + STUD], [x, z - STUD]].every(([a, b]) => inRoad(a!, b!))) continue;
    placed++;
    const c = shade(road, rng.chance(0.6) ? -rng.range(0.1, 0.16) : rng.range(0.08, 0.12));
    tile(x - w, z, x + w, z + h, c, 0.002);
    tile(x - w + STUD, z + h, x + w - STUD, z + h + STUD, c, 0.002);
    tile(x - w + STUD, z - STUD, x + w - 2 * STUD, z, c, 0.002);
  }

  for (const s of [-1, 1]) {
    const kerb = s < 0 ? rz0 : rz1;
    for (const x of [-20.4, -13.2, -6.0, 6.0, 13.2, 20.4]) {
      const z0 = Math.min(kerb, kerb - s * 2.4);
      tile(x - 0.1, z0, x + 0.1, z0 + 2.4, WHITE, PAINT);
      const zt = s < 0 ? z0 + 2.4 - 0.2 : z0;
      tile(x - 0.4, zt, x + 0.4, zt + 0.2, WHITE, PAINT);
    }
  }

  const grates: [number, number][] = [[rx1 - 0.8, 19.2], [rx1 - 0.8, -8.8], [ix1, 6.0], [rx0, -10.4], [ix0 - 0.8, -14.0], [-24.0, rz0], [23.2, rz1 - 0.8], [8.8, iz1]];
  for (const [x, z] of grates) {
    tile(x, z, x + 2 * STUD, z + 2 * STUD, '#33363a', PAINT + 0.0005);
    for (let k = 0; k < 3; k++) tile(x + 0.1, z + 0.14 + k * 0.2, x + 0.7, z + 0.22 + k * 0.2, '#6a6f74', PAINT + 0.001);
  }

  const covers: [number, number][] = [[24.8, 21.0], [23.0, 2.4], [23.0, -12.0], [6.4, -21.8], [-8.0, -21.8], [-6.4, 21.8], [7.6, 21.8], [-25.6, -11.2], [-23.0, 11.6]];
  p.add(VISUAL, (d) => {
    const t = new Pen(d, new Frame(0, 0, 0));
    for (const [x, z] of covers) {
      t.cyl(x, 0, z, 0.4, 0.03, '#5b5d5f', 'rubber', 0.01, 16);
      if (d.detail > 0) {
        t.cyl(x, 0.03, z, 0.3, 0.004, '#4a4c4f', 'rubber', 0, 16);
        for (const o of [-0.12, 0, 0.12]) t.box(x + o, 0.034, z, 0.05, 0.004, 0.36, '#626568', 'rubber', 0);
      }
    }
  });
}
