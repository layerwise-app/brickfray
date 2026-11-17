import * as THREE from 'three';
import { T, type ModelBuilder } from '../builder';
import { box, gear, prism, slab, torus, tube, type Outline } from '../shapes';
import { screw, shade, slot } from './details';

const C = {
  steel: '#c9d0d8',
  blued: '#3d444c',
  hammer: '#6d757e',
  red: '#c8231b',
  gold: '#d4a640',
  ivory: '#f1ece0',
  bore: '#0a0c0e',
  brass: '#dcae4e',
  primer: '#c3c8ce',
  sight: '#ff3a24'
};
const BORE = 0.075;
const STRAP = 0.0915;
const SIGHT_Y = 0.0975;
const MUZZLE = -0.214;
const CYL = { y: 0.0605, z: -0.043, r: 0.023, len: 0.046, chamber: 0.0145 };

/** Crane hinge relative to the cylinder axis; the cylinder swings out around it (positive Z rotation = out to the left). */
export const CRANE_HINGE: readonly [number, number] = [-0.013, 0.038 - CYL.y];

/** Hand Cannon: Sir Clack's polished six-shooter with an octagonal barrel, gold trim and a crest on red grips. */
export function buildCannon(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Frame with the cylinder window, top strap and a round recoil shield.
  const frame: Outline = [[-0.087, STRAP], [0.004, STRAP], [0.016, 0.086], [0.026, 0.068], [0.03, 0.046], [0.03, 0.03], [-0.07, 0.03], [-0.087, 0.05]];
  const window: Outline = [[-0.0185, 0.0375], [-0.0675, 0.0375], [-0.0675, 0.0855], [-0.0185, 0.0855]];
  b.add(slab(frame, 0.03, lod, [0.003, 0.004, 0.008, 0.012, 0.006, 0.004, 0.014, 0.008], [window]), C.steel, 'metal');
  b.add(tube(0.0212, 0.008, lod.seg, 0.0016), C.steel, 'metal', T(0, CYL.y, -0.0145));
  if (d >= 1) {
    for (const s of [1, -1]) {
      b.add(box(0.0008, 0.0018, 0.086), C.gold, 'metal', T(s * 0.0152, 0.0885, -0.042));
      b.add(box(0.0008, 0.0018, 0.07), C.gold, 'metal', T(s * 0.0152, 0.0335, -0.035));
    }
    // Cylinder latch on the left, behind the recoil shield.
    b.add(box(0.004, 0.006, 0.012, 0.0012), C.blued, 'metal', T(-0.0162, 0.064, -0.0045));
  }
  if (d >= 2) {
    for (const s of [1, -1] as const) {
      screw(b, s * 0.0152, 0.045, 0.012, 'x', 0.0022, C.gold);
      screw(b, s * 0.0152, 0.078, -0.078, 'x', 0.002, C.gold);
    }
  }

  // Octagonal barrel with a sight rib, gold bands, rod lug and a ramp front sight.
  const len = -MUZZLE - 0.087;
  b.add(prism(octagon(0.0112, BORE), len, lod, 0.0005), C.steel, 'metal', T(0, 0, (MUZZLE - 0.087) / 2));
  b.add(prism(octagon(0.0124, BORE), 0.007, lod, 0.0014), C.gold, 'metal', T(0, 0, -0.0915));
  b.add(prism(octagon(0.0124, BORE), 0.008, lod, 0.0014), C.gold, 'metal', T(0, 0, MUZZLE + 0.0045));
  b.add(tube(0.0058, 0.0016, lod.segSmall), C.bore, 'dark', T(0, BORE, MUZZLE - 0.0002));
  b.add(box(0.0062, STRAP - 0.085, len - 0.006, lod.bevel * 0.5), C.steel, 'metal', T(0, (STRAP + 0.085) / 2, (MUZZLE - 0.081) / 2));
  if (d >= 1) {
    for (let i = 0; i < 6; i++) for (const s of [1, -1]) slot(b, s * 0.0031, 0.0888, -0.112 - i * 0.016, 0.0006, 0.003, 0.009);
  }
  b.add(slab([[-0.114, 0.065], [-0.134, 0.065], [-0.134, 0.0605], [-0.127, 0.0548], [-0.114, 0.0552]], 0.0095, lod, 0.002), C.steel, 'metal');
  b.add(slab([[MUZZLE + 0.003, STRAP - 0.001], [MUZZLE + 0.024, STRAP - 0.001], [MUZZLE + 0.01, SIGHT_Y], [MUZZLE + 0.003, SIGHT_Y]], 0.0034, lod, 0.0008), C.gold, 'metal');
  if (b.minor) b.add(box(0.0036, 0.0026, 0.0035), C.sight, 'glow', T(0, SIGHT_Y - 0.002, MUZZLE + 0.0095));

  // Rear sight notch on the top strap.
  b.add(box(0.019, 0.003, 0.012, 0.0008), C.blued, 'satin', T(0, STRAP + 0.0013, -0.003));
  for (const s of [1, -1]) {
    b.add(box(0.0068, 0.0072, 0.012, 0.0008), C.blued, 'satin', T(s * 0.0056, SIGHT_Y - 0.0008, -0.003));
    if (b.minor) b.add(tube(0.0012, 0.0008, 8), C.gold, 'glow', T(s * 0.0056, SIGHT_Y + 0.0004, 0.0032));
  }

  // Trigger guard and trigger in gold.
  b.add(slab([[-0.066, 0.031], [-0.008, 0.031], [-0.01, 0.002], [-0.054, -0.001], [-0.068, 0.012]], 0.0085, lod, [0.002, 0.004, 0.009, 0.008, 0.008], [[[-0.06, 0.031], [-0.016, 0.031], [-0.018, 0.008], [-0.051, 0.006], [-0.061, 0.015]]]), C.gold, 'metal');
  b.add(slab([[-0.032, 0.031], [-0.024, 0.031], [-0.025, 0.018], [-0.029, 0.008], [-0.037, 0.006], [-0.034, 0.017]], 0.0056, lod, 0.002), C.gold, 'metal');

  // Grip: steel frame between red panels, a gold crest on each side and a gold butt cap.
  b.add(slab([[-0.02, 0.034], [0.024, 0.05], [0.038, 0.02], [0.052, -0.06], [0.046, -0.074], [0.006, -0.074], [-0.001, -0.062], [-0.01, -0.014]], 0.02, lod, [0.004, 0.014, 0.03, 0.012, 0.006, 0.006, 0.012, 0.03]), C.steel, 'metal');
  b.add(slab([[-0.015, 0.029], [0.027, 0.029], [0.034, 0.012], [0.046, -0.057], [0.04, -0.069], [0.009, -0.069], [0.003, -0.058], [-0.006, -0.014]], 0.031, lod, [0.003, 0.006, 0.02, 0.01, 0.006, 0.006, 0.01, 0.02]), C.red, 'plastic');
  for (const s of [1, -1] as const) crest(b, s, 0.0155, -0.018, 0.02, 1);
  b.add(slab([[0.004, -0.0705], [0.049, -0.0705], [0.051, -0.08], [0.007, -0.08]], 0.027, lod, [0.002, 0.002, 0.004, 0.004]), C.gold, 'metal');
  if (d >= 1) {
    b.add(torus(0.0052, 0.0013, lod.segSmall + 2), C.gold, 'metal', T(0, -0.0855, 0.03, 0, Math.PI / 2));
  }
  if (b.minor) for (const s of [1, -1] as const) crest(b, s, 0.0152, 0.06, 0.0085, 0.42);

  // Hammer (animated), modeled down; the view model cocks it back between shots.
  b.part('hammer', new THREE.Vector3(0, 0.064, 0.016));
  b.add(slab([[0.008, 0.058], [0.022, 0.058], [0.025, 0.073], [0.03, 0.084], [0.037, 0.0895], [0.035, 0.0945], [0.021, 0.094], [0.01, 0.088], [0.008, 0.07]], 0.0085, lod, [0.003, 0.004, 0.006, 0.004, 0.003, 0.003, 0.004, 0.003, 0.003]), C.hammer, 'metal');
  if (d >= 1) for (let i = 0; i < 3; i++) b.add(box(0.0092, 0.0012, 0.0018), shade(C.hammer, 0.5), 'dark', T(0, 0.0938 - i * 0.0006, 0.0225 + i * 0.0045, 0.12));

  // Cylinder (animated): fluted, chambered both ends, on a crane that swings out to the left.
  b.part('cylinder', new THREE.Vector3(0, CYL.y, CYL.z));
  const steps = lod.seg >= 20 ? 72 : lod.seg >= 12 ? 48 : 36;
  b.add(prism(fluted(CYL.r, 0.0036, steps), CYL.len - 0.012, lod), C.steel, 'metal', T(0, 0, CYL.z));
  for (const s of [1, -1]) b.add(tube(CYL.r, 0.0062, lod.seg, 0.0016), C.steel, 'metal', T(0, CYL.y, CYL.z + s * (CYL.len / 2 - 0.0031)));
  if (b.minor) {
    for (let i = 0; i < 6; i++) {
      const [x, y] = chamber(i);
      b.add(tube(0.0057, 0.001, lod.segSmall), C.bore, 'dark', T(x, y, CYL.z - CYL.len / 2 - 0.0002));
      b.add(tube(0.0057, 0.001, lod.segSmall), C.bore, 'dark', T(x, y, CYL.z + CYL.len / 2 + 0.0002));
    }
  }
  b.node('cylHold', 0, CYL.y, CYL.z);

  // Crane (animated): yoke and arm out to the hinge; swings with the cylinder but never indexes.
  b.part('crane', new THREE.Vector3(0, CYL.y, CYL.z));
  b.add(tube(0.0048, 0.0115, lod.segSmall), C.steel, 'metal', T(0, CYL.y, -0.0718));
  b.add(box(0.0072, 0.026, 0.008, lod.bevel * 0.5), C.steel, 'metal', T(CRANE_HINGE[0] / 2, CYL.y + CRANE_HINGE[1] / 2, -0.0718, 0, 0, -Math.atan2(-CRANE_HINGE[0], -CRANE_HINGE[1])));
  b.add(tube(0.0032, 0.012, lod.segSmall), C.steel, 'metal', T(CRANE_HINGE[0], CYL.y + CRANE_HINGE[1], -0.0718));

  // Ejector rod and extractor star (animated): swings with the crane; its stroke kicks the empties out.
  b.part('ejector', new THREE.Vector3(0, CYL.y, CYL.z));
  b.add(tube(0.0024, 0.042, lod.segSmall), C.steel, 'metal', T(0, CYL.y, -0.087));
  b.add(d >= 1 ? gear(0.003, 0.0036, 12, 0.008) : tube(0.0034, 0.008, lod.segSmall), C.steel, 'metal', T(0, CYL.y, -0.11));
  b.add(prism(star(0.0094, 0.0058), 0.0012, lod), C.gold, 'metal', T(0, 0, -0.0197));
  b.node('rodTip', 0, CYL.y, -0.114);

  // Moon-clipped rounds with a gold speedloader knob; they ride in the cylinder and are swapped on reload.
  if (!lod.third) {
    b.part('speedloader', new THREE.Vector3(0, CYL.y, CYL.z));
    for (let i = 0; i < 6; i++) {
      const [x, y] = chamber(i);
      b.add(tube(0.0053, 0.03, lod.segSmall), C.brass, 'metal', T(x, y, -0.035));
      b.add(tube(0.0064, 0.0016, lod.segSmall, 0.0004), C.brass, 'metal', T(x, y, -0.0196));
      if (b.minor) b.add(tube(0.0019, 0.0005, 8), C.primer, 'metal', T(x, y, -0.0187));
    }
    b.add(tube(0.0095, 0.002, lod.segSmall + 2, 0.0005), C.gold, 'metal', T(0, CYL.y, -0.0178));
    b.add(d >= 1 ? gear(0.0048, 0.0056, 14, 0.008) : tube(0.0056, 0.008, lod.segSmall), C.gold, 'metal', T(0, CYL.y, -0.0128));
    b.node('loaderHold', 0, CYL.y, -0.0088);
  }

  b.part('body');
  b.node('muzzle', 0, BORE, MUZZLE);
  b.node('eject', 0, CYL.y, -0.02);
  b.node('support', 0, -0.006, -0.008);
  b.node('sight', 0, SIGHT_Y, -0.003);
  b.node('grip', 0, 0, 0, -0.2);
}

/** Chamber center in model space; chamber 0 lines up with the bore. */
function chamber(i: number): [number, number] {
  const a = Math.PI / 2 + (i * Math.PI) / 3;
  return [Math.cos(a) * CYL.chamber, CYL.y + Math.sin(a) * CYL.chamber];
}

function octagon(apothem: number, cy: number): Outline {
  const r = apothem / Math.cos(Math.PI / 8);
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    return [Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });
}

/** Cylinder cross-section with six flutes between the chambers. */
function fluted(r: number, depth: number, steps: number): Outline {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    const k = r - depth * Math.max(0, Math.cos(a * 6)) ** 1.5;
    return [Math.cos(a) * k, CYL.y + Math.sin(a) * k] as const;
  });
}

function star(outer: number, inner: number): Outline {
  return Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const r = i % 2 === 0 ? outer : inner;
    return [Math.cos(a) * r, CYL.y + Math.sin(a) * r] as const;
  });
}

/** Heater shield on a side face (x = side * face): gold rim, ivory field, red cross. */
function crest(b: ModelBuilder, side: 1 | -1, face: number, y: number, z: number, scale: number) {
  const w = 0.011 * scale;
  const h = 0.013 * scale;
  const shield: Outline = [[-w, h], [w, h], [w, -0.1 * h], [0, -h * 1.15], [-w, -0.1 * h]];
  const lod = b.lod;
  const tilt = -0.2;
  b.add(slab(shield, 0.0014, lod, [0.001 * scale, 0.001 * scale, 0.008 * scale, 0.002 * scale, 0.008 * scale]), C.gold, 'metal', T(side * (face + 0.0007), y, z, tilt));
  if (b.detail === 0 && scale < 1) return;
  const inner: Outline = shield.map(([pz, py]) => [pz * 0.74, py * 0.74 + 0.0006 * scale] as const);
  b.add(slab(inner, 0.0008, lod, [0, 0, 0.006 * scale, 0.001 * scale, 0.006 * scale]), C.ivory, 'plastic', T(side * (face + 0.0016), y, z, tilt));
  b.add(box(0.0006, h * 1.25, 0.0034 * scale), C.red, 'plastic', T(side * (face + 0.0021), y - 0.0008 * scale, z, tilt));
  b.add(box(0.0006, 0.0034 * scale, w * 1.3), C.red, 'plastic', T(side * (face + 0.0021), y + 0.0028 * scale, z + 0.0006 * scale, tilt));
}
