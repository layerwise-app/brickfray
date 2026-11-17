import { T, type ModelBuilder } from '../builder';
import { latheZ, slab, stud, torus, tube } from '../shapes';
import { arc, bladeSlab } from './forms';
import { shade } from './details';

const C = { wood: '#8f6440', wrap: '#4f7a3a', cord: '#6e4a2f', steel: '#8d969f', edge: '#cdd4da', leaf: '#a6c629' };
const UP = -Math.PI / 2;

/** Moss's woodsman hatchet: origin at the grip, head up +Y, bit toward -Z, poll toward +Z. */
export function buildHatchet(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Oval hickory handle with a swelled knob, green wrap with cord ties.
  const handle: [number, number][] = [
    [0, -0.104],
    [0.0125, -0.104],
    [0.0172, -0.097],
    [0.0176, -0.084],
    [0.0132, -0.07],
    [0.0122, 0.0],
    [0.0112, 0.2],
    [0.0116, 0.3],
    [0, 0.3]
  ];
  b.add(latheZ(handle, lod.seg), C.wood, 'satin', T(0, 0, 0, UP, 0, 0, 1, 1.18, 1));
  b.add(tube(0.0138, 0.118, lod.seg, 0.002), C.wrap, 'satin', T(0, -0.004, 0, UP, 0, 0, 1, 1.12, 1));
  if (d >= 1) for (let i = 0; i < 6; i++) b.add(torus(0.0139, 0.0019, lod.seg), shade(C.wrap, 0.75), 'satin', T(0, -0.05 + i * 0.019, 0, Math.PI / 2 + 0.25, 0, 0, 1, 1, 1.12));
  for (const y of [-0.064, 0.056]) b.add(tube(0.0146, 0.008, lod.seg, 0.002), C.cord, 'rubber', T(0, y, 0, UP, 0, 0, 1, 1.12, 1));

  // Eye block and flat poll, two studs on top.
  b.add(slab([[-0.026, 0.25], [0.033, 0.255], [0.035, 0.316], [-0.026, 0.32]], 0.032, lod, 0.006), C.steel, 'satin', T());
  const s = stud(0.0072, 0.0045, lod.segSmall, d >= 1);
  for (const z of [-0.012, 0.012]) b.add(s, C.steel, 'satin', T(0, 0.3185, z));

  // Bearded bit: a bright ground edge under flat, squared cheeks.
  const top: [number, number][] = [[-0.02, 0.312], [-0.07, 0.322]];
  const bottom: [number, number][] = [[-0.075, 0.236], [-0.045, 0.256], [-0.02, 0.258]];
  b.add(bladeSlab([...top, ...arc(-0.02, 0.278, 0.103, Math.PI - 0.5, Math.PI + 0.62, 8), ...bottom], 0.0194, 0.009), C.edge, 'satin', T());
  b.add(slab([...top, ...arc(-0.008, 0.278, 0.103, Math.PI - 0.47, Math.PI + 0.55, 8), ...bottom], 0.0202, lod, 0.002), C.steel, 'satin', T());

  // A leaf stamped on each cheek.
  if (d >= 1) {
    const leaf = slab([[0.016, 0], [0.006, 0.0062], [-0.008, 0.0058], [-0.016, 0], [-0.008, -0.0058], [0.006, -0.0062]], 0.0012, lod, 0.003);
    for (const side of [-1, 1]) b.add(leaf, C.leaf, 'plastic', T(side * 0.0104, 0.287, -0.056, 0.55));
  }
}
