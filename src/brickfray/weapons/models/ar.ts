import * as THREE from 'three';
import { T, type ModelBuilder } from '../builder';
import { box, gear, latheZ, pipe, prism, rounder, slab, torus, tube } from '../shapes';
import { railSide, railTop, screw, shade, slot, studGrid, studSide, wear } from './details';

const C = {
  receiver: '#3a4149',
  furniture: '#c9a46c',
  mag: '#b38e5a',
  accent: '#f58a1f',
  barrel: '#4b5157',
  dark: '#22282e',
  optic: '#2a3037',
  lens: '#a9dcff',
  dot: '#ff3020'
};
const BORE = 0.112;
const SIGHT_Y = 0.169;

/** Clicker AR: tan studded furniture on a dark receiver, red-dot optic, curved mag. */
export function buildAr(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Lower receiver with the flared magazine well.
  b.add(
    slab([[0.064, 0.097], [-0.166, 0.097], [-0.166, 0.062], [-0.158, 0.028], [-0.076, 0.028], [-0.07, 0.05], [0.064, 0.05]], 0.034, lod, 0.004),
    C.receiver,
    'satin'
  );
  // Flared lip round the mouth of the magazine well, a separate moulding standing out of the receiver's sides.
  b.add(prism([[-0.017, 0.038], [0.017, 0.038], [0.0212, 0.023], [-0.0212, 0.023]], 0.092, lod, lod.bevel), shade(C.receiver, 0.92), 'satin', T(0, 0, -0.123));
  // Trigger guard loop and trigger blade.
  b.add(slab([[-0.08, 0.052], [-0.012, 0.052], [-0.014, 0.014], [-0.08, 0.017]], 0.009, lod, 0.006, [[[-0.073, 0.05], [-0.021, 0.05], [-0.022, 0.022], [-0.073, 0.024]]]), C.receiver, 'satin');
  b.add(slab([[-0.049, 0.052], [-0.04, 0.052], [-0.041, 0.038], [-0.045, 0.027], [-0.052, 0.025], [-0.049, 0.037]], 0.0055, lod, 0.002), C.accent, 'plastic');

  // Pistol grip, raked back, with panel lines and a stud texture.
  const grip: [number, number][] = [[-0.022, 0.052], [0.03, 0.052], [0.052, -0.058], [0.018, -0.064], [0.006, -0.058], [-0.004, -0.024], [-0.013, 0.006]];
  b.add(slab(grip, 0.03, lod, [0.004, 0.01, 0.012, 0.01, 0.01, 0.012, 0.01]), C.furniture, 'plastic');
  // Rubber wrap where the palm sits.
  if (d >= 1) b.add(slab([[-0.012, 0.03], [0.025, 0.03], [0.042, -0.05], [0.012, -0.055], [0.002, -0.03]], 0.0322, lod, 0.006), C.dark, 'rubber');
  if (d >= 1) {
    for (const s of [1, -1]) {
      b.add(box(0.0012, 0.085, 0.0018), shade(C.furniture, 0.55), 'dark', T(s * 0.0153, -0.006, 0.009, -0.28));
      b.add(box(0.0012, 0.07, 0.0018), shade(C.furniture, 0.55), 'dark', T(s * 0.0153, -0.012, 0.03, -0.28));
    }
    b.add(box(0.026, 0.004, 0.034), shade(C.furniture, 0.85), 'satin', T(0, -0.062, 0.03, -0.12));
  }
  if (d >= 2) {
    for (const s of [1, -1] as const) {
      for (let row = 0; row < 3; row++) studSide(b, s, s * 0.0148, -0.034 + row * 0.022, 0.024 + row * 0.006, 2, 0.011, 0.0028, shade(C.furniture, 0.92));
    }
  }

  // Upper receiver, top rail, ejection port and forward assist.
  b.add(box(0.032, 0.039, 0.236, lod.bevel), C.receiver, 'satin', T(0, 0.1155, -0.054));
  railTop(b, 0, 0.135, 0.058, -0.165, 0.021, C.dark);
  slot(b, 0.0163, 0.117, -0.05, 0.0016, 0.014, 0.044);
  if (d >= 1) {
    b.add(box(0.003, 0.0026, 0.044, 0.0006), C.receiver, 'metal', T(0.0185, 0.1075, -0.05, 0, 0, -0.5));
    b.add(tube(0.0062, 0.03, lod.segSmall, 0.0015), C.receiver, 'satin', T(0.0135, 0.124, 0.012));
    b.add(tube(0.0066, 0.004, lod.segSmall, 0.001), C.dark, 'satin', T(0.0135, 0.124, 0.028));
    b.add(box(0.006, 0.012, 0.012, 0.002), C.receiver, 'satin', T(0.0175, 0.124, -0.022));
  }
  // Upper/lower split line, a bevelled metal plate over the magwell and a raised side plate on the upper, held by screws.
  if (d >= 1) {
    for (const sd of [1, -1]) {
      b.add(box(0.0012, 0.0022, 0.226), '#15191d', 'dark', T(sd * 0.0166, 0.0965, -0.052));
      // Anodised metal plates on the polymer receiver: they catch the light where the receiver stays matte.
      b.add(box(0.0044, 0.026, 0.058, 0.0019), shade(C.receiver, 1.6), 'metal', T(sd * 0.0166, 0.072, -0.117));
      b.add(box(0.0042, 0.022, 0.1, 0.0019), shade(C.receiver, 1.55), 'metal', T(sd * 0.0162, 0.118, -0.115));
      // A stepped rib where the upper receiver tapers in toward the handguard.
      b.add(box(0.003, 0.005, 0.15, 0.001), shade(C.receiver, 0.85), 'satin', T(sd * 0.0168, 0.1, -0.075));
    }
  }
  if (d >= 2) {
    for (const sd of [1, -1]) {
      for (const [y, z] of [[0.081, -0.094], [0.063, -0.14], [0.126, -0.075], [0.11, -0.155]] as const) screw(b, sd * 0.0189, y, z, 'x', 0.0019);
    }
  }
  // Worn edges where the hands and the sling rub: the upper's top corners, the lower's belly, the magwell lip.
  for (const sd of [1, -1]) wear(b, sd * 0.0159, 0.1349, 0.058, -0.166, C.receiver, 2.2);
  wear(b, -0.0167, 0.0505, 0.058, -0.064, C.receiver, 2);
  wear(b, -0.0212, 0.0232, -0.08, -0.166, C.receiver, 2);
  // Selector, mag release, bolt catch, takedown pins.
  if (b.minor) {
    b.add(box(0.004, 0.006, 0.016, 0.001), C.accent, 'plastic', T(-0.0185, 0.077, 0.022, 0.4));
    b.add(tube(0.0042, 0.004, lod.segSmall), C.accent, 'plastic', T(0.0185, 0.074, -0.066, 0, Math.PI / 2));
  }
  if (d >= 1) {
    // Bolt release: a ribbed metal paddle on the left of the receiver, over the magazine well.
    b.add(box(0.0034, 0.017, 0.009, 0.0012), C.barrel, 'metal', T(-0.0186, 0.086, -0.073, 0.22));
    for (const y of [0.08, 0.086, 0.092]) b.add(box(0.0012, 0.0016, 0.0094), shade(C.barrel, 0.6), 'dark', T(-0.0205, y, -0.0735 + (y - 0.086) * 0.22));
    for (const s of [1, -1]) for (const z of [0.045, -0.15]) b.add(tube(0.0032, 0.0016, lod.segSmall), C.barrel, 'metal', T(s * 0.0172, 0.09, z, 0, Math.PI / 2));
  }

  // Handguard: three studded segments with slots and side rails.
  const hg: [number, number][] = [[-0.024, 0.087], [0.024, 0.087], [0.024, 0.137], [-0.024, 0.137]];
  const segments = d >= 1 ? [[-0.172, -0.262], [-0.2645, -0.3545], [-0.357, -0.447]] : [[-0.172, -0.447]];
  for (const [z0, z1] of segments) b.add(prism(hg, z0! - z1!, lod, 0.009), C.furniture, 'plastic', T(0, 0, (z0! + z1!) / 2));
  if (d >= 1) b.add(prism([[-0.02, 0.09], [0.02, 0.09], [0.02, 0.134], [-0.02, 0.134]], 0.27, lod, 0.006), C.dark, 'dark', T(0, 0, -0.31));
  const studRows = d >= 1 ? 2 : 1;
  const studCount = d >= 1 ? 12 : 6;
  const studPitch = d >= 1 ? 0.0225 : 0.045;
  if (b.minor) studGrid(b, 0, 0.137, -0.3095, studRows, studCount, studPitch, d >= 1 ? 0.0064 : 0.0075, C.furniture);
  if (d >= 1) {
    for (const s of [1, -1] as const) {
      for (const zc of [-0.2, -0.235, -0.29, -0.325]) slot(b, s * 0.0241, 0.11, zc, 0.0016, 0.0085, 0.024);
      railSide(b, s, s * 0.024, 0.112, -0.37, -0.438, 0.014, C.dark);
    }
    b.add(box(0.018, 0.012, 0.016, 0.003), C.accent, 'plastic', T(0, 0.083, -0.268, -0.35));
    for (const s of [1, -1]) wear(b, s * 0.0232, 0.1362, -0.176, -0.443, C.furniture, 1.16, 'plastic');
  }
  if (d >= 2) {
    for (const s of [1, -1]) for (const z of [-0.18, -0.44]) screw(b, s * 0.0242, 0.126, z, 'x', 0.0024);
  }

  // Barrel, gas ring and a ported muzzle brake.
  b.add(tube(0.0092, 0.125, lod.seg, 0.001), C.barrel, 'metal', T(0, BORE, -0.505));
  if (d >= 1) b.add(tube(0.0122, 0.012, lod.seg, 0.002), C.dark, 'metal', T(0, BORE, -0.454));
  if (!b.minor) b.add(tube(0.0132, 0.054, lod.seg), C.dark, 'metal', T(0, BORE, -0.591));
  else b.add(
    latheZ(
      [
        [0, -0.0545],
        [0.006, -0.0545],
        [0.006, -0.0525],
        [0.0118, -0.0525],
        [0.0132, -0.05],
        [0.0132, 0.0],
        [0.011, 0.003],
        [0.0096, 0.003],
        [0, 0.003]
      ],
      lod.seg
    ),
    C.dark,
    'metal',
    T(0, BORE, -0.564)
  );
  if (b.minor) b.add(tube(0.0058, 0.0016, lod.segSmall), '#0d1013', 'dark', T(0, BORE, -0.6186));
  if (d >= 1) {
    for (const s of [1, -1]) for (const z of [-0.575, -0.588, -0.601]) slot(b, s * 0.0127, BORE, z, 0.0028, 0.0075, 0.0068, '#101418');
    for (const z of [-0.58, -0.596]) slot(b, 0, BORE + 0.0127, z, 0.004, 0.0028, 0.005, '#101418');
  }

  // Buffer tube, adjustable stock and butt pad.
  b.add(tube(0.0145, 0.19, lod.seg, 0.002), C.dark, 'satin', T(0, BORE, 0.158));
  if (d >= 1) b.add(gear(0.0155, 0.0172, 8, 0.008), C.barrel, 'metal', T(0, BORE, 0.07));
  const stock: [number, number][] = [[0.122, 0.139], [0.284, 0.143], [0.298, 0.131], [0.298, 0.033], [0.285, 0.024], [0.256, 0.03], [0.206, 0.071], [0.15, 0.09], [0.122, 0.092]];
  b.add(slab(stock, 0.042, lod, [0.008, 0.008, 0.008, 0.008, 0.008, 0.02, 0.02, 0.02, 0.008], [], 0.009), C.furniture, 'plastic');
  b.add(slab([[0.297, 0.146], [0.311, 0.146], [0.311, 0.021], [0.297, 0.021]], 0.045, lod, 0.004), C.dark, 'rubber');
  if (b.minor) b.add(box(0.008, 0.008, 0.022, 0.002), C.accent, 'plastic', T(0, 0.089, 0.15, 0.12));
  if (d >= 1) {
    for (const s of [1, -1] as const) studSide(b, s, s * 0.021, 0.115, 0.23, 3, 0.02, 0.0055, C.furniture);
    slot(b, 0, 0.144, 0.205, 0.016, 0.0016, 0.07, shade(C.furniture, 0.6));
  }
  if (d >= 2) {
    for (let i = 0; i < 6; i++) b.add(box(0.046, 0.003, 0.0026, 0.0006), shade(C.dark, 1.4), 'rubber', T(0, 0.032 + i * 0.02, 0.3115));
    b.add(torus(0.008, 0.0018, 12), C.barrel, 'metal', T(0, 0.022, 0.27, 0, Math.PI / 2));
  }

  // Red-dot optic: mount, hooded tube, glass and the glowing dot.
  b.add(box(0.026, 0.013, 0.044, lod.bevel), C.optic, 'satin', T(0, 0.1445, -0.08));
  b.add(box(0.014, 0.008, 0.026, lod.bevel), C.optic, 'satin', T(0, 0.148, -0.084));
  // The tube fills the eye at ADS: rounder than the rest of the gun, so it never shows its facets. Short and thin-walled,
  // so aimed its housing is a slim ring round a wide window instead of a pipe to look down.
  const ring = lod.third ? lod.seg : Math.max(24, lod.seg * 2);
  rounder(ring, () => {
    b.add(b.minor ? pipe(0.018, 0.0167, 0.03, ring) : tube(0.018, 0.03, ring), C.optic, 'satin', T(0, SIGHT_Y, -0.085));
    if (b.minor) b.add(pipe(0.0188, 0.0167, 0.004, ring), C.optic, 'satin', T(0, SIGHT_Y, -0.099));
    b.glass(tube(0.0168, 0.0014, ring), C.lens, T(0, SIGHT_Y, -0.097));
    // Circle-dot reticle: a dot the eye finds on any background inside a ring that frames the target.
    if (b.minor) {
      b.add(tube(0.0016, 0.0006, 12), C.dot, 'glow', T(0, SIGHT_Y, -0.0985));
      b.add(torus(0.0068, 0.0006, 28), C.dot, 'glow', T(0, SIGHT_Y, -0.0985));
    }
  });
  if (b.minor) b.add(gear(0.0058, 0.0066, d >= 2 ? 14 : 8, 0.009), C.accent, 'plastic', T(0.0222, SIGHT_Y - 0.002, -0.084, 0, Math.PI / 2));
  if (d >= 1) {
    b.add(box(0.003, 0.006, 0.026, 0.001), C.accent, 'plastic', T(-0.0145, 0.145, -0.07));
    b.add(tube(0.0062, 0.008, lod.segSmall, 0.0015), C.optic, 'satin', T(0, SIGHT_Y + 0.0195, -0.084, Math.PI / 2));
  }
  if (d >= 2) {
    for (const z of [-0.06, -0.092]) screw(b, 0.0131, 0.1445, z, 'x', 0.0021);
    b.add(box(0.016, 0.0015, 0.0015), shade(C.optic, 1.8), 'satin', T(0, SIGHT_Y + 0.0182, -0.098));
  }

  // Bolt carrier (animated, cycles on every shot): chrome in the ejection port and a left-side track with its orange knob.
  slot(b, -0.0163, 0.119, -0.052, 0.0016, 0.0095, 0.07);
  b.part('slide', new THREE.Vector3(0, 0.119, -0.07));
  b.add(box(0.0022, 0.0062, 0.04, 0.0006), '#c4c9ce', 'chrome', T(0.0166, 0.117, -0.052));
  b.add(box(0.0022, 0.0058, 0.03, 0.0006), '#c4c9ce', 'chrome', T(-0.0168, 0.119, -0.064));
  b.add(box(0.0075, 0.0105, 0.011, 0.002), C.accent, 'plastic', T(-0.0205, 0.119, -0.0765));

  // Charging handle (animated).
  b.part('bolt', new THREE.Vector3(0, 0.128, 0.064));
  b.add(box(0.016, 0.008, 0.032, 0.0015), C.dark, 'satin', T(0, 0.129, 0.06));
  b.add(box(0.05, 0.008, 0.011, 0.002), C.dark, 'satin', T(0, 0.129, 0.075));
  for (const s of [1, -1]) b.add(box(0.012, 0.009, 0.012, 0.002), C.accent, 'plastic', T(s * 0.023, 0.129, 0.074));
  b.node('charge', 0, 0.129, 0.08);

  // Curved magazine (animated).
  b.part('magazine', new THREE.Vector3(0, 0.05, -0.116));
  const mag: [number, number][] = [[-0.15, 0.062], [-0.082, 0.062], [-0.083, 0.02], [-0.088, -0.03], [-0.1, -0.075], [-0.114, -0.112], [-0.171, -0.097], [-0.162, -0.058], [-0.152, -0.014], [-0.149, 0.02]];
  b.add(slab(mag, 0.024, lod, [0.002, 0.002, 0.02, 0.03, 0.03, 0.006, 0.006, 0.03, 0.03, 0.02]), C.mag, 'satin');
  b.add(slab([[-0.112, -0.105], [-0.176, -0.089], [-0.179, -0.1], [-0.113, -0.119]], 0.029, lod, 0.003), C.accent, 'plastic');
  if (d >= 1) {
    for (const s of [1, -1]) {
      b.add(box(0.0016, 0.004, 0.044, 0.0006), shade(C.mag, 0.72), 'satin', T(s * 0.0122, -0.035, -0.13, -0.32));
      b.add(box(0.0016, 0.004, 0.046, 0.0006), shade(C.mag, 0.72), 'satin', T(s * 0.0122, 0.0, -0.118, -0.12));
    }
  }
  b.node('magHold', 0, -0.07, -0.135);

  b.part('body');
  b.node('muzzle', 0, BORE, -0.62);
  b.node('eject', 0.019, 0.117, -0.05);
  b.node('support', 0, BORE, -0.29);
  b.node('sight', 0, SIGHT_Y, -0.0985);
  b.node('grip', 0, 0, 0, -0.28);
}
