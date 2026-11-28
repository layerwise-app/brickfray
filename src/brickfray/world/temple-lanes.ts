import { balustrade, BAND, box, BRIDGE, CAMP, COURT, doorways, RAVINE, ROAD, run, T, type Flight, type Piece } from './temple-layout';

/**
 * The west half outside the great hall (the geometry mirrors it east). Between the camp and the lotus court the guest
 * hall (north) and the refectory (south) flank the processional way; the sutra library and the ravine head close the
 * court from the gorge path, the village houses and the pagoda close it from the village street. Each block leaves one
 * bent way through: the sutra passage (north) and the village lane (south).
 */
const N = BAND.north;
const NM = BAND.midN;
const SM = BAND.midS;
const S = BAND.south;
const X = T.edgeX;
const Z = T.edge;
const W = COURT.wall;
const C = COURT.x1;
const STOREY = 5.6;

/**
 * The sutra passage (from the gorge path's mouth past the guest hall) and the village lane (from the street's mouth past
 * the refectory) down to the forecourt: [x0, x1, z0, z1]. They are 8 m apart in x so no line runs from one into the other.
 */
export const SUTRA = [-48.0, -44.0, N, -ROAD] as const;
export const VLANE = [-40.0, -36.0, ROAD, S] as const;
/** Raised places: the bell pavilion's platform over the gorge path, the village balcony over the street. */
export const PAVILION = { x0: -29.6, x1: -17.6, z0: -33.6, z1: N, floor: 3.36 } as const;
export const BALCONY = { x0: -27.2, x1: -12.8, z0: S, z1: 32.0, floor: 3.36 } as const;

function blocks(p: Piece[]) {
  const roofed = (kind: 'hall' | 'house', x0: number, z0: number, x1: number, z1: number, h: number, tag: string) => {
    p.push(box(kind, x0, 0, z0, x1, h, z1, { tag }));
    p.push(box('roof', x0 - 0.4, h, z0 - 0.4, x1 + 0.4, h + 0.48, z1 + 0.4, { tag }));
  };
  // Guest hall and refectory between the camp and the court, each split by its team's passage; the Mountain Gate,
  // kept shut, closes the forecourt from the camp. Its gatehouse and the camp storehouse overlap across the camp so the
  // way between its yards bends and no line runs along the camp from the gorge path into the village street.
  roofed('hall', -CAMP, N, SUTRA[0], -ROAD, STOREY, 'guest');
  roofed('hall', SUTRA[1], N, -W, -ROAD, STOREY, 'guest');
  roofed('hall', -CAMP, ROAD, VLANE[0], S, STOREY, 'refectory');
  roofed('hall', -CAMP, -ROAD, -48.8, ROAD, STOREY, 'gate');
  roofed('hall', -59.2, 2.0, -CAMP, ROAD, STOREY, 'gate');
  roofed('hall', -X, -ROAD, -57.6, -2.0, STOREY, 'gate');
  doorways.push([(SUTRA[0] + SUTRA[1]) / 2, 0, -ROAD + 1], [(VLANE[0] + VLANE[1]) / 2, 0, ROAD - 1]);
  // The court's west wall: its gate from the forecourt, then the wall between the village lane and the court.
  p.push(...run('cloister', false, -ROAD, ROAD, -W, -C, 0, 3.2, [[-4.0, 4.0, 3.2]]));
  p.push(box('cloister', VLANE[1], 0, ROAD, -W, 3.2, SM));
  // Sutra library between the gorge path and the court.
  roofed('hall', -W, N, -12.8, NM, STOREY, 'library');
  // Ravine head: the rock the waterfall leaves, behind the bridge, round the north vestibule.
  p.push(box('cliff', -12.8, 0, N, 0, 8.0, -T.gate, { tag: 'head' }));
  p.push(box('cliff', -12.8, 0, -T.gate, -3.2, 8.0, NM, { tag: 'head' }));
  // Village houses between the court and the street, back to back: one row fronts the court, the other the street.
  roofed('house', VLANE[1], SM, -12.8, 23.2, 6.4, 'court');
  roofed('house', VLANE[1], 23.2, -12.8, S, STOREY, 'village');
  roofed('hall', -12.8, T.gate, 0, S, 6.4, 'pagoda');
  roofed('hall', -12.8, SM, -3.2, T.gate, 6.4, 'pagoda');
  // Gorge spur: the rim rock standing out over the gorge path's mouth, so the path bends past it.
  p.push(box('spur', -CAMP, 0, -Z, -44.0, 4.8, -36.8, { tag: 'spur' }));
  // River houses on the street's south side by its mouth, standing out into it; the ghat east of them.
  roofed('house', -48.8, 36.8, -41.6, Z, STOREY, 'river');
  roofed('house', -41.6, 36.8, -33.6, Z, STOREY, 'river');
}

function raised(p: Piece[], f: Flight[]) {
  // Bell pavilion: a platform on the library's face over the gorge path, a stair up each end along the wall.
  const v = PAVILION;
  p.push(box('hall', v.x0, 0, v.z0, v.x1, v.floor, v.z1, { walk: true, tag: 'pavilion' }));
  p.push(...balustrade(v.x0, v.z0, v.x1, v.z0 + 0.4, v.floor, 'pavilion'));
  f.push({ x: v.x0 - 7 * T.run, z: v.z1 - 0.8, y0: 0, dir: 'e', width: 1.6, steps: 7 });
  f.push({ x: v.x1 + 7 * T.run, z: v.z1 - 0.8, y0: 0, dir: 'w', width: 1.6, steps: 7 });
  // Village balcony: a timber gallery on the houses' street front, a stair up each end along the front.
  const b = BALCONY;
  p.push(box('deck', b.x0, b.floor - 0.48, b.z0, b.x1, b.floor, b.z1, { walk: true, surface: 'wood', tag: 'balcony' }));
  p.push(...balustrade(b.x0, b.z1 - 0.4, b.x1, b.z1, b.floor, 'balcony'));
  f.push({ x: b.x0 - 7 * T.run, z: b.z0 + 0.8, y0: 0, dir: 'e', width: 1.6, steps: 7 });
  f.push({ x: b.x1 + 7 * T.run, z: b.z0 + 0.8, y0: 0, dir: 'w', width: 1.6, steps: 7 });
}

/** The ravine under the bridge, the gorge rail (north), the river rail (south) and the camp cliff (west). */
function edges(p: Piece[], c: Piece[]) {
  const RH = 1.36;
  p.push(box('rail', -X, 0, -Z - 0.4, -RAVINE, RH, -Z));
  p.push(box('rail', -RAVINE - 0.4, 0, -Z, -RAVINE, RH, BRIDGE.z0));
  p.push(box('rail', -RAVINE - 0.4, 0, BRIDGE.z1, -RAVINE, RH, N));
  c.push(box('deck', -RAVINE, -0.48, BRIDGE.z0, RAVINE, 0, BRIDGE.z1, { walk: true, tag: 'bridge' }));
  c.push(box('rail', -RAVINE, 0, BRIDGE.z0, RAVINE, RH, BRIDGE.z0 + 0.4, { tag: 'bridge' }));
  c.push(box('rail', -RAVINE, 0, BRIDGE.z1 - 0.4, RAVINE, RH, BRIDGE.z1, { tag: 'bridge' }));
  // A stone shrine at the bridge's middle splits the deck in two ways over: nothing sees down the whole gorge path.
  c.push(box('kiosk', -1.6, 0, -40.0, 1.6, 3.2, -36.8));
  // The pagoda's porch out over the street at the ghat: the street passes south of it, the line along it is broken.
  c.push(box('hall', -2.4, 0, S, 2.4, 4.0, 37.6, { tag: 'porch' }), box('roof', -2.8, 4.0, S, 2.8, 4.48, 38.0, { tag: 'porch' }));
  // River rail between the river houses.
  for (const [x0, x1] of [[-X, -48.8], [-33.6, 0]] as const) p.push(box('rail', x0, 0, Z, x1, RH, Z + 0.4));
  // Camp terrace edge: a rail over the drop to the waterfall pool (west) or the paddies (east), the cliff far behind.
  p.push(box('rail', -X - 0.4, 0, -Z, -X, RH, Z, { tag: 'camp' }));
}

export function templeLanes(p: Piece[], f: Flight[], c: Piece[]) {
  blocks(p);
  raised(p, f);
  edges(p, c);
}
