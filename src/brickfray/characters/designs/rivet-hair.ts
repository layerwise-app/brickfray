import * as THREE from 'three';
import { onFace } from '../body-head';
import type { PartSet } from '../parts';
import * as S from '../shapes';
import type { V3 } from '../skeleton';
import { surface } from './plate-forms';
import { C } from './rivet-vest';
import { SKULL, strand, tier } from './tailor';

const HALF = Math.PI / 2;
const { lerp, smoothstep } = THREE.MathUtils;
const STUBBLE = `#${new THREE.Color(C.hair).lerp(new THREE.Color(C.skin), 0.55).getHexString()}`;
const SHEEN = `#${new THREE.Color(C.hair).multiplyScalar(1.14).getHexString()}`;

/** Short hair under the hat, sideburns, a moustache and a carpenter's pencil behind the ear. */
export function headKit(b: PartSet) {
  const y1 = 0.19;
  const span = HALF + 0.52;
  // Hairline from the back of the head (angle from the front): a rounded nape, rising behind the ears to the temples.
  const line = (a: number) => -0.012 + 0.124 * smoothstep(Math.abs(a - Math.PI) / span, 0.1, 0.78) ** 3;
  const around = (u: number) => Math.PI + (u * 2 - 1) * span;
  const cols = tier(b, 14, 20, 96);
  // Thins to nothing at its edges rather than ending in a step, over a faded band of stubble.
  const crop = surface(cols, tier(b, 4, 5, 9), (u, v, out) => {
    const a = around(u);
    const y = lerp(line(a), y1, v ** 1.7);
    const edge = smoothstep(y - line(a), 0, 0.02) * smoothstep(span - Math.abs(a - Math.PI), 0, 0.25);
    SKULL.point(y, a, 0.0018 + 0.0065 * edge, out);
  }, { inward: true });
  b.add('head', crop, C.hair, { look: 'cloth' });
  if (b.hero) combLines(b, line);
  if (b.detail >= 2) b.add('head', surface(cols, 2, (u, v, out) => SKULL.point(line(around(u)) + lerp(-0.014, 0.006, v), around(u), 0.0009, out), { inward: true }), STUBBLE, { look: 'cloth' });
  b.mirror((_, sign) => {
    b.add('head', sideburn(b, sign), C.hair, { look: 'cloth' });
    onFace(b, S.blob(0.056, 0.026, 0.028, 0.7, tier(b, 6, 8, 14)), C.hair, { at: [sign * 0.024, 0.014, -0.128], rot: [0, 0, sign * -0.3], look: 'cloth' });
  });
  if (b.detail < 2) return;
  // Pencil over his left ear.
  const at: V3 = [-0.131, 0.118, -0.012];
  const rot: V3 = [HALF + 0.12, 0.1, 0];
  const along = (d: number): V3 => [at[0] + Math.sin(0.1) * d, at[1] + Math.sin(0.12) * d, at[2] - d];
  b.cyl('head', 0.0052, 0.0052, 0.1, C.yellow, { at, rot, look: 'gloss', seg: 6 });
  b.cyl('head', 0.0052, 0.001, 0.016, '#e9c9a0', { at: along(0.058), rot, look: 'cloth', seg: 6 });
  b.cyl('head', 0.005, 0.005, 0.012, '#e88a8a', { at: along(-0.056), rot, look: 'rubber', seg: 6 });
  if (b.hero) b.cyl('head', 0.0056, 0.0056, 0.008, C.steel, { at: along(-0.05), rot, look: 'chrome', seg: 6 });
}

/** Close-up, the cropped back of the head shows its grain: short combed ridges sweeping down and in to the nape. */
function combLines(b: PartSet, line: (a: number) => number) {
  const n = 17;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / (n - 1) - 0.5) * 2.5;
    const jitter = Math.sin(i * 12.9898) * 0.5;
    const top = 0.128 - 0.006 * Math.abs(jitter);
    const bottom = line(a0) + 0.016 + 0.006 * jitter;
    const stops: [number, number, number][] = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      stops.push([lerp(top, bottom, t), a0 + (Math.PI - a0) * 0.12 * t * t + 0.04 * jitter * t, 0.0082]);
    }
    const width = 0.0055 + 0.0012 * jitter;
    b.add('head', strand(SKULL.path(stops), (t) => width * Math.sin(Math.PI * t) ** 0.6, { flat: 0.45, side: SKULL.around(lerp(top, bottom, 0.5), a0), seg: 8, radial: 6 }), SHEEN, { look: 'cloth' });
  }
}

/**
 * A full sideburn grown out of the temple hair under the brim: it hugs the skull in front of the ear, swells like the
 * moustache's lobes and ends in a rounded tip at the jaw, thinning to nothing at its edges so it never reads as a stuck-on piece.
 */
function sideburn(b: PartSet, sign: number) {
  const tip = (v: number) => (v < 0.24 ? Math.sqrt(1 - (1 - v / 0.24) ** 2) : 1);
  // Close up it is combed into a few locks running down to the jaw, so it reads as hair rather than a flat pad.
  const combed = (across: number, v: number) => (b.hero ? 1 + 0.38 * Math.cos(across * Math.PI * 3.5 + 0.6 + v * 1.2) * (0.4 + 0.6 * smoothstep(v, 0.05, 0.5)) : 1);
  return surface(tier(b, 4, 6, 30), tier(b, 6, 8, 34), (u, v, out) => {
    const front = HALF - 0.62 - 0.12 * (1 - smoothstep(v, 0.12, 0.6));
    const back = HALF - lerp(0.2, 0.12, v) + 0.55 * smoothstep(v, 0.55, 1);
    const across = (sign > 0 ? u : 1 - u) * 2 - 1;
    const a = (front + back) / 2 + (across * (back - front) * tip(v)) / 2;
    const swell = (1 - across * across) ** 0.7 * tip(v) ** 0.5 * (1 - 0.6 * smoothstep(v, 0.75, 1)) * (1.15 - 0.3 * v);
    SKULL.point(lerp(0.034, 0.16, v), sign * a, 0.0008 + (b.hero ? 0.0105 : 0.009) * swell * combed(across, v), out);
  }, { inward: true });
}
