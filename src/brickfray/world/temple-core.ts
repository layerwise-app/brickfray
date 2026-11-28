import { balustrade, box, doorways, run, T, type Flight, type Piece } from './temple-layout';
import { STATUE_PLINTH } from './temple-art';
import type { Vec3 } from './util';

/**
 * The great hall at the centre, west half (the geometry mirrors it). It lies across the processional way: a 12 m nave
 * between two rows of columns, an aisle with a gallery over it each side, open to its lotus court through two arcade
 * bays, and an end vestibule at each end whose side doors open onto the porch yards round the hall's ends.
 */
const H = T.high;
const LOW = H - T.slab;
const Z = T.hallZ;
const ZO = T.row;
const A = T.arcade;
const GO = T.galleryOut;

/** Column centres along the hall (z). */
export const BAYS = [-9.6, -4.8, 0, 4.8, 9.6];
/** Arcade openings from the aisle to the court (|z| from..to). */
export const ARCADE_OPEN: [number, number] = [1.6, 6.4];

function hall(p: Piece[], f: Flight[], c: Piece[]) {
  c.push(box('roof', -6.8, T.hallTop, -ZO - 0.4, 6.8, T.hallTop + 0.48, ZO + 0.4));
  for (const s of [-1, 1]) {
    // End wall with the nave door into the vestibule.
    const [z0, z1] = s < 0 ? [-ZO, -Z] : [Z, ZO];
    p.push(...run('hall', true, -A, 0, z0, z1, 0, T.hallTop, [[-2.4, 0, 3.36]]));
    // Arcade wall: solid beside the gallery stairs, two bays open onto the court with a pier between them.
    const [o0, o1] = ARCADE_OPEN;
    p.push(box('pier', -A, 0, s * o1, -GO, LOW, s * Z));
    doorways.push([-A - 1.0, 0, s * (o0 + o1) / 2], [-GO + 1.0, 0, s * (o0 + o1) / 2]);
    // Gallery stair along the arcade wall, rising toward the end wall; the corner past its top step is filled.
    f.push({ x: -11.2, z: s * 4.8, y0: 0, dir: s < 0 ? 'n' : 's', width: 1.6, steps: 8 });
    p.push(box('pier', -GO, 0, s * 11.2, -10.4, LOW, s * Z));
  }
  p.push(box('pier', -A, 0, -ARCADE_OPEN[0], -GO, LOW, ARCADE_OPEN[0]));
  for (const z of BAYS) p.push(box('pillar', -6.68, 0, z - 0.28, -6.12, T.hallTop, z + 0.28));
  // Architrave over the column row under the gallery's edge, the gallery's back wall on the arcade, the gallery floor.
  p.push(box('lintel', -6.68, 2.64, -Z, -6.12, LOW, Z));
  p.push(box('wall', -A, LOW, -ZO, -GO, T.roofTop, ZO));
  p.push(box('slab', -GO, LOW, -4.8, -6.4, H, 4.8, { walk: true }));
  for (const s of [-1, 1]) {
    p.push(box('slab', -10.4, LOW, s * 4.8, -6.4, H, s * 11.2, { walk: true }));
    p.push(box('slab', -GO, LOW, s * 11.2, -6.4, H, s * Z, { walk: true }));
  }
  // Sutra cabinets along the gallery's back wall between the stair wells, too close under the roof to stand on.
  p.push(box('wall', -GO, H, -4.8, -9.6, H + 2.4, 4.8, { tag: 'cabinet' }));
  // A solid balustrade along the nave edge of the gallery: waist-high cover for whoever holds it.
  p.push(...balustrade(-6.8, -Z, -6.4, Z, H, 'gallery'));
  p.push(box('roof', -T.arcade - 0.4, T.roofTop, -ZO - 0.4, -6.0, T.roofTop + 0.48, ZO + 0.4));
  doorways.push([-9.2, H, 0], [-8.4, H, -12.0], [-8.4, H, 12.0]);
}

/**
 * The altar on the axis: the jade statue on its dais and a bronze burner each side of it. No line runs from one court
 * through both arcades: every such line crosses the axis inside the altar.
 */
function altar(c: Piece[]) {
  c.push(box('dais', -3.6, 0, -3.6, 3.6, 0.48, 3.6));
  // Collision follows the drawn shapes (temple-art greatStatue and burner) so shots pass where they look open.
  const y = 0.48;
  const f = y + STATUE_PLINTH;
  const statue: [Vec3, Vec3][] = [
    [[-2.8, y, -2.8], [2.8, f + 0.4, 2.8]],
    [[-1.85, f + 0.4, -1.85], [1.85, f + 0.9, 1.85]],
    [[-2.58, f + 0.4, -1], [2.58, f + 0.9, 1]],
    [[-1, f + 0.4, -2.58], [1, f + 0.9, 2.58]],
    [[-2.4, f + 0.9, -1.5], [2.4, f + 1.7, 1.9]],
    [[-1.95, f + 1.7, -1], [1.95, f + 3.2, 1]],
    [[-0.65, f + 3.2, -0.65], [0.65, f + 4.9, 0.65]],
    [[-1.5, f + 2.1, -0.62], [1.5, f + 5.1, -0.38]]
  ];
  c.push({ ...box('statue', -2.8, y, -2.8, 2.8, f + 5.1, 2.8), solid: statue });
  for (const s of [-1, 1]) {
    const [z0, z1] = s < 0 ? [-6.8, -2.8] : [2.8, 6.8];
    const zc = (z0 + z1) / 2;
    const legs: [Vec3, Vec3][] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): [Vec3, Vec3] => {
      const [lx, lz] = [sx * 0.8, zc + sz * 1.6];
      return [[lx - 0.18, 0.3, lz - 0.18], [lx + 0.18, 1.0, lz + 0.18]];
    }));
    const solid: [Vec3, Vec3][] = [[[-1.2, 0, z0], [1.2, 0.3, z1]], ...legs, [[-1.15, 1.0, z0 + 0.05], [1.15, 2.24, z1 - 0.05]], [[-1.2, 2.8, z0], [1.2, 3.2, z1]]];
    c.push({ ...box('burner', -1.2, 0, z0, 1.2, 3.2, z1), solid });
  }
}

/** The end vestibules: side doors onto the porch yards, the nave door, the outer wall against the rock and the pagoda. */
function vestibules(p: Piece[], c: Piece[]) {
  for (const s of [-1, 1]) {
    const [a0, a1] = s < 0 ? [-T.gate, -ZO] : [ZO, T.gate];
    const door: [number, number, number] = s < 0 ? [-16.6, -ZO, 3.2] : [ZO, 16.6, 3.2];
    p.push(...run('hall', false, a0, a1, -3.2, -2.4, 0, T.rangeTop, [door]));
    c.push(box('hall', -3.2, 0, s < 0 ? -T.gate : T.gate - 0.8, 3.2, T.rangeTop, s < 0 ? -T.gate + 0.8 : T.gate));
    c.push(box('roof', -3.6, T.rangeTop, a0, 3.6, T.rangeTop + 0.48, a1));
  }
}

/** West half of the hall into `p` and `f` (mirrored by the geometry); the pieces across the axis into `c`. */
export function templeCore(p: Piece[], f: Flight[], c: Piece[]) {
  hall(p, f, c);
  altar(c);
  vestibules(p, c);
}
