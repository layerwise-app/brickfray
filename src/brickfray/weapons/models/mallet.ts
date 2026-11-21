import { T } from '../builder';
import { ball, box, latheZ, tube } from '../shapes';
import { shade } from './details';
import { ring, turned, wide, type MeleeBuilder } from './melee-kit';

const C = { head: '#c4261d', pad: '#2b3036', band: '#aab1b8', shaft: '#f6c624', grip: '#2b3036', cap: '#f58a1f' };
const UP = -Math.PI / 2;
const HEAD_Y = 0.299;
const HEAD_R = 0.056;
/** Half the head's length; the striking faces sit this far out along ±Z. */
const HEAD_HALF = 0.1;
const BAND_Z = 0.068;

/** Builder's mallet: a banded barrel head with rubber striking pads on a ribbed-grip handle; origin at the grip, head up +Y, faces at ±Z. */
export function buildMallet(b: MeleeBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Fibreglass shaft, swelling a little into the head, with two marker rings.
  b.add(tube(0.0125, 0.19, lod.seg, 0.001, 0.0114), C.shaft, 'plastic', T(0, 0.15, 0, UP));
  if (d >= 1) for (const y of [0.186, 0.198]) b.add(tube(0.0132, 0.005, lod.seg, 0.001), C.grip, 'rubber', T(0, y, 0, UP));

  // Rubber grip: flared butt, palm swell, a guard lip under the shaft, and ribs for the fingers.
  const grip: [number, number][] = [
    [0, -0.078],
    [0.0172, -0.078],
    [0.0186, -0.071],
    [0.0166, -0.06],
    [0.0149, -0.046],
    [0.0149, 0.03],
    [0.0158, 0.046],
    [0.0174, 0.057],
    [0.0166, 0.063],
    [0.0122, 0.068],
    [0, 0.068]
  ];
  b.add(latheZ(grip, lod.seg), C.grip, 'rubber', T(0, 0, 0, UP));
  if (d >= 1) for (let i = 0; i < 8; i++) b.add(ring(0.0149, 0.0017, lod), shade(C.grip, 1.35), 'rubber', T(0, -0.046 + i * 0.0105, 0, Math.PI / 2));
  b.add(latheZ([[0, 0], [0.0155, 0], [0.0172, -0.005], [0.0165, -0.013], [0.012, -0.019], [0, -0.02]], lod.seg), C.cap, 'plastic', T(0, -0.078, 0, UP));

  // Steel socket flaring into the head, and the shaft's wedged end showing on top.
  b.add(latheZ([[0, 0.21], [0.0136, 0.21], [0.0166, 0.214], [0.0166, 0.23], [0.022, 0.243], [0.022, 0.252], [0, 0.252]], lod.seg), C.band, 'metal', T(0, 0, 0, UP));
  b.add(tube(0.0145, 0.01, lod.seg, 0.002), C.shaft, 'plastic', T(0, HEAD_Y + HEAD_R - 0.002, 0, UP));
  if (d >= 1) b.add(box(0.005, 0.003, 0.021, lod.bevel), C.band, 'metal', T(0, HEAD_Y + HEAD_R + 0.0035, 0));

  // Barrel head between two steel bands.
  const round = wide(lod);
  const band: [number, number][] = [
    [0, -0.0085],
    [0.052, -0.0085],
    [0.054, -0.0075],
    [0.0548, -0.0055],
    [0.0548, 0.0055],
    [0.054, 0.0075],
    [0.052, 0.0085],
    [0, 0.0085]
  ];
  const barrel: [number, number][] = [
    [0, -BAND_Z],
    [0.051, -BAND_Z],
    [0.0538, -0.045],
    [0.0556, -0.02],
    [HEAD_R, 0],
    [0.0556, 0.02],
    [0.0538, 0.045],
    [0.051, BAND_Z],
    [0, BAND_Z]
  ];
  b.add(turned(barrel, round), C.head, 'plastic', T(0, HEAD_Y, 0));
  // Dished rubber pads: a chamfered rim around a domed face.
  const pad: [number, number][] = [
    [0, 0],
    [0.0495, 0],
    [0.0495, 0.014],
    [0.0465, 0.0205],
    [0.041, 0.0235],
    [0.036, 0.0215],
    [0.02, 0.0238],
    [0, 0.0245]
  ];
  for (const side of [-1, 1]) {
    b.add(turned(band, round), C.band, 'metal', T(0, HEAD_Y, side * BAND_Z));
    b.add(turned(pad, round), C.pad, 'rubber', T(0, HEAD_Y, side * (HEAD_HALF - 0.0245), side < 0 ? Math.PI : 0));
    if (d >= 2) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        b.add(ball(0.0034, 6), C.band, 'metal', T(Math.cos(a) * 0.0548, HEAD_Y + Math.sin(a) * 0.0548, side * BAND_Z));
      }
    }
  }
}
