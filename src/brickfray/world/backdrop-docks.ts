import { hills } from './backdrop';
import { WATER_Y } from './docks-parts';
import { LAND, QUAY, SHED_ROAD } from './docks-layout';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, mix, Rng, shade } from './util';

const HAZE = '#f4cf9e';
const BOX_COLORS = ['#c0392b', '#2f7fbf', '#e67e22', '#2e8b57', '#d9b93a', '#7f8c8d', '#16a085', '#8e5a9a'];
const TOWN = ['#e3d9c6', '#b5523b', '#d9a441', '#6f8496', '#3f8f8a', '#a0705a', '#c8b89a'];
/** The low tier's fog is opaque by 140 m: nothing is drawn past it there. */
const LOW_REACH = 140;
/** Nothing out of bounds stands closer than this to the playable edge, so the roads look out, not at a wall. */
const CLEAR = 22;
/** The town's waterfront either side of the bay: the far town stands on it instead of in the sea. */
const SHORE = { x: 66, z: 175, far: 185 } as const;
const STACK = { length: 12.2, width: 2.44, height: 2.6 } as const;

type Box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string) => void;

/**
 * Harbour surroundings, all out of reach and drawn cheap: plain boxes in one matte mesh (d.flat: one draw, no studs,
 * no shadows), tinted toward the haze with distance. Open sea and the far shore to the south; inland a container
 * terminal past each base, a rail yard past the shed roads and the town beyond. Only the ship hulls (read by
 * audio/scenery.test.ts) and the lighthouse go through the brick builder.
 */
export function docksBackdrop(d: Drawer) {
  d.anim.water(-420, QUAY.z1, 420, 420, WATER_Y, '#2c5866');
  const reach = d.detail === 0 ? LOW_REACH : 220;
  const box: Box = (x0, y0, z0, x1, y1, z1, color) => {
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    if (Math.hypot(x, z) > reach) return;
    d.flat.box([x0, y0, z0], [x1, y1, z1], mix(color, HAZE, Math.min(0.62, Math.max(0.08, (Math.hypot(x, z) - 40) / 210))));
  };
  for (const side of [-1, 1]) {
    shore(box, side);
    terminal(box, side, d.detail);
    railYard(box, side);
  }
  town(box, d.detail);
  landmarks(box);
  hills(d, { count: d.detail === 0 ? 5 : 10, radius: [40, 70], dist: [190, 240], colors: ['#7d8f6a', '#8a9a74', '#6f8262'], haze: HAZE, seed: 5, arc: [Math.PI * 0.2, Math.PI * 0.8], height: 0.32 });
  const t = new Pen(d, new Frame(0, 0, 0));
  for (const s of seaShips()) ship(t, box, s);
  const light = QUAY.z1 + 60;
  lighthouse(t, 58, light);
  d.anim.foam.ring(58, light, WATER_Y, 3.2, 1.4, 16);
  box(30, WATER_Y, light - 4, 66, 0.6, light + 4, '#8d8f88');
}

/** Quay block with a pale coping and a dark wet band along its foot. */
function shore(box: Box, side: number) {
  const { x: x0, z: z1, far } = SHORE;
  const z0 = QUAY.z1 - 2;
  const [a, b] = side < 0 ? [-far, -x0] : [x0, far];
  box(a, WATER_Y - 0.6, z0, b, 0, z1, '#a39a8a');
  const edge = side * x0;
  box(Math.min(edge, edge - side * 1.2), -0.02, z0, Math.max(edge, edge - side * 1.2), 0.14, z1, '#d9d2c1');
  box(a, -0.02, z1 - 1.2, b, 0.14, z1, '#d9d2c1');
  box(Math.min(edge, edge + side * 0.1), WATER_Y, z0, Math.max(edge, edge + side * 0.1), WATER_Y + 0.4, z1, '#3d4441');
}

/** Container stacks past each base road's fence, in blocks with truck lanes between, and two ship-to-shore cranes. */
function terminal(box: Box, side: number, detail: number) {
  const rng = new Rng(side < 0 ? 29 : 31);
  const x0 = LAND.x + CLEAR + STACK.length / 2;
  for (let col = 0; col < 4; col++) {
    const x = side * (x0 + col * (STACK.length + 2.4));
    for (let z = SHED_ROAD.z0 + 2; z < QUAY.z0 - 2; z += STACK.width + 0.4) {
      if (rng.chance(detail === 0 ? 0.45 : 0.15)) continue;
      const levels = rng.int(1, 4);
      for (let k = 0; k < levels; k++) {
        const c = rng.pick(BOX_COLORS);
        box(x - STACK.length / 2, k * STACK.height, z, x + STACK.length / 2, (k + 1) * STACK.height - 0.05, z + STACK.width, k === levels - 1 ? c : shade(c, -0.08));
      }
    }
  }
  for (let i = 0; i < 2; i++) gantry(box, side * (x0 + 18 + i * 22), QUAY.z0 + 2, side < 0 ? '#d6452f' : '#2f7fbf');
}

/** Ship-to-shore crane: four legs, a portal beam and the boom out over the water. */
function gantry(box: Box, x: number, z: number, color: string) {
  for (const sx of [-4, 4]) for (const sz of [-3, 3]) box(x + sx - 0.4, 0, z + sz - 0.4, x + sx + 0.4, 22, z + sz + 0.4, color);
  box(x - 4.8, 22, z - 3.6, x + 4.8, 23.6, z + 3.6, color);
  box(x - 0.7, 22.4, z - 7, x + 0.7, 23.6, z + 43, color);
  box(x - 2, 23.6, z - 3.5, x + 2, 26, z - 0.5, '#e9e6dc');
}

/** Boxcars on the tracks past the shed road's fence, and the goods shed at the back of the yard. */
function railYard(box: Box, side: number) {
  const rng = new Rng(side < 0 ? 41 : 43);
  for (const [row, z] of [[0, SHED_ROAD.z0 - CLEAR], [1, SHED_ROAD.z0 - CLEAR - 6]] as const) {
    for (let x = 26 + row * 7; x < 150; x += 15.2) {
      if (rng.chance(0.3)) continue;
      const c = rng.pick(['#7a3b2e', '#5b4a3a', '#6f2f2a', '#4f5a4a']);
      const [a, b] = side < 0 ? [-x - 14, -x] : [x, x + 14];
      box(a + 1, 0, z - 1.2, b - 1, 0.9, z + 1.2, '#2a2d31');
      box(a, 0.9, z - 1.5, b, 4.0, z + 1.5, c);
    }
  }
  const [a, b] = side < 0 ? [-140, -30] : [30, 140];
  box(a, 0, SHED_ROAD.z0 - CLEAR - 26, b, 7, SHED_ROAD.z0 - CLEAR - 14, '#a0705a');
  box(a, 7, SHED_ROAD.z0 - CLEAR - 25, b, 9, SHED_ROAD.z0 - CLEAR - 15, '#6f6a62');
}

/** Town blocks: inland behind the rail yard, past the terminals, and along both shores of the bay. */
function town(box: Box, detail: number) {
  const rng = new Rng(11);
  const n = detail === 0 ? 60 : 110;
  const back = SHED_ROAD.z0 - CLEAR - 34;
  for (let i = 0; i < n; i++) {
    const zone = rng.int(0, 2);
    const x = zone === 0 ? rng.range(-170, 170) : rng.pick([-1, 1]) * rng.range(zone === 1 ? 150 : SHORE.x + 8, 172);
    const z = zone === 0 ? rng.range(-170, back) : zone === 1 ? rng.range(back, QUAY.z1) : rng.range(QUAY.z1 + 10, SHORE.z - 8);
    const w = rng.range(7, 14), dd = rng.range(7, 14);
    const h = rng.range(10, 30) * (0.7 + (Math.hypot(x, z) / 170) * 0.5);
    const c = rng.pick(TOWN);
    box(x - w / 2, 0, z - dd / 2, x + w / 2, h, z + dd / 2, c);
    // Window bands, one box per floor pair, so a block reads as a building and not as a plain slab.
    for (let y = 3.4; y < h - 2; y += 6.4) box(x - w / 2 - 0.05, y, z - dd / 2 - 0.05, x + w / 2 + 0.05, y + 1.3, z + dd / 2 + 0.05, shade(c, -0.3));
    box(x - w / 2 - 0.2, h, z - dd / 2 - 0.2, x + w / 2 + 0.2, h + 0.6, z + dd / 2 + 0.2, shade(c, -0.25));
    if (rng.chance(0.4)) box(x - w / 4, h + 0.6, z - dd / 4, x + w / 4, h + 2.4, z + dd / 4, '#6f6a62');
  }
}

/** Three big far silhouettes that place the town: grain silos inland east, a radio tower west, a girder bridge over the bay. */
function landmarks(box: Box) {
  for (let i = 0; i < 5; i++) {
    const x = 96 + i * 6.2;
    box(x, 0, -172, x + 5.6, 34, -166, '#d8cdb8');
    box(x + 0.4, 34, -171.6, x + 5.2, 35.2, -166.4, '#b9ad97');
  }
  box(127.2, 0, -173, 136, 46, -165, '#cdbfa6');
  box(96, 35.2, -170, 127.2, 37.4, -168, '#9e9282');
  box(-121.5, 0, -151.5, -118.5, 62, -148.5, '#c8c2b6');
  box(-124.5, 48, -154.5, -115.5, 54, -145.5, '#b5523b');
  box(-123.5, 54, -153.5, -116.5, 56, -146.5, '#e3d9c6');
  box(-120.4, 56, -150.4, -119.6, 78, -149.6, '#8e8a82');
  for (const x of [-166, -114]) box(x - 2, 0, 117, x + 2, 42, 123, '#6f8496');
  box(-184, 18, 118, -96, 20.4, 122, '#5d6b78');
  for (let x = -184; x < -96; x += 6) box(x, 20.4, 118.2, x + 0.6, 26, 118.8, '#6f8496');
  box(-184, 26, 118, -96, 27, 119, '#6f8496');
}

interface SeaShip { x: number; z: number; len: number; hull: string; cargo: string[] }

/** The ships at sea; DOCKS_SHIPS (where the horns sound) is read off the same list. */
function seaShips(): SeaShip[] {
  const rng = new Rng(29);
  const out: SeaShip[] = [];
  for (let i = 0; i < 4; i++) {
    const x = rng.range(-150, 150);
    const z0 = rng.range(130, 220);
    const z = Math.abs(x) > SHORE.x - 12 && z0 < SHORE.z + 12 ? z0 + 70 : z0;
    const len = rng.range(18, 34);
    out.push({ x, z, len, hull: rng.pick(['#1f3f5f', '#7a2a24', '#2f4f3f', '#3a3f45']), cargo: [0, 1, 2, 3].map(() => rng.pick(BOX_COLORS)) });
  }
  return out;
}

function ship(t: Pen, box: Box, s: SeaShip) {
  const { x, z, len } = s;
  const w = len * 0.16;
  t.box(x, WATER_Y - 0.2, z, len, len * 0.11, w, mix(s.hull, HAZE, Math.min(0.7, (z - 60) / 200)), 'metal', 0);
  const deck = WATER_Y - 0.2 + len * 0.11;
  box(x - len * 0.42, deck, z - w * 0.4, x - len * 0.28, deck + len * 0.12, z + w * 0.4, '#e9e6dc');
  for (let i = 0; i < 4; i++) {
    const cx = x - len * 0.18 + i * len * 0.13;
    box(cx - len * 0.06, deck, z - w * 0.45, cx + len * 0.06, deck + len * 0.05, z + w * 0.45, s.cargo[i]!);
  }
}

function lighthouse(t: Pen, x: number, z: number) {
  t.cyl(x, WATER_Y, z, 3.2, 2.4, mix('#8d8f88', HAZE, 0.3), undefined, 0, 10);
  for (let i = 0; i < 5; i++) t.cyl(x, WATER_Y + 2.4 + i * 3, z, 1.8 - i * 0.12, 3, mix(i % 2 ? '#c0392b' : '#f2f2ee', HAZE, 0.3), undefined, 0, 10);
  t.cyl(x, WATER_Y + 17.4, z, 1.1, 1.6, '#fff1b0', 'glow', 0, 10);
  t.cone(x, WATER_Y + 19, z, 1.4, 0, 1.4, mix('#2f363d', HAZE, 0.3), undefined, 10);
}

/** The top of each ship's bridge at sea, where audio/scenery.ts sounds the ship horns. */
export const DOCKS_SHIPS: [number, number, number][] = seaShips().map((s) => [s.x - s.len * 0.35, WATER_Y + s.len * 0.21, s.z]);
