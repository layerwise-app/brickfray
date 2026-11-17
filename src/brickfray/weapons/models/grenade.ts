import * as THREE from 'three';
import { aim, T, type ModelBuilder } from '../builder';
import { box, latheZ, stud, torus, tube } from '../shapes';

const C = { body: '#7d9a3a', band: '#f6c624', fuse: '#5b636b', lever: '#c9ced4', ring: '#e2b648', stud: '#86a440' };
const UP = -Math.PI / 2;

/** Clack Bomb: a round toy-brick grenade, studs on top, fuse, lever and a pull ring. */
export function buildGrenade(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;
  const profile: [number, number][] =
    d >= 1
      ? [[0, -0.036], [0.017, -0.036], [0.026, -0.032], [0.031, -0.024], [0.032, -0.016], [0.0292, -0.0125], [0.032, -0.009], [0.033, 0], [0.032, 0.009], [0.0292, 0.0125], [0.032, 0.016], [0.031, 0.024], [0.027, 0.03], [0.02, 0.033], [0, 0.033]]
      : [[0, -0.036], [0.022, -0.036], [0.032, -0.022], [0.033, 0], [0.032, 0.02], [0.022, 0.033], [0, 0.033]];
  b.add(latheZ(profile, lod.seg), C.body, 'plastic', T(0, 0, 0, UP));
  b.add(tube(0.0334, 0.007, lod.seg, 0.001), C.band, 'plastic', T(0, 0, 0, UP));
  const g = stud(0.0058, 0.0042, lod.segSmall, d >= 1);
  for (const [x, z] of [[0.0125, 0.0125], [-0.0125, 0.0125], [0.0125, -0.0125], [-0.0125, -0.0125]] as const) b.add(g, C.stud, 'plastic', T(x, 0.031, z));
  // Fuse housing and spoon lever down the back.
  b.add(tube(0.0085, 0.017, lod.segSmall, 0.0015), C.fuse, 'metal', T(0, 0.041, 0, UP));
  b.add(box(0.012, 0.0032, 0.028, lod.bevel * 0.5), C.lever, 'metal', T(0, 0.05, 0.012));
  b.add(box(0.012, 0.05, 0.0032, lod.bevel * 0.5), C.lever, 'metal', T(0, 0.024, 0.036, -0.18));
  if (d >= 2) b.add(tube(0.003, 0.016, 8), C.fuse, 'metal', T(0, 0.046, 0.0, 0, Math.PI / 2));

  // Pull pin and ring (animated).
  b.part('pin', new THREE.Vector3(0.01, 0.043, 0));
  b.add(tube(0.0016, 0.03, 8), C.ring, 'metal', aim(0.012, 0.043, 0, 1, 0, 0));
  b.add(torus(0.0105, 0.0019, lod.segSmall + 4), C.ring, 'metal', T(0.0365, 0.043, 0));
  b.node('ring', 0.0365, 0.043, 0);

  b.part('body');
  b.node('grip', 0, 0, 0);
}
