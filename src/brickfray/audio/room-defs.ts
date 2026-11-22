import { fortressWorks } from '../world/fortress-works';
import { MAPS } from '../world/index';
import { K } from '../world/keep';
import { plazaLayout } from '../world/map-plaza';
import { ARCADE } from '../world/plaza-parts';
import { T } from '../world/temple-layout';
import type { MapId } from '../world/types';
import { WH } from '../world/warehouse';

type Vec3 = [number, number, number];
/** One value per side of a box: [-x, +x, -y, +y, -z, +z]. */
export type Sides = readonly [number, number, number, number, number, number];

export interface RoomDef {
  /** Where the room is, for `roomAt`: from 0.5 m under its floor to its ceiling. */
  min: Vec3;
  max: Vec3;
  /** Cross-fade depth in metres at each side: an opening fades the room in, a wall (0) does not. */
  fade: Sides;
  /** Inside dimensions in metres; the ear sits mid-floor, 1.6 m up. */
  size: Vec3;
  /** Pressure kept per bounce off each side (0: an opening). */
  walls: Sides;
  /** Level of the first reflections (impulse units at 1 m of path). */
  early: number;
  /** Seconds to -60 dB of the diffuse tail, and its energy. */
  t60: number;
  tail: number;
  /** Tail brightness: low-pass cutoff in Hz at the start and the end. */
  bright: [number, number];
  /** Share of the map's outdoor response that still reaches in through the openings. */
  outdoor: number;
  /** The outdoor ambience bed inside: its level and the cutoff the walls leave it. */
  bed: { gain: number; cutoff: number };
}

type Acoustic = Omit<RoomDef, 'min' | 'max' | 'size' | 'fade'>;

const OPEN = 1.2;
const DOORS: Sides = [OPEN, OPEN, 0, 0, OPEN, OPEN];

/** Big stone or brick hall: first reflections late and strong, a long tail; the walls keep the bed out. */
const GREAT: Acoustic = { walls: [0.86, 0.86, 0.82, 0.9, 0.86, 0.86], early: 7, t60: 2.1, tail: 2.6, bright: [6500, 1700], outdoor: 0.25, bed: { gain: 0.3, cutoff: 1200 } };
const HALL: Acoustic = { walls: [0.86, 0.86, 0.82, 0.9, 0.86, 0.86], early: 6.5, t60: 1.6, tail: 2.4, bright: [6500, 1800], outdoor: 0.3, bed: { gain: 0.35, cutoff: 1300 } };
/** A shop or a barn full of stock: close walls, a short dull tail. */
const SHOP: Acoustic = { walls: [0.8, 0.8, 0.8, 0.86, 0.8, 0.8], early: 5, t60: 0.8, tail: 1.8, bright: [7000, 2200], outdoor: 0.35, bed: { gain: 0.4, cutoff: 1500 } };
/** Arch or gate passage open at both ends: walls close either side, the flutter between them. */
const PASSAGE: Acoustic = { walls: [0.9, 0.9, 0.85, 0.92, 0, 0], early: 3.5, t60: 1.1, tail: 2.2, bright: [8000, 2400], outdoor: 0.55, bed: { gain: 0.6, cutoff: 3500 } };

/** A room over the box from `min` (its floor) to `max` (its ceiling). */
function room(min: Vec3, max: Vec3, fade: Sides, a: Acoustic): RoomDef {
  return { ...a, fade, min: [min[0], min[1] - 0.5, min[2]], max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** The room inside a building's roof or ceiling block: its footprint less the walls, from the ground to the block's foot. */
function under(b: { min: readonly number[]; max: readonly number[] }, wall: number, fade: Sides, a: Acoustic): RoomDef {
  return room([b.min[0]! + wall, 0, b.min[2]! + wall], [b.max[0]! - wall, b.min[1]!, b.max[2]! - wall], fade, a);
}

/** A temple room's twin on the other half of the map (the layout turns half a turn about the centre). */
function turned(r: RoomDef): RoomDef {
  const swap = (s: Sides): Sides => [s[1], s[0], s[2], s[3], s[5], s[4]];
  return { ...r, min: [-r.max[0], r.min[1], -r.max[2]], max: [-r.min[0], r.max[1], -r.min[2]], fade: swap(r.fade), walls: swap(r.walls) };
}

/**
 * Plaza: the council hall under the clock tower, the colonnade, the market hall, the station concourse, the bakery and
 * the laundrette, and the two arches of the Town Gate.
 */
function plaza(): RoomDef[] {
  const L = plazaLayout();
  const block = (tag: string) => L.pieces.find((q) => (q.kind === 'ceiling' || q.kind === 'roof') && q.tag === tag)!;
  const gate = block('gate');
  const pier = L.pieces.find((q) => q.kind === 'wall' && q.tag === 'gate')!;
  const arch = (x0: number, x1: number) => room([x0, 0, gate.min[2]], [x1, gate.min[1], gate.max[2]], [0, 0, 0, 0, OPEN, OPEN], PASSAGE);
  return [
    under(block('townhall'), 0.8, DOORS, HALL),
    room([ARCADE.x0, 0, ARCADE.z0], [ARCADE.x1, ARCADE.deck - ARCADE.slab, ARCADE.z1], [OPEN, 0, 0, 0, OPEN, OPEN], {
      walls: [0.25, 0.92, 0.85, 0.92, 0, 0],
      early: 5.5,
      t60: 1,
      tail: 1.9,
      bright: [7000, 2100],
      outdoor: 0.65,
      bed: { gain: 0.7, cutoff: 5000 }
    }),
    under(block('hall'), 0.8, DOORS, { ...GREAT, walls: [0.72, 0.86, 0.82, 0.9, 0.86, 0.86] }),
    under(block('station'), 0.8, DOORS, { ...HALL, walls: [0.86, 0.86, 0.82, 0.9, 0.72, 0.86], t60: 1.7 }),
    under(block('bakery'), 0.8, DOORS, SHOP),
    under(block('laundrette'), 0.8, DOORS, SHOP),
    arch(gate.min[0], pier.min[0]),
    arch(pier.max[0], gate.max[0])
  ];
}

/**
 * Temple: the nave under the high roof between the column rows, each aisle under its gallery (open to the nave between
 * the columns and to the court through the arcade), each gallery over it, and the gate hall at each end.
 */
function temple(): RoomDef[] {
  const LOW = T.high - T.slab;
  const pillar = 6.12;
  const aisleIn = 6.68;
  const nave = room([-pillar, 0, -T.hallZ], [pillar, T.hallTop, T.hallZ], DOORS, { ...GREAT, walls: [0.45, 0.45, 0.82, 0.9, 0.88, 0.88], t60: 2.3, tail: 2.8, outdoor: 0.2 });
  const aisle = room([aisleIn, 0, -T.hallZ], [T.galleryOut, LOW, T.hallZ], DOORS, {
    walls: [0.4, 0.45, 0.82, 0.9, 0.45, 0.45],
    early: 5,
    t60: 1.2,
    tail: 2,
    bright: [7000, 2000],
    outdoor: 0.45,
    bed: { gain: 0.55, cutoff: 2500 }
  });
  const gallery = room([T.galleryIn - 0.4, T.high, -T.hallZ], [T.galleryOut, T.roofTop, T.hallZ], [OPEN, 0, 0, 0, 0, 0], {
    walls: [0.3, 0.9, 0.85, 0.9, 0.88, 0.88],
    early: 5,
    t60: 1.4,
    tail: 2.1,
    bright: [7000, 2000],
    outdoor: 0.4,
    bed: { gain: 0.5, cutoff: 2200 }
  });
  const gateHall = room([-2.4, 0, -T.gate], [2.4, T.rangeTop, -T.row], DOORS, { ...PASSAGE, walls: [0.86, 0.86, 0.82, 0.9, 0.86, 0.45], t60: 1.2, early: 4.5 });
  return [nave, aisle, turned(aisle), gallery, turned(gallery), gateHall, turned(gateHall)];
}

/** Most of a room's floor, at ear height, is open (not a solid building under a roof, like the mill). */
function walkIn(map: MapId, r: RoomDef): boolean {
  const { colliders } = MAPS[map].layout();
  const grid = [0.1, 0.3, 0.5, 0.7, 0.9];
  const blocked = grid.flatMap((u) => grid.map((v) => [r.min[0] + (r.max[0] - r.min[0]) * u, r.min[1] + 2.1, r.min[2] + (r.max[2] - r.min[2]) * v]));
  return blocked.filter((p) => colliders.some((c) => !c.bulletsPass && [0, 1, 2].every((a) => p[a]! > c.min[a]! && p[a]! < c.max[a]!))).length <= 10;
}

/** Fortress: the keep's hall, then every building under a big roof you can walk into (great hall, chapel, stables, barn). */
function fortress(): RoomDef[] {
  const keep = room([-(K.half - K.wall), 0, -(K.half - K.wall)], [K.half - K.wall, K.roof - K.slab, K.half - K.wall], DOORS, { ...GREAT, t60: 2.2, tail: 2.8, early: 6.5 });
  const halls = fortressWorks()
    .roofs.filter((r) => !r.small && r.base >= 4.8 && (r.x1 - r.x0) * (r.z1 - r.z0) >= 60)
    .map((r) => under({ min: [r.x0, r.base, r.z0], max: [r.x1, r.base, r.z1] }, 0.8, DOORS, r.base >= 5.6 ? HALL : SHOP))
    .filter((r) => walkIn('fortress', r));
  return [keep, ...halls];
}

/** Docks: the warehouse. */
function docks(): RoomDef[] {
  return [
    room([WH.x0, 0, WH.z0], [WH.x1, WH.height, WH.z1], [OPEN, OPEN, OPEN, OPEN, OPEN, OPEN], {
      walls: [0.88, 0.88, 0.8, 0.9, 0.85, 0.8],
      early: 7.5,
      t60: 2,
      tail: 2.2,
      bright: [5000, 1600],
      outdoor: 0.3,
      bed: { gain: 0.4, cutoff: 1600 }
    })
  ];
}

const BUILD: Record<MapId, () => RoomDef[]> = { plaza, fortress, docks, temple };

/**
 * Enclosed spaces with their own response, the first of each map the one a fresh mixer starts with. Each is a box of
 * hard walls with its openings: the first reflections come from its real size (image sources), so a 4 m arch flutters
 * every ~12 ms, the keep's walls answer at ~28 ms and the warehouse's gable ends at ~85 ms. Every room is louder in its
 * first 50 ms than the open air and rings at least as long, and still hears the map's outdoor response through its
 * doors. A map's rooms are built from its layout the first time they are read.
 */
export const ROOMS = {} as Record<MapId, readonly RoomDef[]>;
for (const map of Object.keys(BUILD) as MapId[]) {
  let built: readonly RoomDef[] | null = null;
  Object.defineProperty(ROOMS, map, { enumerable: true, get: () => (built ??= BUILD[map]()) });
}
