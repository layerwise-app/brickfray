import { church, type Facing, house, hz, rick, sheep, tent, tree, windmill } from './fortress-village';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, type Rng } from './util';

/** Places in the country round the fortress, one group per side; see OUT in fortress-outside.ts for the ground. */
export function country(d: Drawer, rng: Rng) {
  const t = new Pen(d, new Frame(0, 0, 0));
  westStreet(d, t, rng);
  southRoad(d, t, rng);
  eastBank(d, t, rng);
  northValley(d, t, rng);
}

/** Cottages in a row: [centre along the row, frontage] each, fronts on the line `front` facing `facing`. */
function row(d: Drawer, rng: Rng, facing: Facing, front: number, y: number, along: [number, number][], depth = 8) {
  for (const [a, w] of along) {
    const back = facing === 'e' || facing === 's' ? -1 : 1;
    const c = front + (back * depth) / 2;
    if (facing === 'e' || facing === 'w') house(d, c, y, a, facing, w, depth, rng);
    else house(d, a, y, c, facing, w, depth, rng);
  }
}

/**
 * West: the village street runs along the stables, the orchard fence and the yard gate; house fronts face it, the
 * church stands back on a green opposite the stables, gardens and fields behind.
 */
function westStreet(d: Drawer, t: Pen, rng: Rng) {
  row(d, rng, 'e', -57.6, 0, [[-44.0, 7.2], [-35.6, 8.0], [-27.2, 7.2], [-19.2, 6.4], [-11.6, 6.4], [15.6, 7.2], [24.0, 8.0], [32.4, 7.2], [40.8, 7.2], [48.8, 6.4]]);
  church(d, -72.0, 0, 1.2, 'e');
  tree(t, -61.6, 0, -5.6, 1.15, 'oak', rng);
  tree(t, -61.2, 0, 8.0, 1.0, 'oak', rng);
  t.cyl(-59.6, 0, 1.2, 0.9, 0.8, hz('#a39a86', -60, 1));
  for (const z of [0.4, 2.0]) t.box(-59.6, 0.8, z, 0.14, 1.5, 0.14, '#5e3f27', undefined, 0);
  t.box(-59.6, 2.3, 1.2, 0.9, 0.12, 2.1, '#7d5a46', undefined, 0);
  // A cart left in the street, a stack of barrels by a door.
  t.box(-53.6, 0.5, -20.0, 1.6, 0.5, 3.2, hz('#8a5f3a', -54, -20), undefined, 0);
  for (const x of [-54.56, -52.76]) t.cylX(x, 0.55, -20.4, 0.55, 0.12, '#5e3f27');
  for (const [x, z] of [[-56.8, 12.4], [-56.8, 13.4], [-56.6, 30.2]] as const) t.cyl(x, 0, z, 0.36, 0.9, '#7a5434', undefined, 0, 8);
  // Behind the row: gardens, fruit trees, farther a wood.
  for (let i = 0; i < (d.detail === 0 ? 8 : 16); i++) tree(t, rng.range(-90, -70), 0, rng.range(-48, 52), rng.range(0.9, 1.3), rng.chance(0.3) ? 'pine' : 'oak', rng);
  for (let i = 0; i < (d.detail === 0 ? 8 : 18); i++) tree(t, rng.range(-150, -100), 0, rng.range(-48, 52), rng.range(1.2, 1.8), rng.chance(0.5) ? 'pine' : 'oak', rng);
  // The meadow outside the kitchen garden: beehives and a few old fruit trees.
  for (const [x, z] of [[-44.0, -44.0], [-40.0, -36.8], [-45.6, -32.0]] as const) tree(t, x, 0, z, 0.9, 'oak', rng);
  for (let i = 0; i < 4; i++) {
    t.box(-38.4 + i * 1.2, 0, -45.6, 0.7, 0.8, 0.7, '#e8d9b0', undefined, 0);
    t.box(-38.4 + i * 1.2, 0.8, -45.6, 0.86, 0.14, 0.86, '#8a5f3a', undefined, 0);
  }
}

/** South: the bridge's road to a village of two rows, ricks in the stubble west of the barbican, pavilions by the lists. */
function southRoad(d: Drawer, t: Pen, rng: Rng) {
  row(d, rng, 'e', -9.6, 0, [[86.0, 7.2], [94.8, 7.2], [104.4, 8.8], [114.0, 7.2]]);
  row(d, rng, 'w', 1.6, 0, [[88.4, 8.0], [97.6, 7.2], [107.2, 7.2], [116.8, 8.0]]);
  church(d, 6.4, 0, 130.0, 'n');
  t.box(-8.4, 0, 60.0, 0.24, 3.0, 0.24, hz('#6e4a2f', -8, 60), undefined, 0);
  t.box(-8.4, 2.0, 60.0, 1.4, 0.2, 0.2, hz('#6e4a2f', -8, 60), undefined, 0);
  for (const [x, z] of [[-14.4, 66.0], [9.6, 72.0], [-20.0, 78.4], [14.4, 62.4], [24.0, 70.0], [-30.0, 64.0]] as const) tree(t, x, 0, z, 1.1, 'oak', rng);
  for (let i = 0; i < (d.detail === 0 ? 6 : 14); i++) tree(t, rng.range(-120, 40), 0, rng.range(140, 190), rng.range(1.3, 1.8), 'pine', rng);
  for (const [x, z] of [[-44.0, 33.6], [-38.4, 39.2], [-33.6, 32.8], [-43.2, 43.2]] as const) rick(t, x, 0, z);
  t.box(-36.0, 0.5, 43.2, 3.2, 0.6, 1.6, hz('#8a5f3a', -36, 43), undefined, 0);
  t.box(-36.0, 1.1, 43.2, 2.8, 0.7, 1.4, hz('#d9c27a', -36, 43), undefined, 0);
  tent(t, 17.6, 0, 44.0, '#b5523b');
  tent(t, 28.0, 0, 43.6, '#2f6f9f');
  t.box(22.8, 0, 43.2, 3.2, 1.2, 1.6, '#8a5f3a', undefined, 0);
  t.box(22.8, 1.2, 43.2, 3.4, 0.12, 1.8, '#b5523b', undefined, 0);
  for (const x of [-34.0, -20.0, 18.0, 32.0]) reeds(t, x, OUT_MOAT_SOUTH, rng);
}

const OUT_MOAT_SOUTH = 53.4;

/** East: willows and a towpath on the far bank, a jetty with a boat, fields, the windmill and a village with a church. */
function eastBank(d: Drawer, t: Pen, rng: Rng) {
  const bank = 58.0;
  for (let z = -46; z < 140; z += rng.range(10, 15)) tree(t, bank + 2.2 + rng.range(-0.4, 0.6), 0, z, rng.range(0.9, 1.2), 'willow', rng);
  t.box(bank - 1.8, 0.02, 27.2, 3.6, 0.16, 1.6, '#8a5f3a', undefined, 0);
  for (const [x, z] of [[bank - 3.4, 26.6], [bank - 3.4, 27.8], [bank - 1.6, 26.6], [bank - 1.6, 27.8]] as const) t.box(x, -0.7, z, 0.18, 0.9, 0.18, '#5e3f27', undefined, 0);
  t.box(bank - 2.6, -0.24, 30.4, 1.3, 0.4, 3.2, '#7a4a2a', undefined, 0);
  t.box(bank - 2.6, 0.12, 30.4, 1.0, 0.08, 2.6, '#a67c52', undefined, 0);
  windmill(d, 80.0, 0, -24.0, 'w');
  row(d, rng, 'w', 84.0, 0, [[12.0, 7.2], [20.8, 8.0], [40.0, 7.2], [48.8, 7.2]]);
  church(d, 98.0, 0, 30.4, 'w');
  for (let i = 0; i < (d.detail === 0 ? 8 : 16); i++) tree(t, rng.range(66, 130), 0, rng.range(-46, 120), rng.range(1.0, 1.5), rng.chance(0.4) ? 'pine' : 'oak', rng);
  for (const z of [-30.0, -8.0, 14.0]) reeds(t, bank - 0.6, z, rng);
}

/** North: the stream under the crag with a hamlet and a footbridge, sheep and ricks on the terraces, pines on the top. */
function northValley(d: Drawer, t: Pen, rng: Rng) {
  const y = -14;
  row(d, rng, 's', -68.0, y, [[-44.0, 7.2], [-32.8, 6.4], [-20.0, 8.0], [-6.4, 7.2], [8.0, 6.4]], 7.2);
  t.box(-26.0, y - 0.2, -62.0, 1.6, 0.36, 5.6, '#8a5f3a', undefined, 0);
  for (let i = 0; i < (d.detail === 0 ? 6 : 12); i++) tree(t, rng.range(-120, 36), y, rng.range(-58, -54) - (i % 2) * 11, rng.range(0.9, 1.2), 'willow', rng);
  // Poplars at the foot of the crag: their crowns just clear its edge, which shows how deep the drop is.
  const step = d.detail === 0 ? 14 : 8;
  for (let x = -60; x < 40; x += step) tree(t, x + rng.range(-2.4, 2.4), y, -57.0 - rng.range(0, 2.4), rng.range(1.3, 1.45), 'poplar', rng);
  const rows = [-84, -100, -116, -132];
  if (d.detail > 0) for (let i = 0; i < 16; i++) {
    const k = i % rows.length;
    const z = rows[k]! - rng.range(1, 5);
    sheep(t, rng.range(-60, 60), terraceY(z), z, rng.range(0, Math.PI * 2));
  }
  for (let i = 0; i < 6; i++) {
    const z = -98 - rng.range(0, 4);
    rick(t, rng.range(-90, 90), terraceY(z), z);
  }
  for (let i = 0; i < (d.detail === 0 ? 12 : 28); i++) tree(t, rng.range(-160, 160), y + 21.6, rng.range(-150, -200), rng.range(1.4, 2.0), 'pine', rng);
  t.cyl(-28.0, y + 21.6, -158.0, 3.2, 9.6, hz('#a39a86', -28, -158), undefined, 0, 10);
  t.box(-28.0, y + 31.2, -158.0 + 1.6, 3.2, 1.6, 1.2, hz('#a39a86', -28, -158), undefined, 0);
}

/** Ground height on the valley's far side, which climbs in 2.4 m terraces 8 m deep from z = -80. */
const terraceY = (z: number) => (z > -80 ? -14 : -14 + 2.4 * (Math.min(8, Math.floor((-80 - z) / 8)) + 1));

/** A clump of reeds at the water's edge. */
function reeds(t: Pen, x: number, z: number, rng: Rng) {
  if (t.detail === 0) return;
  for (let i = 0; i < 7; i++) t.box(x + rng.range(-1.2, 1.2), -0.5, z + rng.range(-0.5, 0.5), 0.06, rng.range(1.2, 1.8), 0.06, rng.pick(['#7a9e4a', '#8aaa4a', '#6f8a3a']), undefined, 0);
}
