import * as THREE from 'three';
import { BLOCK, DECAL, GROUND, STAIRS, type StairParams } from './blocks';
import { castleBackdrop } from './backdrop-castle';
import { C, CASTLE_STONE, CORNER_TOWER, CURTAIN, GATEHOUSE, WALK_TILE } from './castle-parts';
import { fortressDressing } from './fortress-dressing';
import { HAYLOFT, LOFT, SMITHY_EL } from './fortress-parts';
import { BRIDGE, K, KEEP, MOAT, PLANK_BRIDGE } from './keep';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { yawToward } from './util';

const SAND = '#d6c290';
const COBBLE = '#a8a294';
const MARKET = '#c79c74';
const PADDOCK = '#a9895a';
const W = C.walk;

function ground(p: Plan) {
  const g = (x0: number, z0: number, x1: number, z1: number, color = SAND) => p.add(GROUND, { x0, z0, x1, z1, y: 0, color, surface: 'plastic' });
  g(-36, -36, 36, -K.moat);
  g(-36, K.moat, 36, 36);
  g(-36, -K.moat, -K.moat, K.moat, MARKET);
  g(K.moat, -K.moat, 36, K.moat);
  p.add(GROUND, { x0: -K.island, z0: -K.island, x1: K.island, z1: K.island, y: 0, color: '#86a95f', surface: 'plastic' });
  const decal = (x0: number, z0: number, x1: number, z1: number, color: string, smooth = false) => p.add(DECAL, { x0, z0, x1, z1, y: 0.004, color, surface: 'plastic', smooth });
  for (const s of [-1, 1]) decal(15.2, s < 0 ? -18.4 : 8.8, 22.4, s < 0 ? -8.8 : 18.4, PADDOCK);
  for (const s of [-1, 1]) {
    decal(-2.0, s > 0 ? K.moat : -29.2, 2.0, s > 0 ? 29.2 : -K.moat, COBBLE);
    decal(s > 0 ? K.moat : -24.8, -1.2, s > 0 ? 24.8 : -K.moat, 1.2, COBBLE);
  }
  decal(-14.4, -14.4, 14.4, -K.moat, COBBLE);
  decal(-14.4, K.moat, 14.4, 14.4, COBBLE);
  decal(-14.4, -K.moat, -K.moat, K.moat, COBBLE);
  decal(K.moat, -K.moat, 14.4, K.moat, COBBLE);
  for (const [x0, z0, x1, z1] of [[-30.4, -24, -26.4, -17.6], [26.4, 17.6, 30.4, 24], [-12, 22.4, -6.4, 28], [6.4, -28, 12, -22.4]] as const) decal(x0, z0, x1, z1, '#7fa45a');
  const grass = '#6f9a4a';
  for (const [x0, z0, x1, z1] of [[-110, -110, 110, -36], [-110, 36, 110, 110], [-110, -36, -36, 36], [36, -36, 110, 36]] as const) p.add(DECAL, { x0, z0, x1, z1, y: 0, color: grass, surface: 'foliage' });
}

const stair = (x: number, z: number, dir: StairParams['dir']): StairParams => ({ x, z, y0: 0, dir, width: 2.4, steps: 8, rise: 0.48, run: 0.8, style: CASTLE_STONE, surface: 'stone' });
const landing = (x0: number, z0: number, x1: number, z1: number) => ({ min: [x0, 0, z0] as [number, number, number], max: [x1, W, z1] as [number, number, number], surface: 'stone' as const, style: CASTLE_STONE, top: 'tiles' as const, topColor: WALK_TILE, walk: true });

function walls(p: Plan) {
  const t = C.tower;
  const ew: [number, number][] = [[-16.0, -13.6], [-6.4, 6.4], [13.6, 16.0]];
  p.add(CURTAIN, { side: 'w', from: -t, to: t, gaps: ew });
  p.add(CURTAIN, { side: 'e', from: -t, to: t, gaps: ew });
  for (const side of ['n', 's'] as const) {
    p.add(CURTAIN, { side, from: -t, to: -5.6, gaps: [[-16.8, -14.4]] });
    p.add(CURTAIN, { side, from: 5.6, to: t, gaps: [[14.4, 16.8]] });
    p.add(GATEHOUSE, { sz: side === 'n' ? -1 : 1 });
  }
  for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) p.add(CORNER_TOWER, { sx, sz });
  for (const sx of [-1, 1]) {
    const x = sx * 29.6;
    p.add(STAIRS, stair(x, -8.0, 'n'));
    p.add(STAIRS, stair(x, 8.0, 's'));
    const [x0, x1] = sx < 0 ? [-30.8, -28.4] : [28.4, 30.8];
    p.add(BLOCK, landing(x0, -16.0, x1, -14.4));
    p.add(BLOCK, landing(x0, 14.4, x1, 16.0));
  }
  for (const sz of [-1, 1]) {
    const z = sz * 29.6;
    p.add(STAIRS, stair(-8.8, z, 'w'));
    p.add(STAIRS, stair(8.8, z, 'e'));
    const [z0, z1] = sz < 0 ? [-30.8, -28.4] : [28.4, 30.8];
    p.add(BLOCK, landing(-16.8, z0, -15.2, z1));
    p.add(BLOCK, landing(15.2, z0, 16.8, z1));
  }
}

function center(p: Plan) {
  p.add(MOAT, {});
  p.add(KEEP, {});
  p.add(BRIDGE, { sz: -1 });
  p.add(BRIDGE, { sz: 1 });
  p.add(PLANK_BRIDGE, { sx: -1 });
  p.add(PLANK_BRIDGE, { sx: 1 });
  p.add(HAYLOFT, {});
  p.add(STAIRS, { x: -26.4, z: 10.4, y0: 0, dir: 'n', width: 2.4, steps: 5, rise: 0.48, run: 0.8, style: { colors: ['#8a5f3a', '#9a6a3f', '#7d5434'], variance: 0.3 }, surface: 'wood', topColor: '#b98a5a' });
  p.add(SMITHY_EL, {});
}

function spawns(p: Plan) {
  const side: [number, number][] = [[-20.4, -27.6], [-18.4, -22.4], [-12, -25.6], [-4.4, -26.4], [0, -30.4], [4.4, -26.4], [12, -25.6], [20, -27.6], [18.4, -22.4], [0, -21.6]];
  for (const [x, z] of side) p.spawn(x, 0, z, Math.PI, 1);
  for (const [x, z] of side) p.spawn(-x, 0, -z, 0, 0);
  const ffa: [number, number, number][] = [
    [-32.8, W, -20], [32.8, W, 20], [-32.8, W, 22], [32.8, W, -22], [-22, W, -32.8], [22, W, 32.8], [-27.2, LOFT.top, 0], [28.0, 3.36, 4.4],
    [0, 0, -3.2], [-3.2, K.roof, 3.2], [-20, 0, -8], [20, 0, 8], [-18, 0, 16], [18, 0, -16], [-6.4, 0, -18], [6.4, 0, 18], [-22.4, 0, 20.8], [22.4, 0, -20.8]
  ];
  for (const [x, y, z] of ffa) p.spawn(x, y, z, yawToward([x, z], [0, 0]));
}

export const FORTRESS_VIEWS: LabView[] = [
  { name: 'overview', cam: [44, 52, 58], target: [0, 0, 0], fov: 50 },
  { name: 'overview-west', cam: [-60, 40, -20], target: [0, 0, 0], fov: 50 },
  { name: 'lane-west', cam: [-20, 1.62, 26], target: [-20, 1.6, 0], fov: 70 },
  { name: 'lane-center', cam: [0, 1.62, 26], target: [0, 2.4, 0], fov: 70 },
  { name: 'lane-east', cam: [20, 1.62, 26], target: [20, 1.6, 0], fov: 70 },
  { name: 'wall-walk', cam: [-32.8, W + 1.62, 24], target: [-20, 2, 0], fov: 75 },
  { name: 'keep-roof', cam: [2, K.roof + 1.62, -3], target: [-10, 1, 20], fov: 75 },
  { name: 'gate', cam: [6, 1.62, -20], target: [0, 3, -30], fov: 70 },
  { name: 'moat', cam: [-8, 2.2, 10.5], target: [6, 0, 6], fov: 70 }
];

export const FORTRESS = defineMap({
  id: 'fortress',
  name: 'Sunset Keep',
  atmosphere: {
    zenith: '#5a8fcf',
    horizon: '#f3dcc0',
    ground: '#9c8a6a',
    sunColor: '#ffd8a0',
    sunIntensity: 2.7,
    sunDirection: new THREE.Vector3(-0.55, 0.5, 0.45).normalize(),
    fogNear: 80
  },
  bounds: { min: [-34, -6, -34], max: [34, 40, 34] },
  killY: -0.8,
  seed: 23,
  plan() {
    const p = new Plan();
    ground(p);
    walls(p);
    center(p);
    fortressDressing(p);
    spawns(p);
    return p;
  },
  backdrop: (d) => castleBackdrop(d)
});
