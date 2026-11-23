import { hills, skyline } from './backdrop';
import type { Drawer } from './plan';
import { SIDE_STREETS } from './plaza-edges';
import { EDGE } from './plaza-layout';
import { Pen } from './props-kit';
import { faceFrame, Frame, mix, Rng, shade } from './util';

const X = EDGE.x;
const Z = EDGE.z;
const HAZE = '#cfe2f1';
const HOUSES = ['#f2c94c', '#f2f2ee', '#3b82c4', '#f58a1f', '#e3d6bc', '#c8231b', '#5aa83f', '#f3a6c3', '#b07ac2', '#1fa7a0', '#efe5cf', '#d98c5f'];
const STORES = ['#a8452e', '#8a3b2a', '#b44a31', '#7a5a46', '#c9b48a'];
const ROOFS = ['#a8321f', '#7a1712', '#3f5a6e', '#2f6a5a'];
const ASPHALT = '#5d5f63';
const PAVE = '#cfc6b4';
const STONE = '#b9ae98';
const BRICK = '#a8452e';
const GLASS = '#3f5f78';
const SHOP = '#2b3a45';
const IRON = '#23282d';
const WIDTHS = [6.4, 7.2, 8.0, 9.6];
const CUT = { z0: -Z - 0.8, z1: -Z - 12.8, y: -5.6, portal: X - 2 } as const;
const ROAD = { z0: Z + 2.4, z1: Z + 9.6, houses: Z + 12.0 } as const;

/**
 * What lies past each edge: the railway cutting with a train in it (north), the canal with narrowboats and the far
 * quay's warehouses (east), the road past the park railings (south), the side streets behind the west houses; then
 * the city ring and hills. Scenery only: nothing out here can be stood on.
 */
export function plazaBackdrop(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(41);
  d.anim.water(X + 0.4, -Z - 60, X + 8.4, Z + 60, -0.9, '#2f8fb3');
  cutting(t, rng);
  canal(t, rng);
  road(t, rng);
  west(t, rng);
  skyline(d, { inner: [86, 82], outer: 170, haze: HAZE, colors: ['#e7e1d2', '#d9d2c1', '#c9b48a', '#a6abaf', '#d98c5f', '#8fb3c9', '#e8c547'], seed: 5, minH: 14, maxH: 34 });
  hills(d, { count: 9, radius: [40, 70], dist: [150, 190], colors: ['#7fae8a', '#8fb8a0', '#9cbfb2'], haze: HAZE, seed: 9, height: 0.35 });
}

const fadeAt = (x: number, z: number) => Math.min(0.45, Math.max(0, (Math.hypot(x, z) - 50) / 120));

/** A town house or store facing (nx, nz): window bays on that face, shopfronts below, a gable or flat roof. */
function house(t: Pen, rng: Rng, x0: number, z0: number, x1: number, z1: number, h: number, nx: number, nz: number, colors = HOUSES, ridgeAcross = false, dress = true) {
  const k = fadeAt((x0 + x1) / 2, (z0 + z1) / 2);
  const c = (s: string) => mix(s, HAZE, k);
  const wall = rng.pick(colors);
  t.span(x0, 0, z0, x1, h, z1, c(wall), undefined, 0);
  t.span(x0 - 0.12, h - 0.36, z0 - 0.12, x1 + 0.12, h, z1 + 0.12, c(shade(wall, -0.22)), undefined, 0);
  const { f: frame, length: along } = faceFrame(nz ? (nz > 0 ? 's' : 'n') : nx > 0 ? 'e' : 'w', x0, z0, x1, z1);
  const p = t.at(frame);
  const bays = Math.max(1, Math.round(along / 2.4));
  const floors = Math.max(1, Math.floor((h - 0.6) / 3.36));
  // Front-row houses facing the town get window frames, sills, a fascia over the shops and doors; the rest stay plain.
  const near = dress && (nz ? Math.abs((x0 + x1) / 2) - X : Math.abs((z0 + z1) / 2) - Z) < 20;
  const trim = c(mix(wall, '#f2f2ee', 0.7));
  const dark = c(shade(wall, -0.3));
  for (let f = 0; f < floors; f++) {
    if (near && f > 0) p.box(along / 2, f * 3.36 - 0.12, 0.04, along, 0.16, 0.08, c(shade(wall, -0.12)), undefined, 0);
    for (let b = 0; b < bays; b++) {
      const u = (along / bays) * (b + 0.5);
      if (f === 0) {
        const w = Math.min(1.8, along / bays - 0.4);
        const door = near && b % 3 === 1;
        p.box(u, door ? 0 : 0.3, 0.05, door ? 1.0 : w, 2.3, 0.1, c(door ? shade(wall, -0.45) : SHOP), undefined, 0);
        if (near) p.frame(u, door ? 0 : 0.22, 0.08, (door ? 1.0 : w) + 0.24, door ? 2.42 : 2.5, 0.12, 0.16, trim);
        continue;
      }
      const y = f * 3.36 + 0.9;
      p.box(u, y, 0.05, 0.9, 1.6, 0.1, c(GLASS), undefined, 0);
      if (!near) continue;
      p.frame(u, y - 0.1, 0.08, 1.14, 1.82, 0.12, 0.16, trim);
      p.box(u, y - 0.2, 0.14, 1.34, 0.1, 0.28, trim, undefined, 0);
    }
  }
  if (near) p.box(along / 2, 2.8, 0.1, along - 0.3, 0.5, 0.2, dark, undefined, 0);
  if (h > 15 || rng.chance(0.3)) return;
  const roof = c(rng.pick(ROOFS));
  const ridgeX = nz ? !ridgeAcross : ridgeAcross;
  const span = ridgeX ? z1 - z0 : x1 - x0;
  const len = ridgeX ? x1 - x0 : z1 - z0;
  const rise = Math.min(4, span * 0.42);
  const prof: [number, number][] = [[-span / 2 - 0.2, 0], [span / 2 + 0.2, 0], [0, rise]];
  t.prism(`bd-gable:${span.toFixed(2)}`, prof, len + 0.2, (x0 + x1) / 2, h, (z0 + z1) / 2, roof, undefined, ridgeX ? 0 : Math.PI / 2);
}

/** A row of houses from a to b along x (nz != 0) or z, of depth dd, facing the map. */
function row(t: Pen, rng: Rng, a: number, b: number, front: number, dd: number, nx: number, nz: number, h: [number, number], skip: [number, number][] = [], dress = true) {
  for (let u = a; u < b - 3; ) {
    const w = Math.min(rng.pick(WIDTHS), b - u);
    const gap = skip.find(([s0, s1]) => u < s1 && u + w > s0);
    if (gap) {
      u = gap[1];
      continue;
    }
    const hh = rng.range(h[0], h[1]);
    const back = front - (nz || nx) * dd;
    if (nz) house(t, rng, u, Math.min(front, back), u + w, Math.max(front, back), hh, 0, nz, HOUSES, false, dress);
    else house(t, rng, Math.min(front, back), u, Math.max(front, back), u + w, hh, nx, 0, HOUSES, false, dress);
    u += w;
  }
}

/** North: a brick-walled railway cutting under the station windows, two tracks, a parked train, a tunnel mouth by the canal. */
function cutting(t: Pen, rng: Rng) {
  const { z0, z1, y, portal } = CUT;
  const xa = -110;
  t.span(xa, y, z0 - 0.4, portal, -0.16, -Z, BRICK, undefined, 0);
  t.span(xa, -0.16, z0 - 0.5, portal, 0, -Z, STONE, undefined, 0);
  t.span(xa, y - 0.3, z1, portal, y, z0 - 0.4, '#8a857c', undefined, 0);
  t.span(xa, y, z1 - 0.8, X + 9.2, 0.4, z1, BRICK, undefined, 0);
  t.span(xa, 0.4, z1 - 0.9, X + 9.2, 0.6, z1 + 0.1, STONE, undefined, 0);
  t.span(xa, 1.56, z1 - 0.45, X + 9.2, 1.64, z1 - 0.35, IRON, 'metal', 0);
  for (let x = -72; x < portal; x += 4.8) t.box(x, y, z1 + 0.2, 0.8, 5.84, 0.4, '#8a3b2a', undefined, 0);
  if (t.detail > 0) for (let x = xa; x < X + 9; x += 2.4) t.box(x, 0.6, z1 - 0.4, 0.08, 1.0, 0.08, IRON, 'metal', 0);
  for (const zc of [-44.4, -49.2]) {
    if (t.detail > 0) for (let x = -72; x < portal; x += 1.2) t.box(x, y, zc, 0.4, 0.12, 2.2, '#6e4a2f', undefined, 0);
    for (const s of [-0.72, 0.72]) t.span(xa, y + 0.12, zc + s - 0.05, portal, y + 0.28, zc + s + 0.05, '#8d9196', 'metal', 0);
  }
  // Tunnel mouth under the canal: a brick portal with a dark arch.
  t.span(portal, y, z1, X + 0.4, 0, z0 - 0.4, BRICK, undefined, 0);
  t.span(portal - 0.05, y, -50.4, portal, y + 4.6, -43.2, '#1d2226', undefined, 0);
  t.span(portal - 0.3, -0.4, z1, portal, 0.2, z0 - 0.4, STONE, undefined, 0);
  // A parked train on the far track: three carriages, cream window band, the cab end by the tunnel.
  for (let i = 0; i < 3; i++) {
    const xs = -30 + i * 16.8;
    const zc = -49.2;
    t.span(xs, y + 0.3, zc - 1.4, xs + 16, y + 0.6, zc + 1.4, '#2f363d', undefined, 0);
    t.span(xs, y + 0.6, zc - 1.4, xs + 16, y + 3.6, zc + 1.4, '#c8231b', undefined, 0);
    t.span(xs + 0.1, y + 2.0, zc + 1.4, xs + 15.9, y + 2.9, zc + 1.45, '#f2f2ee', undefined, 0);
    for (let x = xs + 1.2; x < xs + 15; x += 2.0) t.box(x, y + 2.1, zc + 1.47, 1.2, 0.7, 0.06, GLASS, undefined, 0);
    t.span(xs + 0.3, y + 3.6, zc - 1.2, xs + 15.7, y + 4.0, zc + 1.2, '#a6abaf', 'metal', 0);
  }
  // The street past the cutting and its houses.
  const s0 = z1 - 0.8;
  t.span(xa, -0.04, s0 - 2.4, 110, 0, s0, PAVE, undefined, 0);
  t.span(xa, -0.06, s0 - 9.6, 110, -0.02, s0 - 2.4, ASPHALT, undefined, 0);
  t.span(xa, -0.04, s0 - 12, 110, 0, s0 - 9.6, PAVE, undefined, 0);
  street(t, s0);
  row(t, rng, -96, 96, s0 - 12, 9.6, 0, 1, [9.6, 17.6], [[X, X + 9.2]]);
}

/** The cutting's far wall and the street over it: brick courses, kerbs, a centre line, paving joints and lamp posts. */
function street(t: Pen, s0: number) {
  const { z1, y } = CUT;
  for (let yy = y + 0.9; yy < 0; yy += 0.9) t.span(-72, yy, z1 + 0.01, CUT.portal, yy + 0.06, z1 + 0.05, '#8a3b2a', undefined, 0);
  for (const z of [s0 - 2.4, s0 - 9.6]) t.span(-110, 0, z - 0.1, 110, 0.12, z + 0.1, '#e3d6bc', undefined, 0);
  if (t.detail === 0) return;
  for (let x = -72; x < 72; x += 4.8) t.box(x, -0.02, s0 - 6, 2.4, 0.03, 0.16, '#f2f2ee', undefined, 0);
  for (const [a, b] of [[s0 - 2.4, s0], [s0 - 12, s0 - 9.6]] as const) for (let x = -72; x < 72; x += 1.2) t.box(x, -0.01, (a + b) / 2, 0.05, 0.02, b - a, '#b7ad9a', undefined, 0);
  for (let x = -66; x < 72; x += 14.4) {
    t.cyl(x, 0, s0 - 1.2, 0.09, 4.2, IRON, 'metal');
    t.box(x, 4.2, s0 - 1.5, 0.36, 0.3, 0.8, IRON, 'metal', 0);
    t.box(x, 4.14, s0 - 1.7, 0.26, 0.06, 0.4, '#fff3c4', 'glow', 0);
  }
}

/** East: the canal past the quay railings, two narrowboats, the far towpath and its brick warehouses. */
function canal(t: Pen, rng: Rng) {
  const far = X + 8.4;
  for (const [a, b] of [[-Z - 60, -2.4], [2.4, Z + 60]] as const) t.span(X, -2.0, a, X + 0.4, 0, b, STONE, undefined, 0);
  t.span(far, -2.0, -Z - 60, far + 0.8, 0.24, Z + 60, STONE, undefined, 0);
  t.span(far + 0.8, -0.04, CUT.z1 - 0.8, far + 7.6, 0, ROAD.z0, PAVE, undefined, 0);
  for (let z = -48; z < Z; z += 6.4) t.cyl(far + 1.4, 0, z, 0.22, 0.6, IRON, 'metal');
  for (const [x, z0, hull] of [[X + 1.2, -26, '#2f5a3a'], [X + 5.6, 10, '#1f3f5f']] as const) {
    t.span(x, -1.3, z0, x + 2, -0.4, z0 + 13, hull, undefined, 0);
    t.span(x + 0.2, -0.4, z0 + 2.4, x + 1.8, 0.5, z0 + 11, '#efe5cf', undefined, 0);
    t.span(x + 0.1, 0.5, z0 + 2.3, x + 1.9, 0.62, z0 + 11.1, '#a8321f', undefined, 0);
    for (let z = z0 + 3.2; z < z0 + 10.6; z += 1.6) t.box(x + 0.17, 0, z, 0.06, 0.3, 0.8, GLASS, undefined, 0);
  }
  for (let z = -48; z + 16 < ROAD.z0; z += 16.8) house(t, rng, far + 7.6, z, far + 21.2, z + 16, rng.range(11.2, 15.2), -1, 0, STORES, true);
}

/** South: pavement, the road with parked cars and street trees, a row of houses across it. */
function road(t: Pen, rng: Rng) {
  const { z0, z1, houses } = ROAD;
  t.span(-110, -0.04, Z, 110, 0, z0, PAVE, undefined, 0);
  t.span(-110, -0.06, z0, 110, -0.02, z1, ASPHALT, undefined, 0);
  t.span(-110, -0.04, z1, 110, 0, houses, PAVE, undefined, 0);
  for (const z of [z0, z1]) t.span(-110, 0, z - 0.1, 110, 0.12, z + 0.1, '#e3d6bc', undefined, 0);
  if (t.detail > 0) for (let x = -96; x < 96; x += 4.8) t.box(x, -0.02, (z0 + z1) / 2, 2.4, 0.03, 0.16, '#f2f2ee', undefined, 0);
  for (let x = -40; x < X; x += 9.6) {
    t.cyl(x, 0, Z + 1.4, 0.18, 2.4, '#6e4a2f');
    for (const [r, yy] of [[1.6, 2.2], [2.0, 3.0], [1.5, 3.9]] as const) t.cyl(x, yy, Z + 1.4, r, 0.9, mix('#3f7f3a', HAZE, 0.05), undefined, 0, 8);
  }
  for (const x of [-30, -12, 7, 26]) car(t, rng, x, z1 - 1.2);
  t.span(X, 0, z0 - 0.2, X + 8.8, 1.0, z0, STONE, undefined, 0);
  t.span(X, 0, z1, X + 8.8, 1.0, z1 + 0.2, STONE, undefined, 0);
  row(t, rng, -96, 96, houses, 9.6, 0, -1, [9.6, 16.8], [[X, X + 9.2]]);
}

function car(t: Pen, rng: Rng, x: number, z: number) {
  const body = rng.pick(['#c8231b', '#3b82c4', '#f2c94c', '#f2f2ee', '#2f8a3e']);
  t.span(x - 2, 0.3, z - 0.85, x + 2, 1.0, z + 0.85, body, undefined, 0.08);
  t.span(x - 1.1, 1.0, z - 0.75, x + 0.9, 1.6, z + 0.75, GLASS, undefined, 0.06);
  for (const sx of [-1.3, 1.3]) for (const sz of [-0.8, 0.8]) t.box(x + sx, 0, z + sz, 0.6, 0.6, 0.2, IRON, undefined, 0);
}

/** West: houses behind the west row, taller so their roofs show over it; the gated side streets run through them. */
function west(t: Pen, rng: Rng) {
  const gaps = SIDE_STREETS;
  t.span(-X - 4.8, -0.04, -12, -X, 0, 12, PAVE, undefined, 0);
  row(t, rng, -Z - 0.8, Z + 0.8, -X - 4.8, 9.6, 1, 0, [13.6, 18.4], gaps);
  row(t, rng, -Z - 0.8, Z + 0.8, -X - 14.4, 9.6, 1, 0, [15.2, 20.8], gaps, false);
  for (const [a, b] of gaps) {
    t.span(-X - 24, -0.04, a, -X - 0.4, 0, b, PAVE, undefined, 0);
    house(t, rng, -X - 33.6, a - 4, -X - 24, b + 4, 14.4, 1, 0);
  }
}
