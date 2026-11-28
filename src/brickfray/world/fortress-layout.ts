import { centreCover, eastCover, westCover } from './fortress-cover';
import { F, type Kind, type Works } from './fortress-plan';

const H = F.curtain;
const { keep: K } = F;

/**
 * The gatehouses (|x|) and their passages (|z|); the gate room's floor and roof; the yard in front (|x| from `yard` to
 * the gatehouse, |z| < `tower`) and the alleys (|x| from `alley`) that reach it from the lane mouths.
 */
export const GATE = { x0: -36.8, x1: -28.8, half: 2.8, room: 8.0, tower: 10.4, front: -46.4, alley: -44.8, door: 1.6, traverse: 5.6, floor: F.storey, top: 7.2 } as const;
/** Hay loft over the stables on the west crag street; the rock ledge on the east one (x, z, the stairs' outer ends). */
export const LOFT = { x0: -28.8, x1: -17.6, z0: -F.edge, z1: -40.0, stairW: -32.8, stairE: -13.6 } as const;
/** Mill on the river path: its body, the gallery's front and its stairs' outer end (x). */
export const MILL = { half: 7.2, body: 32.8, front: 35.2, stair: -12.8, race: 3.2 } as const;
/** The knoll at the ruin (|x| < half, z < south); the east river path's quay (x) and the cove it overlooks. */
export const KNOLL = { half: 10.4, south: -35.2 } as const;
/** The ruin on the knoll (z): the paths round it are 4.0 m (north) and 4.8 m (south, down to the chapel) wide. */
export const RUIN = { z0: -40.8, z1: -35.2 } as const;
export const QUAY = { x0: 12.8, x1: 40.0, cove0: 16.0, cove1: 36.0, coveZ: 41.6 } as const;

const ROOF = { slate: '#5f6670', clay: '#9a4a2a', thatch: '#c9a650', shingle: '#7d5a46' } as const;

/** Every structure of the map: each half built on its own (they share route lengths, not shapes), then the centre. */
export function layout(w: Works) {
  gatehouse(w, -1);
  gatehouse(w, 1);
  west(w);
  east(w);
  edges(w);
  westCover(w);
  eastCover(w);
  centre(w);
  centreCover(w);
}

/**
 * A gatehouse in the curtain at side s (-1 west, 1 east): a 5.6 m passage under the gate room into the bailey. Its yard
 * is shut off from the camp by the barbican's front (one gate, a low traverse behind it) and opens on the outer ward's
 * alleys to the two lane mouths. Two
 * stairs climb from the bailey along the curtain to landings at the room's end doors; the room looks over its own
 * bailey through two narrow windows. The west one is whole; the east one lost its roof and wall tops in the siege.
 */
function gatehouse(w: Works, s: -1 | 1) {
  const { half, room, tower, floor, top } = GATE;
  const X = (v: number) => s * Math.abs(v);
  const xs = (a: number, b: number): [number, number] => [Math.min(X(a), X(b)), Math.max(X(a), X(b))];
  const broken = s > 0;
  const shell: Kind = broken ? 'rubble' : 'tower';
  const [ox0, ox1] = xs(GATE.x0, GATE.x1);
  for (const z of [-1, 1]) {
    const [za, zb] = [z * half, z * room].sort((a, b) => a - b) as [number, number];
    w.box(shell, ox0, 0, za, ox1, floor, zb, { walk: true });
    // The stair climbs from the bailey along the curtain's inner face to a landing at the room's end door; a pier beside
    // the landing and a wall on the stair's bailey side keep it a way up, not a gallery over the bailey.
    const [sx0, sx1] = xs(35.2, 33.6);
    w.stairs({ x: (sx0 + sx1) / 2, z: z * (room + 1.6 + 8 * F.run), y0: 0, dir: z < 0 ? 's' : 'n', width: 1.6, steps: 8 });
    w.box('block', sx0, 0, Math.min(z * room, z * (room + 1.6)), sx1, floor, Math.max(z * room, z * (room + 1.6)), { walk: true });
    const [px0, px1] = xs(33.6, GATE.x1);
    w.box(shell, px0, 0, Math.min(z * room, z * (room + 1.6)), px1, 5.6, Math.max(z * room, z * (room + 1.6)));
    const [gx0, gx1] = xs(33.6, 32.8);
    w.box('wall', gx0, 0, Math.min(z * (room + 1.6), z * (room + 4.8)), gx1, floor + 1.9, Math.max(z * (room + 1.6), z * (room + 4.8)));
    // A parapet down to the stair's foot leaves no slot between the guard wall and the stair's side.
    w.box('wall', gx0, 0, Math.min(z * (room + 4.8), z * (room + 1.6 + 8 * F.run)), gx1, 1.6, Math.max(z * (room + 4.8), z * (room + 1.6 + 8 * F.run)));
  }
  w.box('slab', ox0, floor - F.slab, -half, ox1, floor, half);
  // The barbican's front shuts the yard off from the camp: west a crowned stone wall, east a plank palisade.
  // Its gate from the camp opens on a low traverse, so the way in doglegs.
  const [fx0, fx1] = xs(48.0, Math.abs(GATE.front));
  w.run(broken ? 'timber' : 'curtain', false, -tower, tower, fx0, fx1, 0, broken ? 4.8 : H, [[-GATE.door, GATE.door, 3.36]]);
  const [tx0, tx1] = xs(41.6, 40.8);
  if (broken) w.box('paling', tx0, 0, -GATE.traverse, tx1, 1.6, GATE.traverse);
  else lowWall(w, 'wall', tx0, tx1, -GATE.traverse, GATE.traverse);
  // Room: camp wall, end walls with the landing doors, the bailey wall with two narrow windows.
  const wallTop = broken ? floor + 2.4 : top - F.slab;
  const [cw0, cw1] = xs(36.8, 36.0);
  w.box('wall', cw0, floor, -room, cw1, wallTop, room);
  const [ix0, ix1] = xs(36.0, GATE.x1);
  const [dx0, dx1] = xs(35.2, 33.6);
  for (const z of [-1, 1]) w.run('wall', true, ix0, ix1, Math.min(z * room, z * (room - 0.8)), Math.max(z * room, z * (room - 0.8)), floor, wallTop, [[dx0, dx1, floor + 2.4]]);
  const [bw0, bw1] = xs(29.6, GATE.x1);
  w.windows('wall', false, -(room - 0.8), room - 0.8, bw0, bw1, floor, wallTop, [[-4.4, -3.2, floor + 1.0, floor + 2.2], [3.2, 4.4, floor + 1.0, floor + 2.2]]);
  if (!broken) w.box('slab', ox0, top - F.slab, -room, ox1, top, room);
  else {
    // Ragged tops: courses left standing over the line of the wall, never low enough to see over.
    for (const [a, b, h] of [[-8.0, -4.8, 1.2], [-1.6, 1.6, 0.8], [4.8, 8.0, 1.6]] as const) w.box('rubble', bw0, wallTop, a, bw1, wallTop + h, b);
    for (const [a, b, h] of [[-3.2, 0.0, 1.0], [3.2, 6.4, 0.6]] as const) w.box('rubble', cw0, wallTop, a, cw1, wallTop + h, b);
  }
  w.seed(X(32.8), floor, 0);
  // Waypoints at the stairs' feet beside the curtain and the guard walls.
  for (const z of [-1, 1]) for (const a of [17.6, 20.0]) w.seed(X(34.4), 0, z * a);
}

/** West half: the town square camp, the barn and granary, the hall range with the hay loft, the smithy, the boathouse. */
function west(w: Works) {
  // The town's backs and corner houses close the square; the moat wall shows between them.
  for (const s of [-1, 1] as const) {
    const lo = (a: number, b: number) => Math.min(s * a, s * b);
    const hi = (a: number, b: number) => Math.max(s * a, s * b);
    w.shed('timber', -F.edgeX, lo(30.4, 16.0), -58.4, hi(30.4, 16.0), 5.6, s < 0 ? ROOF.shingle : ROOF.clay, 'house');
    w.box('timber', -F.edgeX, 0, lo(F.edge, 38.4), -56.0, 5.6, hi(F.edge, 38.4), { tag: 'house' });
    w.roof({ x0: -F.edgeX, z0: lo(F.edge, 38.4), x1: -56.0, z1: hi(F.edge, 38.4), base: 5.6, face: 'e', color: s < 0 ? ROOF.shingle : ROOF.clay, wall: '#e8d9b0', small: true });
    w.blind('timber', false, -58.4, 1, [[s * 22.4 - 0.8, s * 22.4 + 0.8, 0, 2.4], [s * 18.4 - 0.6, s * 18.4 + 0.6, 1.2, 2.4], [s * 27.2 - 0.6, s * 27.2 + 0.6, 1.2, 2.4]]);
  }
  // The square's low wall along the alleys: you see over it into the outer ward, you go round by the lane mouths.
  // North of the gate the town wall stands full height: the hay loft must not look into the square's north yard.
  w.box('wall', -48.0, 0, -30.4, -47.2, 4.8, -GATE.tower, { tag: 'town-wall' });
  lowWall(w, 'wall', -48.0, -47.2, GATE.tower, 30.4);
  // Curtain either side of the gatehouse, corner towers jutting into the lanes.
  w.box('curtain', -36.8, 0, -30.4, -35.2, H, -GATE.room);
  w.box('curtain', -36.8, 0, GATE.room, -35.2, H, 30.4);
  w.box('tower', -38.4, 0, -33.6, -32.8, 8.0, -27.2, { tag: 'corner' });
  w.box('tower', -38.4, 0, 27.2, -32.8, 8.0, 33.6, { tag: 'corner' });
  // Great hall: its north wall is the crag street's front (windows high, a porch with a door), its south the court's.
  range(w, -35.2, -4.0, -30.4, F.rangeN, 5.6, [-14.4, -8.8], 1, ROOF.slate, 'great-hall');
  w.shed('hall', -20.0, -32.8, -14.4, -30.4, 4.0, ROOF.slate, 'porch');
  w.blind('hall', true, -32.8, -1, [[-18.4, -16.0, 0, 2.88]]);
  w.blind('hall', true, -30.4, -1, [[-30.4, -28.8, 2.4, 4.4], [-26.4, -24.8, 2.4, 4.4], [-7.2, -5.6, 2.4, 4.4]]);
  w.shed('hall', -27.2, F.rangeN, -23.2, -20.0, 3.2, ROOF.slate, 'porch');
  w.blind('hall', true, -20.0, 1, [[-26.0, -24.4, 0, 2.6]]);
  w.blind('hall', true, F.rangeN, 1, [[-32.0, -30.4, 2.0, 4.0], [-20.0, -18.4, 2.0, 4.0], [-17.6, -16.0, 0, 2.88], [-7.2, -5.6, 2.0, 4.0]]);
  // Smithy: the river path's front with the forge shed, the court's front with doors.
  range(w, -24.0, -7.2, F.rangeS, 30.4, 4.8, [-18.4, -13.6], -1, ROOF.clay, 'smithy');
  // The smithy's yard opens the bailey's south-west corner: a low wall on the river side, the river path sees in.
  lowWall(w, 'wall', -32.8, -24.0, 29.6, 30.4);
  w.box('hall', -35.2, 0, 27.2, -32.8, 4.0, 30.4, { tag: 'smithy' });
  w.shed('timber', -24.0, 30.4, -19.2, 32.8, 3.2, ROOF.shingle, 'forge-shed');
  w.blind('hall', true, 30.4, 1, [[-12.0, -10.4, 0, 2.6]]);
  w.blind('hall', true, F.rangeS, -1, [[-22.4, -20.8, 0, 2.6], [-11.2, -9.6, 0, 2.6]]);
  // The forge in the bailey stops the line from the gate to the keep and splits the bailey north from south.
  w.box('hall', -21.6, 0, -3.2, -16.8, 4.8, 3.2, { tag: 'forge' });
  w.roof({ x0: -21.6, z0: -3.2, x1: -16.8, z1: 3.2, base: 4.8, face: 'e', color: ROOF.slate, wall: '#d3ccbb', small: true });
  w.blind('hall', false, -21.6, -1, [[-0.8, 0.8, 0, 2.6]]);
  loft(w, 'timber');
  // Boathouse on the bank: the path bends in round it.
  w.box('timber', -36.8, 0, 40.8, -28.8, 4.8, F.edge, { tag: 'boathouse' });
  w.roof({ x0: -36.8, z0: 40.8, x1: -28.8, z1: F.edge, base: 4.8, face: 's', color: ROOF.shingle, wall: '#9a6a3f', small: true });
  w.blind('timber', true, 40.8, -1, [[-34.0, -31.6, 0, 3.0]]);
  for (const x of [-35.2, -30.4]) w.seed(x, 0, 39.6);
  // The crag street climbs from the square onto its terrace, and from the outer ward's alley.
  w.stairs({ x: -42.8, z: -28.8, y0: 0, dir: 'n', width: 8.8, steps: 2 });
  w.stairs({ x: -48.0, z: (-F.edge - 30.4) / 2, y0: 0, dir: 'e', width: F.edge - 30.4, steps: 2 });
}

/** The west hay loft (timber) or the east rock ledge (bank): a floor at loft height over the crag street, stairs at both ends. */
function loft(w: Works, kind: 'timber' | 'bank') {
  const s = kind === 'timber' ? -1 : 1;
  const X = (v: number) => s * Math.abs(v);
  const [x0, x1] = [Math.min(X(LOFT.x0), X(LOFT.x1)), Math.max(X(LOFT.x0), X(LOFT.x1))];
  const { z0, z1 } = LOFT;
  const y = F.loft;
  const roofAt = y + 2.88;
  w.box(kind, x0, 0, z0, x1, y, z1, { walk: true, tag: kind === 'timber' ? 'stables' : 'ledge' });
  w.box(kind, x0, y, z0, x1, roofAt, z0 + 0.8);
  for (const [a, b] of [[x0, x0 + 0.8], [x1 - 0.8, x1]] as const) w.run(kind, false, z0 + 0.8, z1, a, b, y, roofAt, [[-42.4, -40.8, y + 2.4]]);
  w.box('parapet', x0 + 0.8, y, z1 - 0.8, x1 - 0.8, y + 1.0, z1);
  w.box('rail', x0 + 0.8, y + 1.0, z1 - 0.8, x1 - 0.8, y + 1.6, z1, { bulletsPass: true });
  if (kind === 'timber') w.roof({ x0, z0, x1, z1, base: roofAt, face: 's', color: ROOF.thatch, wall: '#9a6a3f', small: true });
  else w.box('bank', x0 - 0.8, roofAt, z0, x1 + 0.8, roofAt + 1.6, z0 + 1.6, { tag: 'crag-cap' });
  const [sw, se] = [Math.min(X(LOFT.stairW), X(LOFT.stairE)), Math.max(X(LOFT.stairW), X(LOFT.stairE))];
  w.stairs({ x: sw, z: -41.6, y0: F.street, dir: 'e', width: 1.6, steps: 5, wood: kind === 'timber' });
  w.stairs({ x: se, z: -41.6, y0: F.street, dir: 'w', width: 1.6, steps: 5, wood: kind === 'timber' });
  // Lean-tos (west) or rock (east) behind the stairs, so nobody hides between a stair and the field wall.
  for (const [a, b] of [[sw, x0], [x1, kind === 'bank' ? 36.8 : se]] as const) {
    if (kind === 'timber') w.shed('timber', a, z0, b, -42.4, 4.8, ROOF.shingle, 'leanto');
    else w.box('bank', a, 0, z0, b, 4.8, -42.4, { tag: 'rock' });
  }
}

/**
 * East half: the farmyard camp, the breached gatehouse in its siege yard, the solar range standing back from a wider
 * crag street with the rock ledge and an outcrop, the brewhouse behind a raised quay over the river cove.
 */
function east(w: Works) {
  // Farm: the big barn closes the north-east corner, the cowshed the south-east; a paddock fence along the back.
  w.box('timber', 54.4, 0, -F.edge, F.edgeX, 6.4, -30.4, { tag: 'farm-barn' });
  w.roof({ x0: 54.4, z0: -F.edge, x1: F.edgeX, z1: -30.4, base: 6.4, face: 'e', color: ROOF.thatch, wall: '#9a6a3f', small: true });
  w.blind('timber', true, -30.4, 1, [[56.8, 60.0, 0, 3.6]]);
  w.blind('timber', false, 54.4, -1, [[-40.0, -36.8, 0, 3.6]]);
  w.shed('timber', 56.0, 36.8, F.edgeX, F.edge, 4.8, ROOF.shingle, 'cowshed');
  w.blind('timber', true, 36.8, -1, [[57.6, 59.2, 0, 2.4]]);
  // Outer ward: the cart shed (north) and the dovecote house (south) flank the siege yard.
  // The farmyard's paddock fence along the alleys: seen through, shot through, walked round.
  // North of the gate it is the cart shed's plank back: the rock ledge must not look into the farmyard's north yard.
  w.box('timber', 47.2, 0, F.laneNE, 48.0, 4.8, -GATE.tower, { tag: 'cart-shed' });
  w.box('paling', 47.2, 0, GATE.tower, 48.0, 1.6, F.laneSE);
  w.blind('timber', false, 48.0, 1, [[-20.8, -17.6, 0, 3.4], [-25.6, -24.4, 1.8, 3.4]]);
  w.blind('hall', false, 48.0, 1, [[16.0, 18.4, 0, 3.0], [21.6, 22.8, 1.8, 3.4], [12.8, 14.0, 1.8, 3.4]]);
  // Curtain, corner towers.
  w.box('curtain', 35.2, 0, -24.8, 36.8, H, -GATE.room);
  w.box('curtain', 35.2, 0, GATE.room, 36.8, H, 24.0);
  // The north-east corner tower took the siege's worst: its courses stand at broken heights.
  for (const [x0, x1, top] of [[33.6, 35.2, 6.4], [35.2, 36.8, 4.4], [36.8, 38.4, 5.2]] as const) w.box('rubble', x0, 0, -31.2, x1, top, -24.8, { tag: 'corner' });
  w.box('tower', 33.6, 0, 24.0, 38.4, 8.0, 30.4, { tag: 'corner' });
  // Solar range (north): stands back from the crag street; a garden shed against its front.
  range(w, 4.0, 24.0, F.laneNE, F.rangeN, 5.6, [6.4, 11.2], 1, ROOF.clay, 'solar');
  // The solar's east end fell in the siege: its street wall is a low broken stump, the crag street sees the bailey.
  lowWall(w, 'rubble', 24.0, 33.6, F.laneNE, F.laneNE + 0.8, F.street + 0.96);
  w.box('rubble', 33.6, 0, -24.8, 35.2, 3.2, F.rangeN, { tag: 'solar' });
  w.shed('timber', 12.8, -30.4, 17.6, F.laneNE, 3.2, ROOF.shingle, 'shed');
  w.blind('hall', true, F.laneNE, -1, [[16.0, 17.6, 2.2, 4.2], [20.8, 22.4, 0, 2.88]]);
  w.blind('timber', true, -30.4, -1, [[14.4, 16.0, 0, 2.4]]);
  w.blind('hall', true, F.rangeN, 1, [[14.4, 16.0, 0, 2.88], [19.2, 20.8, 1.8, 3.8]]);
  // Brewhouse range (south): low, with a lean-to on the court side.
  range(w, 7.2, 35.2, F.rangeS, F.laneSE, 4.8, [13.6, 18.4], -1, ROOF.shingle, 'brewhouse');
  w.shed('timber', 24.0, 20.0, 28.8, F.rangeS, 3.2, ROOF.shingle, 'leanto');
  w.blind('hall', true, F.laneSE, 1, [[10.4, 12.0, 1.6, 3.2], [19.2, 20.8, 0, 2.6], [30.4, 32.0, 1.6, 3.2]]);
  w.blind('hall', true, F.rangeS, -1, [[10.4, 12.0, 0, 2.6], [20.0, 21.6, 1.6, 3.2], [31.2, 32.8, 1.6, 3.2]]);
  // The fallen tower's heap splits the east bailey as the forge splits the west.
  for (const [x0, x1, z0, z1, top] of [[16.8, 21.6, -3.2, -0.8, 4.4], [16.8, 21.6, -0.8, 1.6, 4.8], [16.8, 21.6, 1.6, 3.2, 3.6]] as const) w.box('rubble', x0, 0, z0, x1, top, z1, { tag: 'heap' });
  loft(w, 'bank');
  for (const [x, z] of [[24.8, -37.2], [27.6, -33.2], [17.6, -39.6]] as const) w.seed(x, F.street, z);
  // Outcrop where the crag pushes into the street near the camp: two ledges, both too high to jump onto.
  w.box('bank', 36.8, 0, -F.edge, 42.4, 3.6, -39.2, { tag: 'outcrop' });
  w.box('bank', 38.4, 0, -39.2, 42.4, 2.4, -37.6, { tag: 'outcrop' });
  // The crag street steps down into the farmyard and into the outer ward's alley.
  w.stairs({ x: 42.8, z: -26.4, y0: 0, dir: 'n', width: 8.8, steps: 2 });
  w.stairs({ x: 48.0, z: (-F.edge + F.laneNE) / 2, y0: 0, dir: 'w', width: F.laneNE + F.edge, steps: 2 });
  // The quay: one step up from the mill and from the camp; a fishing hut on it over the cove.
  w.stairs({ x: QUAY.x0 - 0.8, z: (F.laneSE + F.edge) / 2, y0: 0, dir: 'e', width: F.edge - F.laneSE, steps: 1 });
  w.stairs({ x: QUAY.x1 + 0.8, z: (F.laneSE + F.edge) / 2, y0: 0, dir: 'w', width: F.edge - F.laneSE, steps: 1 });
  w.box('timber', 24.0, F.quay, 38.4, 28.8, F.quay + 3.6, QUAY.coveZ, { tag: 'hut' });
  w.roof({ x0: 24.0, z0: 38.4, x1: 28.8, z1: QUAY.coveZ, base: F.quay + 3.6, face: 's', color: ROOF.shingle, wall: '#9a6a3f', small: true });
  w.blind('timber', true, 38.4, -1, [[25.6, 27.2, F.quay, F.quay + 2.4]]);
}

/** A wall you see over (1.36 m) with an unseen barrier over it to head height, so nobody climbs it from a prop. */
function lowWall(w: Works, kind: Kind, x0: number, x1: number, z0: number, z1: number, top = 1.36) {
  w.box(kind, x0, 0, z0, x1, top, z1);
  w.box('barrier', x0, top, z0, x1, top + 1.84, z1, { bulletsPass: true });
}

/**
 * A range of buildings between a lane and a keep court, parted by a barred pend: an open bay off the lane whose far end
 * is an iron grille onto the court (`court` -1 = the court at z0, 1 = at z1), so the lane and the court see each other.
 */
function range(w: Works, x0: number, x1: number, z0: number, z1: number, top: number, [g0, g1]: [number, number], court: -1 | 1, color: string, tag: string) {
  for (const [a, b] of [[x0, g0], [g1, x1]] as const) {
    w.box('hall', a, 0, z0, b, top, z1, { tag });
    w.roof({ x0: a, z0, x1: b, z1, base: top, face: 's', color, wall: '#d3ccbb', small: b - a < 10 });
  }
  const [c0, c1] = court > 0 ? [z1 - 0.8, z1] : [z0, z0 + 0.8];
  const [l0, l1] = court > 0 ? [z0, z0 + 0.8] : [z1 - 0.8, z1];
  w.box('grille', g0, 0, c0, g1, 3.2, c1);
  w.box('hall', g0, 3.2, c0, g1, top, c1, { tag });
  w.box('hall', g0, 3.2, l0, g1, top, l1, { tag });
  w.openings.push({ kind: 'hall', alongX: true, a0: g0, a1: g1, c0: l0, c1: l1, y0: 0, y1: 3.2, door: true });
  // Waypoints in the bay, so a bot sees a player standing in it.
  for (const f of [0.3, 0.7]) w.seed((g0 + g1) / 2, 0, court > 0 ? z1 - 1.6 - (z1 - z0 - 3.2) * f * 0.5 : z0 + 1.6 + (z1 - z0 - 3.2) * f * 0.5);
  for (const x of [g0 + 1.2, g1 - 1.2]) w.seed(x, 0, court > 0 ? z1 - 1.8 : z0 + 1.8);
  // A pend off the crag street climbs to its terrace inside the bay.
  if (court > 0 && z0 < F.rangeN - 4) w.stairs({ x: (g0 + g1) / 2, z: z0 + 1.6, y0: 0, dir: 'n', width: g1 - g0, steps: 2 });
}

/** Low edges you see over (crag field wall, river wall, the cove, the moat wall behind the square, the paddock fence). */
function edges(w: Works) {
  const E = F.edge;
  const X = F.edgeX;
  const wall = (x0: number, z0: number, x1: number, z1: number, base: number) => {
    w.box('breast', x0, 0, z0, x1, base + 1.36, z1);
    // Over each wall an unseen barrier to head height: shots and sight pass, nobody climbs onto the wall from a prop.
    w.box('barrier', x0, base + 1.36, z0, x1, base + 3.2, z1, { bulletsPass: true });
  };
  wall(-X - 0.8, -E - 0.8, -F.terrace, -E, 0);
  wall(-F.terrace, -E - 0.8, -KNOLL.half, -E, F.street);
  wall(-KNOLL.half, -E - 0.8, KNOLL.half, -E, F.knoll);
  wall(KNOLL.half, -E - 0.8, F.terrace, -E, F.street);
  wall(F.terrace, -E - 0.8, 54.4, -E, 0);
  wall(-X - 0.8, -38.4, -X, 38.4, 0);
  wall(X, -30.4, X + 0.8, 36.8, 0);
  wall(-X - 0.8, E, QUAY.x0, E + 0.8, 0);
  wall(QUAY.x0, E, QUAY.cove0, E + 0.8, F.quay);
  wall(QUAY.cove1, E, QUAY.x1, E + 0.8, F.quay);
  wall(QUAY.x1, E, 56.0, E + 0.8, 0);
  wall(QUAY.cove0, QUAY.coveZ, QUAY.cove1, QUAY.coveZ + 0.8, F.quay);
  wall(QUAY.cove0, QUAY.coveZ + 0.8, QUAY.cove0 + 0.8, E + 0.8, F.quay);
  wall(QUAY.cove1 - 0.8, QUAY.coveZ + 0.8, QUAY.cove1, E + 0.8, F.quay);
}

/** Pieces across x = 0: the closed keep, the north tower and chapel, the ruin on its knoll, the bakehouse, the mill. */
function centre(w: Works) {
  // The keep: sealed (its doors are shut), a hall inside under a vaulted floor, the tower solid above it.
  const t = 0.8;
  w.box('tower', -K, 0, -K, K, 12.0, -K + t, { tag: 'keep' });
  w.box('tower', -K, 0, K - t, K, 12.0, K, { tag: 'keep' });
  w.box('tower', -K, 0, -K + t, -K + t, 12.0, K - t, { tag: 'keep' });
  w.box('tower', K - t, 0, -K + t, K, 12.0, K - t, { tag: 'keep' });
  w.box('tower', -K + t, 7.2 - F.slab, -K + t, K - t, 12.0, K - t, { tag: 'keep' });
  // Buttresses on the keep's court faces break its long walls.
  for (const z of [-1, 1]) for (const x of [-3.2, 3.2]) w.box('tower', x - 0.8, 0, z < 0 ? -K - 0.8 : K, x + 0.8, 6.4, z < 0 ? -K : K + 0.8, { tag: 'keep' });
  w.box('hall', -4.0, 0, -30.4, 4.0, 7.2, F.rangeN, { tag: 'chapel' });
  w.blind('hall', true, F.rangeN, 1, [[-1.2, 1.2, 0, 3.2]]);
  w.blind('hall', true, -30.4, -1, [[-1.2, 1.2, F.street + 1.2, F.street + 3.6]]);
  w.box('hall', -7.2, 0, F.rangeS, 7.2, 4.8, 30.4, { tag: 'bakehouse' });
  w.roof({ x0: -7.2, z0: F.rangeS, x1: 7.2, z1: 30.4, base: 4.8, face: 's', color: ROOF.clay, wall: '#d3ccbb', small: true });
  w.blind('hall', true, F.rangeS, -1, [[-0.8, 0.8, 0, 2.6], [-5.2, -4.0, 1.6, 3.2], [4.0, 5.2, 1.6, 3.2]]);
  // The knoll: one step up from the terrace on three sides; the ruin stands on its back edge.
  const k = KNOLL.half;
  if (F.knoll > F.street) {
    w.stairs({ x: -k - 0.8, z: (-F.edge + KNOLL.south) / 2, y0: F.street, dir: 'e', width: KNOLL.south + F.edge, steps: 1 });
  w.stairs({ x: k + 0.8, z: (-F.edge + KNOLL.south) / 2, y0: F.street, dir: 'w', width: KNOLL.south + F.edge, steps: 1 });
  w.stairs({ x: 0, z: KNOLL.south + 0.8, y0: F.street, dir: 'n', width: k * 2, steps: 1 });
  }
  // The ruin: a broken tower in the middle of the crest, so the street parts round it and no line runs its length;
  // its courses stop at different heights, so its top reads as fallen.
  for (const [x0, x1, top] of [[-4.0, -1.6, 7.2], [-1.6, 0.8, 5.2], [0.8, 2.4, 3.6], [2.4, 4.0, 6.0]] as const) w.box('rubble', x0, 0, RUIN.z0, x1, F.knoll + top, RUIN.z1, { tag: 'ruin' });
  // The mill: body, gallery over the ford, a stair annex on each side.
  const { half, body, front, stair } = MILL;
  w.box('hall', -half, 0, 30.4, half, 7.2, body, { tag: 'mill' });
  w.roof({ x0: -half, z0: 30.4, x1: half, z1: body, base: 7.2, face: 's', color: ROOF.shingle, wall: '#d3ccbb' });
  w.box('block', -half, 0, body, half, F.loft, front, { walk: true, tag: 'mill' });
  w.box('parapet', -half, F.loft, front - 0.8, half, F.loft + 1.0, front);
  w.box('rail', -half, F.loft + 1.0, front - 0.8, half, F.loft + 1.6, front, { bulletsPass: true });
  for (const s of [-1, 1] as const) {
    w.box('block', Math.min(s * Math.abs(stair), s * half), 0, 30.4, Math.max(s * Math.abs(stair), s * half), 4.8, body, { tag: 'mill' });
    w.stairs({ x: s * Math.abs(stair), z: body + 0.8, y0: 0, dir: s < 0 ? 'e' : 'w', width: 1.6, steps: 7, wood: true });
  }
  w.box('ford', -MILL.race, F.ford - 0.6, front, MILL.race, F.ford, F.edge, { walk: true });
  // Extra waypoints round corners where the nearest one would not see a player standing against the wall.
  for (const p of NAV) w.seed(...p);
}

const NAV: [number, number, number][] = [
  [28.8, 0, -24.8], [26.0, 0, -24.0], [24.8, F.street, -33.0], [-47.2, 0, 0], [47.2, 0, 0], [-45.6, 0, -11.6], [45.6, 0, -11.6],
  [-22.4, 0, 20.4], [-12.0, 0, 20.4], [12.0, 0, 20.4], [22.4, 0, -20.4], [-22.4, 0, -20.4], [-19.2, 0, 4.4], [-19.2, 0, -4.4],
  [19.2, 0, 4.4], [19.2, 0, -4.4], [33.2, 0, 14.0], [33.2, 0, -14.0], [-33.2, 0, 14.0], [-33.2, 0, -14.0], [-31.6, 0, 26.0],
  [-36.4, 0, 39.8], [-29.2, 0, 39.8], [16.0, 0, 26.4], [23.0, F.quay, 39.6], [-7.2, F.knoll, -36.4]
];
