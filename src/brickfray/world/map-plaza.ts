import * as THREE from 'three';
import { BLOCK, DECAL, GROUND, STAIRS, type Masonry } from './blocks';
import { cityBackdrop } from './backdrop';
import { BUILDING, type BuildingParams } from './facade';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { plazaDressing } from './plaza-dressing';
import { plazaRoad } from './plaza-road';
import { ARCADE_STAIR } from './plaza-stair';
import { ARCADE, ARCADE_EL, ARCADE_STAIRS, BANDSTAND, BANDSTAND_EL, CLOCK_TOWER, TOWER } from './plaza-parts';
import { yawToward, type Face } from './util';

const P = 0.16;
const PAVING = '#dcc79a';
const SIDEWALK = '#b7bcc2';
const ROAD = '#67686a';
const STONE: Masonry = { colors: ['#e3d6bc', '#d6c7a8', '#efe5cf'], variance: 0.3 };

type Row = { face: Face; fixed: [number, number]; cuts: number[]; floors: number[]; looks: Look[] };
type Look = Pick<BuildingParams, 'wall' | 'trim' | 'roof' | 'roofColor' | 'shop' | 'windows' | 'shutters' | 'balcony'>;

const LOOKS: Look[] = [
  { wall: ['#e8c547', '#efd36a', '#dcb93c'], trim: '#f2f2ee', roof: 'gable', roofColor: '#a8452e', windows: 'tall', shutters: '#2f6a8a', shop: { awning: ['#2f8a3e', '#f2f2ee'], sign: '#2f8a3e', icon: 'flower', door: '#2f6a4a' } },
  { wall: ['#d9663b', '#e27a52', '#c8582f'], trim: '#f3e6b8', roof: 'flat', roofColor: '#545c63', windows: 'arched', balcony: true },
  { wall: ['#4f8fbf', '#5b9bcb', '#4682b2'], trim: '#f2f2ee', roof: 'gable', roofColor: '#545c63', windows: 'square', shop: { awning: ['#c8231b', '#f2f2ee'], sign: '#c8231b', icon: 'cup', door: '#7a1712' } },
  { wall: ['#e7e1d2', '#f2ede2', '#d9d2c1'], trim: '#c99a3e', roof: 'gable', roofColor: '#2f6a8a', windows: 'tall', shutters: '#2f8a3e', balcony: true },
  { wall: ['#c44d58', '#cf5d68', '#b5434e'], trim: '#f2f2ee', roof: 'flat', roofColor: '#545c63', windows: 'tall', shop: { awning: ['#f6c624', '#f2f2ee'], sign: '#f5a623', icon: 'bread', door: '#6e4a2f' } },
  { wall: ['#8fbf6a', '#9bcb76', '#82b25e'], trim: '#f2f2ee', roof: 'gable', roofColor: '#7a1712', windows: 'arched', shutters: '#f2f2ee' },
  { wall: ['#f2a65a', '#f5b36e', '#e8984a'], trim: '#f2f2ee', roof: 'gable', roofColor: '#545c63', windows: 'square', shop: { awning: ['#1f62c7', '#f2f2ee'], sign: '#1f62c7', icon: 'book', door: '#17284f' } },
  { wall: ['#6fb7b0', '#7cc3bc', '#62a9a2'], trim: '#f3e6b8', roof: 'flat', roofColor: '#545c63', windows: 'tall', balcony: true },
  { wall: ['#b07ac2', '#bb88cc', '#a26cb5'], trim: '#f2f2ee', roof: 'gable', roofColor: '#a8452e', windows: 'tall', shutters: '#f6c624', shop: { awning: ['#6a3d9a', '#f3e6b8'], sign: '#6a3d9a', icon: 'gem', door: '#6a3d9a' } },
  { wall: ['#d98c5f', '#e39a6e', '#cc7f52'], trim: '#f2f2ee', roof: 'gable', roofColor: '#2f6a8a', windows: 'square', shop: { awning: ['#1b9aa0', '#f2f2ee'], sign: '#1b9aa0', icon: 'fish', door: '#1b5a60' } }
];

const ROWS: Row[] = [
  { face: 's', fixed: [-35.2, -29.6], cuts: [-37.6, -28.0, -19.2, -8.0, 2.4, 12.8, 22.4, 28.8, 37.6], floors: [3, 4, 3, 4, 3, 4, 3, 3], looks: [] },
  { face: 'n', fixed: [29.6, 35.2], cuts: [-37.6, -29.6, -20.8, -11.2, -0.8, 9.6, 19.2, 28.0, 37.6], floors: [3, 3, 4, 3, 4, 3, 4, 3], looks: [] },
  { face: 'e', fixed: [-37.6, -32.0], cuts: [-29.6, -19.2, -8.8, 1.6, 12.0, 20.8, 29.6], floors: [4, 3, 4, 3, 4, 3], looks: [] },
  { face: 'w', fixed: [32.0, 37.6], cuts: [-29.6, -19.2, -8.8, 1.6, 12.0, 20.8, 29.6], floors: [3, 4, 3, 4, 3, 4], looks: [] }
];

function buildings(p: Plan) {
  let k = 0;
  for (const row of ROWS) {
    for (let i = 0; i < row.cuts.length - 1; i++) {
      const a = row.cuts[i]!;
      const b = row.cuts[i + 1]!;
      const look = LOOKS[(k * 7 + 3) % LOOKS.length]!;
      k++;
      const ns = row.face === 'n' || row.face === 's';
      const [f0, f1] = row.fixed;
      const arcade = row.face === 'w' && (a + b) / 2 > ARCADE.z0 && (a + b) / 2 < ARCADE.z1;
      p.add(BUILDING, {
        x0: ns ? a : f0,
        x1: ns ? b : f1,
        z0: ns ? f0 : a,
        z1: ns ? f1 : b,
        height: row.floors[i]! * 3.36 + 0.48,
        face: row.face,
        ...look,
        shop: arcade ? look.shop ?? LOOKS[0]!.shop : look.shop,
        seed: k * 13
      });
    }
  }
}

function ground(p: Plan) {
  plazaRoad(p, ROAD, [-27.2, -26.4, 27.2, 26.4], [-21.6, -20.0, 21.6, 20.0]);
  const walk = (x0: number, z0: number, x1: number, z1: number, color = SIDEWALK) => p.add(GROUND, { x0, z0, x1, z1, y: P, color, surface: 'plastic', depth: P });
  walk(-32, -29.6, 32, -26.4);
  walk(-32, 26.4, 32, 29.6);
  walk(-32, -26.4, -27.2, -14.4);
  walk(-32, 14.4, -27.2, 26.4);
  walk(27.2, -26.4, 32, 26.4);
  walk(-21.6, -20.0, 21.6, 20.0, PAVING);
  const decal = (x0: number, z0: number, x1: number, z1: number, color: string, y = P + 0.004, smooth = false) => p.add(DECAL, { x0, z0, x1, z1, y, color, surface: 'plastic', smooth });
  decal(-5.6, -5.6, 5.6, 5.6, '#c4553a');
  decal(-4.8, -4.8, 4.8, 4.8, PAVING, P + 0.006);
  for (const s of [-1, 1]) {
    decal(-1.2, s > 0 ? 5.6 : -20.0, 1.2, s > 0 ? 20.0 : -5.6, '#c9b48a');
    decal(s > 0 ? 5.6 : -9.6, -1.2, s > 0 ? 9.6 : -5.6, 1.2, '#c9b48a');
  }
  const crossings: [number, number, number, number][] = [];
  for (const z of [-26.0, 20.4]) {
    crossings.push([-3.6, z, 3.0, z + 5.6]);
    for (let i = 0; i < 6; i++) decal(-3.6 + i * 1.2, z, -3.0 + i * 1.2, z + 5.6, '#f2f2ee', 0.004, true);
  }
  for (const x of [-27.2, 21.6]) {
    crossings.push([x, 14.4, x + 5.6, 18.4]);
    for (let i = 0; i < 4; i++) decal(x, 18.0 - i * 1.2, x + 5.6, 18.4 - i * 1.2, '#f2f2ee', 0.004, true);
  }
  const dash = (x0: number, z0: number, x1: number, z1: number) => {
    const alongX = x1 - x0 > z1 - z0;
    let [a, b] = alongX ? [x0, x1] : [z0, z1];
    for (const [cx0, cz0, cx1, cz1] of crossings) {
      if (x1 <= cx0 || x0 >= cx1 || z1 <= cz0 || z0 >= cz1) continue;
      const [c0, c1] = alongX ? [cx0 - 0.6, cx1 + 0.6] : [cz0 - 0.6, cz1 + 0.6];
      if (c0 - a > b - c1) b = Math.min(b, c0);
      else a = Math.max(a, c1);
    }
    if (b - a < 0.4) return;
    if (alongX) decal(a, z0, b, z1, '#f2f2ee', 0.004, true);
    else decal(x0, a, x1, b, '#f2f2ee', 0.004, true);
  };
  for (let i = 0; i < 8; i++) {
    for (const z of [-23.2, 23.2]) dash(-28 + i * 7.2, z - 0.08, -25.6 + i * 7.2, z + 0.08);
    for (const x of [-24.4, 24.4]) if (i < 5) dash(x - 0.08, -16 + i * 7.2, x + 0.08, -13.6 + i * 7.2);
  }
}

function structures(p: Plan) {
  p.add(CLOCK_TOWER, {});
  for (const s of [-1, 1] as const) {
    p.add(STAIRS, { x: (TOWER.shaftX1 + TOWER.x1) / 2 - 0.0, z: s * 10.4, y0: P, dir: s < 0 ? 's' : 'n', width: 2.4, steps: 10, rise: 0.48, run: 0.8, style: STONE, surface: 'plastic', topColor: '#c9b48a' });
  }
  p.add(BANDSTAND_EL, {});
  for (const s of [-1, 1] as const) {
    p.add(STAIRS, { x: (BANDSTAND.x0 + BANDSTAND.x1) / 2, z: s * 6.4, y0: P, dir: s < 0 ? 's' : 'n', width: 2.4, steps: 3, rise: 0.48, run: 0.8, style: STONE, surface: 'plastic', topColor: '#c9a26e' });
  }
  p.add(STAIRS, { x: BANDSTAND.x0 - 2.4, z: 0, y0: P, dir: 'e', width: 2.4, steps: 3, rise: 0.48, run: 0.8, style: STONE, surface: 'plastic', topColor: '#c9a26e' });
  p.add(ARCADE_EL, {});
  for (const z0 of ARCADE_STAIRS) p.add(ARCADE_STAIR, { z0 });
  p.add(BLOCK, { min: [-32, 0, -14.4], max: [-27.2, 0.96, 14.4], surface: 'plastic', style: { colors: ['#c4553a', '#b44a31', '#d06a4c'], variance: 0.25 }, faces: ['e', 'n', 's'], top: 'ground', topColor: '#e3b17a', walk: true });
  for (const s of [-1, 1] as const) {
    p.add(STAIRS, { x: -29.6, z: s * 16.0, y0: P, dir: s < 0 ? 's' : 'n', width: 2.4, steps: 2, rise: 0.4, run: 0.8, style: STONE, surface: 'plastic' });
  }
  p.add(STAIRS, { x: -25.6, z: 0, y0: 0, dir: 'w', width: 3.2, steps: 2, rise: 0.48, run: 0.8, style: STONE, surface: 'plastic' });
}

function spawns(p: Plan) {
  const team = (t: 0 | 1, pts: [number, number, number][]) => {
    for (const [x, y, z] of pts) p.spawn(x, y, z, t === 1 ? Math.PI : 0, t);
  };
  team(1, [[-24, P, -28], [-16, P, -28], [-8, P, -27.6], [0, P, -28], [8, P, -27.6], [16, P, -28], [24, P, -28], [-4, 0, -24.8], [4, 0, -24.8], [-20, 0, -21.6]]);
  team(0, [[-24, P, 28], [-16, P, 28], [-8, P, 27.6], [0, P, 28], [8, P, 27.6], [16, P, 28], [24, P, 28], [-4, 0, 24.8], [4, 0, 24.8], [20, 0, 21.6]]);
  const ffa: [number, number, number][] = [
    [-30.4, 0.96, -8.8], [-30.4, 0.96, 8], [-25.2, 0, -12.8], [-24.8, 0, 18], [24.8, 0, -18], [24.8, 0, 18], [30, 3.84, 0], [-10.8, P, -14.4],
    [10.8, P, 14.4], [-8, P, 0], [8, P, -8], [-16.4, P, -16.4], [16.4, P, 16.4], [0, P, -17.6], [0, P, 17.6], [-12, 0, -24], [12, 0, 24], [-28, P, -28], [28, P, 28]
  ];
  for (const [x, y, z] of ffa) p.spawn(x, y, z, yawToward([x, z], [0, 0]));
}

export const PLAZA_VIEWS: LabView[] = [
  { name: 'overview', cam: [38, 46, 50], target: [0, 0, 0], fov: 50 },
  { name: 'overview-north', cam: [-30, 40, -48], target: [0, 0, 0], fov: 50 },
  { name: 'lane-west', cam: [-24.8, P + 1.62, 24], target: [-24.8, 1.6, 0], fov: 70 },
  { name: 'lane-center', cam: [0, P + 1.62, 24], target: [0, 1.6, 0], fov: 70 },
  { name: 'lane-east', cam: [25, 1.62, 24], target: [25, 1.6, 0], fov: 70 },
  { name: 'spawn-north', cam: [0, P + 1.62, -27], target: [0, 1.6, 0], fov: 70 },
  { name: 'tower-lookout', cam: [-15.2, TOWER.floor + 1.62, 0], target: [10, 0, 0], fov: 75 },
  { name: 'arcade-deck', cam: [29.6, ARCADE.deck + 1.62, 14], target: [0, 0, -4], fov: 75 },
  { name: 'tower-close', cam: [-2, 3, 9], target: [-13, 4, 0], fov: 60 },
  { name: 'facades', cam: [10, 2.2, -16], target: [0, 5, -30], fov: 70 }
];

export const PLAZA = defineMap({
  id: 'plaza',
  name: 'Sunny Plaza',
  atmosphere: {
    zenith: '#3f8fe0',
    horizon: '#d4e8f6',
    ground: '#a9a18f',
    sunColor: '#ffecd0',
    sunIntensity: 3.0,
    sunDirection: new THREE.Vector3(0.5, 0.62, 0.42).normalize(),
    fogNear: 85,
    clouds: { count: 11, seed: 3 }
  },
  bounds: { min: [-33.2, -6, -30.8], max: [33.2, 40, 30.8] },
  killY: -4,
  seed: 11,
  plan() {
    const p = new Plan();
    ground(p);
    buildings(p);
    structures(p);
    plazaDressing(p);
    spawns(p);
    return p;
  },
  backdrop: (d) => cityBackdrop(d)
});
