import { box, doorways, parapet, run, T, type Flight, type Piece } from './temple-layout';

/**
 * The temple core. The great hall runs north-south along the team axis: a 12 m nave with slender columns, an aisle and
 * a gallery each side, the aisles open to the east and west courts through arcades. The east half (x > 0) is built
 * for the whole length and the north end (forecourt, range of halls, camp) for the whole width; the geometry's half
 * turn adds the west half and the south end.
 */
const H = T.high;
const LOW = H - T.slab;
const Z = T.hallZ;
const ZO = Z + 0.8;

/** Column and arcade bays along the hall: piers every 4.8 m, the middle bay facing the statue. */
export const BAYS = [-16.8, -12.0, -7.2, -2.4, 2.4, 7.2, 12.0, 16.8];
/** Hanging boards on this side of the nave: [north end of the bay, distance off the axis] (in from the nave stair). */
const BOARDS: [number, number][] = [[-20.8, 5.0], [-12.0, 5.0], [2.4, 5.0], [12.0, 4.0]];

function hall(p: Piece[], f: Flight[]) {
  // End walls: a door into each aisle, and the nave's door from the gate hall with a spirit screen inside it, so no
  // line runs from a yard down the hall. The screen is taller than anyone on the nave stair can jump.
  for (const s of [-1, 1]) {
    const [z0, z1] = s < 0 ? [-ZO, -Z] : [Z, ZO];
    p.push(...run('hall', true, 0, T.arcade, z0, z1, 0, T.hallTop, [[0, 2.4, 3.36], [7.2, 10.4, 3.2]]));
    p.push(box('screen', 0, 0, s * 20.0, 4.0, 5.2, s * 19.2));
  }
  // The end bays of the arcade are walled: the aisle's door end is seen from the court only through the gate.
  for (const s of [-1, 1]) p.push(box('pier', T.galleryOut, 0, s * 17.2, T.arcade, LOW, s * Z));
  for (const z of BAYS) {
    p.push(box('pier', T.galleryOut, 0, z - (z === -7.2 ? 1.6 : 0.4), T.arcade, LOW, z + 0.4));
    p.push(box('pillar', 6.12, 0, z - 0.28, 6.68, T.hallTop, z + 0.28));
  }
  // The gallery's back wall stands on the arcade; the architrave under the gallery cuts its view into the far aisle.
  p.push(box('wall', T.galleryOut, LOW, -ZO, T.arcade, T.roofTop, ZO));
  p.push(box('lintel', 6.12, 2.64, -Z, 6.68, LOW, Z));
  // Gallery floor over the aisle, open over the aisle stair (north end, rising north along the arcade).
  p.push(box('slab', 6.4, LOW, -Z, T.galleryOut, H, -19.2, { walk: true }));
  p.push(box('slab', 6.4, LOW, -19.2, 10.4, H, Z, { walk: true }));
  p.push(box('slab', 10.4, LOW, -12.8, T.galleryOut, H, Z, { walk: true }));
  f.push({ x: 11.2, z: -12.8, y0: 0, dir: 'n', width: 1.6, steps: 8 });
  p.push(...parapet(false, -19.2, -12.8, 10.0, 10.4, H));
  // Balustrade between the columns; the bay north of the middle is open, a drop back to the nave.
  const rail = (a: number, b: number) => p.push(box('parapet', 6.4, H, a, T.col, H + T.parapet, b));
  rail(-Z, BAYS[0]! - 0.28);
  for (let k = 0; k + 1 < BAYS.length; k++) if (BAYS[k] !== -7.2) rail(BAYS[k] === 12.0 ? 13.6 : BAYS[k]! + 0.28, BAYS[k + 1]! - 0.28);
  rail(BAYS[BAYS.length - 1]! + 0.28, Z);
  // The nave stair climbs north along the columns from the south end to the gallery, in the open; its high end
  // stands in the column line, so no line crosses the hall past it.
  f.push({ x: 5.2, z: 20.0, y0: 0, dir: 'n', width: 1.6, steps: 8 });
  p.push(box('slab', 4.4, LOW, 12.8, 6.4, H, 13.6, { walk: true }));
  p.push(box('roof', 6.0, T.roofTop, -ZO - 0.2, T.arcade + 0.4, T.roofTop + 0.48, ZO + 0.2));
  p.push(box('roof', 0, T.hallTop, -ZO - 0.2, 6.8, T.hallTop + 0.48, ZO + 0.2));
  doorways.push([8.4, H, -14.4], [8.4, H, 0], [8.4, H, 14.4], [5.6, H, 13.2], [9.0, H, -20.0]);
}

/**
 * Nave furniture on the axis: the great statue at the centre and a bronze burner 8 m either side. A line from one
 * arcade bay through the other crosses the axis behind one of them; the 40 m lines beside them stay open.
 */
function nave(p: Piece[]) {
  p.push(box('dais', 0, 0, -3.6, 3.6, 0.48, 3.6));
  p.push(box('statue', 0, 0.48, -2.8, 2.8, 4.8, 2.8));
  p.push(box('burner', -1.2, 0, -10.4, 1.2, 3.2, -7.2));
  p.push(box('stele', -1.2, 0, -6.4, 1.2, 3.2, -4.0));
  // Painted boards hung from the roof beams over every other bay on this side of the nave (the half turn hangs the
  // other side's over the bays between): a gallery sees the far side of the nave only through the bays left open.
  for (const [z, x] of BOARDS) p.push(box('banner', x - 0.06, 3.2, z + 0.4, x + 0.06, 6.4, z + 4.4));
}

/** East court: cloister walls with a gate at each end and two to the strip, a screen inside each gate, cover. */
function court(p: Piece[]) {
  const top = T.courtWall;
  p.push(...run('cloister', true, T.arcade, T.courtOut, -ZO, -Z, 0, top, [[20.8, 24.0, 2.88]]));
  p.push(...run('cloister', true, T.arcade, T.courtOut, Z, ZO, 0, top, [[14.4, 17.6, 2.88]]));
  p.push(...run('cloister', false, -ZO, ZO, T.court, T.courtOut, 0, top, [[-12.8, -9.6, 2.88], [-1.6, 1.6, 2.88], [6.4, 9.6, 2.88]]));
  p.push(box('screen', 19.2, 0, -18.4, T.court, 2.88, -17.6));
  p.push(box('screen', T.arcade, 0, 17.6, 18.4, 2.88, 18.4));
  p.push(box('screen', 22.4, 0, -14.4, 23.2, 2.88, -8.0));
  p.push(box('screen', 22.4, 0, 4.8, 23.2, 2.88, 11.2));
  p.push(box('screen', 22.4, 0, -3.2, 23.2, 2.88, 3.2));
  // A shrine pavilion at the middle. It stays solid: any opening through it, even a passage along the court, reopens
  // the diagonals from the aisle door through the court gate to the far strip (up to 67 m).
  p.push(box('kiosk', 17.6, 0, -2.4, 21.6, 3.2, 2.4));
}

/**
 * The north end: an open terrace yard either side of the gate hall, from the hall's end wall back to the camp under
 * the cliff, with cover in clusters. The gate hall runs from the spirit screen to the nave's door, its doors into the
 * yards staggered so no line runs across the end.
 */
function northEnd(p: Piece[]) {
  const top = T.rangeTop;
  const g0 = -T.gate;
  p.push(...run('hall', false, g0, -T.row, -3.2, -2.4, 0, top, [[-36.0, -33.6, 3.2], [-28.0, -25.6, 3.2]]));
  p.push(...run('hall', false, g0, -T.row, 2.4, 3.2, 0, top, [[-32.0, -29.6, 3.2]]));
  p.push(box('roof', -3.2, top, g0, 3.2, top + 0.48, -T.row));
  // A porch before each aisle door: a guardian plinth across it and a wing to the court wall, open only toward the
  // gate hall, so the aisle's lines end in the porch.
  for (const s of [-1, 1]) {
    p.push(box('statue', s * 6.0, 0, -25.9, s * T.arcade, 2.88, -24.3));
    p.push(box('cloister', s * T.arcade, 0, -24.3, s * (T.arcade + 0.8), T.courtWall, -T.row));
  }
  p.push(box('burner', 12.0, 0, -32.0, 14.4, 3.2, -28.8));
  p.push(box('burner', -16.0, 0, -29.6, -13.6, 3.2, -25.6));
  // East yard: a stele and a supply stack; west yard: a stele further back and a stack (pools and urns: cover.ts).
  p.push(box('stele', 18.4, 0, -30.4, 20.8, 3.2, -28.0));
  p.push(box('stele', -21.6, 0, -33.6, -19.2, 3.2, -31.2));
  p.push(box('stack', -15.2, 0, -36.8, -12.8, 1.6, -34.4));
  p.push(box('stack', 12.8, 0, -36.8, 15.2, 1.6, -34.4));
  // Spirit screen closing the gate hall and the waterfall grotto behind it: the camp has no line from end to end.
  p.push(box('screen', -4.0, 0, -37.6, 4.0, 2.88, g0));
  p.push(box('kiosk', -2.4, 0, -T.edge, 2.4, 4.0, -37.6));
}

/** The east half of the hall and court, and the north end; the geometry's half turn completes the core. */
export function templeCore(p: Piece[], f: Flight[]) {
  hall(p, f);
  nave(p);
  court(p);
  northEnd(p);
}
