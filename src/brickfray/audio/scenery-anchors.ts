import { DOCKS_SHIPS } from '../world/backdrop-docks';
import { BERTH, QUAY } from '../world/docks-layout';
import { CRANE_Z } from '../world/docks-yard';
import { fortressWorks } from '../world/fortress-works';
import { MAPS } from '../world/index';
import { FORTRESS_AMBIENCE } from '../world/map-fortress';
import { plazaLayout } from '../world/map-plaza';
import { Plan } from '../world/plan';
import { plazaProps } from '../world/plaza-props';
import { TREE } from '../world/props-nature';
import { roofHeight } from '../world/roofs';
import { templeCover } from '../world/temple-cover';
import { templeGeometry } from '../world/temple-geometry';
import { T } from '../world/temple-layout';
import { LOTUS_POOL } from '../world/temple-props';
import type { MapId } from '../world/types';
import type { AmbientSpot } from './types';

export type Point = [number, number, number];

/** One kind of scenery sound on a map and the real objects it comes from. */
export interface Spot {
  spot: AmbientSpot;
  /** Relative odds per scenery slot. */
  weight: number;
  at: readonly Point[];
  /** A pick lands up to this far off its point sideways and half of it higher (birds off their perch). */
  roam?: number;
}

interface Box {
  min: readonly number[];
  max: readonly number[];
}

const inside = (p: Point, b: Box) => p[0] > b.min[0]! && p[0] < b.max[0]! && p[1] > b.min[1]! && p[1] < b.max[1]! && p[2] > b.min[2]! && p[2] < b.max[2]!;
const centre = (b: Box): Point => [(b.min[0]! + b.max[0]!) / 2, b.max[1]!, (b.min[2]! + b.max[2]!) / 2];
const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

/** A point inside the map's bounds and outside everything solid. */
function open(map: MapId): (p: Point) => boolean {
  const { colliders, bounds } = MAPS[map].layout();
  return (p) => p[0] > bounds.min[0] && p[0] < bounds.max[0] && p[2] > bounds.min[2] && p[2] < bounds.max[2] && !colliders.some((c) => inside(p, c));
}

/** The spot over `points`, keeping those a pick can roam from (see pickSpot) without entering a wall or leaving the map. */
function spot(map: MapId, kind: AmbientSpot, weight: number, points: readonly Point[], roam = 0): Spot {
  const ok = open(map);
  const at = points.filter(([x, y, z]) => [-roam, roam].every((dx) => [-roam, roam].every((dz) => [0, roam / 2].every((dy) => ok([x + dx, y + dy, z + dz])))));
  return { spot: kind, weight, at, roam };
}

/**
 * Perches along the top edges of a solid block: `inset` in from each side, `up` over its top, every `step` metres,
 * kept only where the side faces open sky inside the map (nothing solid just outside it or over that) and the perch
 * itself is free.
 */
function eaves(map: MapId, blocks: readonly Box[], step = 4, up = 0.3, inset = 0.15): Point[] {
  const ok = open(map);
  const { colliders } = MAPS[map].layout();
  const sky = (p: Point) => !colliders.some((c) => p[0] > c.min[0] && p[0] < c.max[0] && p[2] > c.min[2] && p[2] < c.max[2] && c.min[1] >= p[1]);
  const out: Point[] = [];
  for (const b of blocks) {
    const top = b.max[1]!;
    for (const [sx, sz] of SIDES) {
      const along = sx === 0 ? 0 : 2;
      const across = sx === 0 ? 2 : 0;
      const edge = (sx || sz) < 0 ? b.min[across]! : b.max[across]!;
      const a0 = b.min[along]!;
      const a1 = b.max[along]!;
      const n = Math.max(1, Math.floor((a1 - a0 - 1) / step));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((i + 0.5) / n) * (a1 - a0);
        const perch: Point = [0, top + up, 0];
        const below: Point = [0, top - 0.6, 0];
        perch[along] = below[along] = a;
        perch[across] = edge - (sx || sz) * inset;
        below[across] = edge + (sx || sz) * 0.6;
        if (ok(perch) && ok(below) && sky(below)) out.push(perch);
      }
    }
  }
  return out;
}

/** Plaza: birds in the park trees, pigeons and crows on the eaves facing the streets, the bell in the belfry. */
function plaza(): Spot[] {
  const L = plazaLayout();
  const props = new Plan();
  plazaProps(props);
  const trees = props.items.filter((i) => i.el === TREE).map((i): Point => {
    const trunk = TREE.colliders!(i.p as never)[0]!;
    return [(trunk.min[0] + trunk.max[0]) / 2, trunk.max[1] + 1.1, (trunk.min[2] + trunk.max[2]) / 2];
  });
  const masses: Box[] = [
    ...L.blocks.map((b) => ({ min: [b.x0, 0, b.z0], max: [b.x1, b.h, b.z1] })),
    ...L.pieces.filter((q) => (q.kind === 'ceiling' || q.kind === 'roof') && q.max[1] >= 7)
  ];
  const roofs = eaves('plaza', masses);
  const high = eaves('plaza', masses.filter((m) => m.max[1]! >= 10.5), 6);
  const tower = L.pieces.find((q) => q.kind === 'tower')!;
  const [tx, top, tz] = centre(tower);
  const half = [(tower.max[0] - tower.min[0]) / 2, (tower.max[2] - tower.min[2]) / 2];
  const belfry = SIDES.map(([sx, sz]): Point => [tx + sx * (half[0]! + 0.3), top - 1.6, tz + sz * (half[1]! + 0.3)]);
  const ledge = SIDES.map(([sx, sz]): Point => [tx + sx * (half[0]! + 0.2) + sz * 1.2, top + 0.25, tz + sz * (half[1]! + 0.2) + sx * 1.2]);
  return [
    spot('plaza', 'bird', 3, trees, 1),
    spot('plaza', 'bird', 2, roofs, 0.8),
    spot('plaza', 'pigeon', 2, [...roofs, ...ledge], 0.6),
    spot('plaza', 'crow', 1, high, 0.8),
    spot('plaza', 'bell', 0.5, belfry)
  ];
}

/**
 * Fortress: the flags' cloth (FLAGPOLE flies it from the pole top 0.05-1.75 m along +x; the poles are the map's thin
 * upright metal colliders), crows on the curtain tops (FORTRESS_AMBIENCE) and the hall ridges' ends, birds in the orchard.
 */
function fortress(): Spot[] {
  const poles = MAPS.fortress.layout().colliders.filter((c) => c.surface === 'metal' && c.max[0] - c.min[0] <= 0.25 && c.max[2] - c.min[2] <= 0.25 && c.max[1] - c.min[1] >= 3.5);
  const cloth = poles.map((c): Point => [(c.min[0] + c.max[0]) / 2 + 0.9, c.max[1] - 0.6, (c.min[2] + c.max[2]) / 2]);
  const ridges = fortressWorks()
    .roofs.filter((r) => !r.small)
    .flatMap((r): Point[] => {
      const y = r.base + roofHeight('gable', r) + 0.1;
      const alongX = r.face === 'n' || r.face === 's';
      const [cx, cz] = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
      return alongX ? [[r.x0 - 0.15, y, cz], [r.x1 + 0.15, y, cz]] : [[cx, y, r.z0 - 0.15], [cx, y, r.z1 + 0.15]];
    });
  return [
    spot('fortress', 'flag', 3, cloth),
    spot('fortress', 'crow', 1.4, FORTRESS_AMBIENCE.battlements, 1),
    spot('fortress', 'crow', 0.6, ridges, 0.3),
    spot('fortress', 'bird', 2, FORTRESS_AMBIENCE.trees, 1.2)
  ];
}

/** Docks: gulls over the red ship, the quay and the crane; the tyre fenders between the berth and the hull, and on the quay edge; horns on the ships at sea. */
function docks(): Spot[] {
  const q = QUAY.z0;
  const sky: Point[] = [[-18, 9, q + 6], [18, 9, q + 6], [-7, 10, q + 4], [7, 10, q + 4], [-12.8, 7.5, q + 7], [12.8, 7.5, q + 7], [0, 14, q + 6], [0, 11.2, CRANE_Z + 1.8], [-30, 8, q + 7], [30, 8, q + 7]];
  const fenders: Point[] = [[-13, -0.3, BERTH.z1 + 0.2], [-5, -0.3, BERTH.z1 + 0.2], [5, -0.3, BERTH.z1 + 0.2], [13, -0.3, BERTH.z1 + 0.2], [-30, -0.3, QUAY.z1 + 0.2], [30, -0.3, QUAY.z1 + 0.2]];
  return [spot('docks', 'gull', 5, sky, 3), spot('docks', 'creak', 2, fenders), { spot: 'horn', weight: 0.5, at: DOCKS_SHIPS }];
}

/**
 * Temple: jungle calls from the vine-hung spurs and cliff-foot boulders, birds in the rim shrubs, on the drum towers and
 * the village eaves, bamboo at the village fences, the lotus pools' fountains, chimes and a gong at the drum towers,
 * prayer flags on the strings from each drum tower to its court shrine, crows on the hall and gallery eaves.
 */
function temple(): Spot[] {
  const { pieces } = templeGeometry();
  const of = (kind: string, test: (b: Box) => boolean = () => true) => pieces.filter((q) => q.kind === kind && test(q));
  const towers = of('kiosk', (b) => b.max[1]! >= 6);
  const shrines = of('kiosk', (b) => b.max[1]! < 3.5 && Math.abs(b.min[2]! + b.max[2]!) < 1);
  const spurs = of('spur').map((b): Point => {
    const [x, y, z] = centre(b);
    return [x - Math.sign(x) * ((b.max[0]! - b.min[0]!) / 2 - 0.6), y + 0.4, z - Math.sign(z) * ((b.max[2]! - b.min[2]!) / 2 - 0.6)];
  });
  const boulders = of('rock', (b) => b.min[2]! < -T.edge - 1).map((b): Point => [centre(b)[0], b.max[1]! + 0.4, -T.edge - 0.2]);
  const rim = [-28, -16, -4, 8, 20, 32].map((z): Point => [-T.edgeX + 0.8, 0.6, z]);
  const houses = of('house').map((b): Point => [b.min[0]! + 0.15, b.max[1]! + 0.3, (b.min[2]! + b.max[2]!) / 2]);
  const fences = of('fence').map((b): Point => [b.min[0]! - 0.4, 1.6, (b.min[2]! + b.max[2]!) / 2]);
  const cover = new Plan();
  templeCover(cover);
  const pools = cover.items.filter((i) => i.el === LOTUS_POOL).map((i): Point => [(i.p as { x: number }).x, 0.9, (i.p as { z: number }).z]);
  const toward = (b: Box, dx: number, dz: number, y: number): Point => {
    const [x, , z] = centre(b);
    return [x + dx * ((b.max[0]! - b.min[0]!) / 2 + 0.3), y, z + dz * ((b.max[2]! - b.min[2]!) / 2 + 0.3)];
  };
  const inward = (b: Box) => [-Math.sign(centre(b)[0]), -Math.sign(centre(b)[2])] as const;
  const chimes = towers.flatMap((b) => {
    const [dx, dz] = inward(b);
    return [toward(b, dx, 0, b.max[1]! - 0.8), toward(b, 0, dz, b.max[1]! - 0.8)];
  });
  const gongs = towers.map((b) => toward(b, inward(b)[0], 0, b.max[1]! - 2));
  const perches = towers.map((b): Point => [centre(b)[0], b.max[1]! + 0.3, centre(b)[2]]);
  const flags = towers.flatMap((b) => {
    const shrine = shrines.reduce((a, s) => (Math.abs(centre(s)[0] - centre(b)[0]) < Math.abs(centre(a)[0] - centre(b)[0]) ? s : a));
    const a = centre(b);
    const s = centre(shrine);
    const end: Point = [s[0], s[1] + 2, s[2]];
    const sag = Math.hypot(end[0] - a[0], end[2] - a[2]) * 0.06;
    return [0.35, 0.65].map((u): Point => [a[0] + (end[0] - a[0]) * u, a[1] + (end[1] - a[1]) * u - sag * 4 * u * (1 - u) - 0.3, a[2] + (end[2] - a[2]) * u]);
  });
  const roofs = of('roof', (b) => b.max[1]! > 7);
  const crows = [...eaves('temple', roofs, 8), ...perches];
  return [
    spot('temple', 'jungle', 2.5, spurs, 1.2),
    spot('temple', 'jungle', 1.5, boulders),
    spot('temple', 'bird', 0.5, rim, 0.4),
    spot('temple', 'bird', 0.5, houses),
    spot('temple', 'bird', 0.5, perches, 0.8),
    spot('temple', 'bamboo', 2, fences),
    spot('temple', 'water', 1.5, pools, 0.3),
    spot('temple', 'chime', 1, chimes),
    spot('temple', 'flag', 1, flags),
    spot('temple', 'crow', 0.5, crows, 0.8),
    spot('temple', 'gong', 0.4, gongs)
  ];
}

export const BUILD: Record<MapId, () => Spot[]> = { plaza, fortress, docks, temple };
