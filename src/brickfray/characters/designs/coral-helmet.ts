import * as THREE from 'three';
import * as S from '../shapes';
import type { PartSet } from '../parts';
import type { V3 } from '../skeleton';
import { BRASS, BRONZE, COPPER, shine, TORSO } from './coral-gear';
import { mounted, rivets, sweep } from './plate-fittings';
import { join, pick, placed, surface, tier, type Spot } from './plate-forms';

const GLASS = '#9fd4e8';
const DARK = '#0e161d';
const STAR = '#3d8fd6';
const ALONG: V3 = [Math.PI / 2, 0, 0];
/** Bonnet sphere in head space. */
const CENTER = new THREE.Vector3(0, 0.1, 0);
const RADIUS = 0.166;

/** Where the corselet's lower edge sits: it dips over the chest and back and rides high on the shoulders. */
const hem = (a: number) => 0.2 - 0.082 * Math.cos(a) ** 2;

/** A band of the suit's chest between two edges that vary around the body, lifted off it. */
function yoke(lower: (a: number) => number, upper: (a: number) => number, lift: number, thick: number, cols: number, rows: number) {
  const n = new THREE.Vector3();
  return surface(
    cols,
    rows,
    (u, v, out) => {
      const a = u * Math.PI * 2;
      const t = TORSO.tAt(lower(a) + (upper(a) - lower(a)) * v);
      TORSO.point(a, t, out).addScaledVector(TORSO.normal(a, t, n), lift);
    },
    { thick, back: false, closed: true, inward: true }
  );
}

/** Copper corselet with a brass brail held down by wing nuts, and the neck ring the helmet locks into. */
export function corselet(b: PartSet) {
  const q = tier(b);
  const cols = pick(b, 12, 20, 36);
  b.add('chest', yoke(hem, () => 0.262, 0.016, 0.014, cols, pick(b, 2, 3, 6)), COPPER, { look: shine(b) });
  b.add('chest', yoke(hem, (a) => hem(a) + 0.026, 0.022, 0.008, cols, 1), BRASS, { look: shine(b) });
  b.lathe(
    'chest',
    [
      [0.112, 0.256],
      [0.128, 0.262],
      [0.132, 0.272],
      [0.132, 0.29],
      [0.126, 0.297],
      [0.11, 0.299]
    ],
    BRONZE,
    { look: shine(b), seg: cols }
  );
  if (q < 2) return;
  const n = q === 3 ? 12 : 8;
  const studs: Spot[] = Array.from({ length: n }, (_, i) => {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const t = TORSO.tAt(hem(a) + 0.013);
    return [TORSO.point(a, t, new THREE.Vector3()).addScaledVector(TORSO.normal(a, t, new THREE.Vector3()), 0.022), TORSO.normal(a, t, new THREE.Vector3())];
  });
  const wings: [number, number][] = [
    [-0.015, 0.009],
    [-0.015, 0.022],
    [-0.004, 0.015],
    [0.004, 0.015],
    [0.015, 0.022],
    [0.015, 0.009]
  ];
  const nut = join(placed(S.cylinder(0.0065, 0.0075, 0.012, 6), [0, 0.006, 0]), placed(new THREE.ExtrudeGeometry(new THREE.Shape(wings.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.004, bevelEnabled: false }), [0, 0, -0.002]));
  b.add('chest', mounted(studs, nut, [0.4, 1, 0]), BRONZE, { look: 'metal' });
  // Lanyard eyes for the front weight.
  b.mirror((_, sign) => b.torus('chest', 0.012, 0.004, BRASS, { ...seat(sign * 0.235, 0.14, 0.026), look: shine(b) }));
}

/** A spot on the corselet front at angle a and height y, as part placement. */
function seat(a: number, y: number, lift: number): { at: V3 } {
  const t = TORSO.tAt(y);
  const p = TORSO.point(a, t, new THREE.Vector3()).addScaledVector(TORSO.normal(a, t, new THREE.Vector3()), lift);
  return { at: [p.x, p.y, p.z] };
}

/** Sphere profile for a lathe, from the neck opening to the crown. */
function dome(n: number): [number, number][] {
  const start = Math.asin(0.118 / RADIUS);
  return Array.from({ length: n + 1 }, (_, i) => {
    const phi = start + ((Math.PI - start) * i) / n;
    return [Math.max(0, Math.sin(phi) * RADIUS), CENTER.y - Math.cos(phi) * RADIUS * (phi > Math.PI / 2 ? 1.03 : 1)] as [number, number];
  });
}

type Bars = 'upright' | 'hash' | 'cross';

/**
 * A round port: flanged brass frame with bolts, dark well, glass and guard bars.
 * Built around +Y (out of the helmet) with +Z up, then seated with `at` and `rot`.
 */
function port(b: PartSet, r: number, bars: Bars, at: V3, rot: V3) {
  const q = tier(b);
  const seg = pick(b, 10, 14, 26);
  const frame: [number, number][] =
    q >= 2
      ? [
          [1.5 * r, -0.034],
          [1.5 * r, 0],
          [1.4 * r, 0.007],
          [1.27 * r, 0.007],
          [1.25 * r, 0.03],
          [1.2 * r, 0.036],
          [1.04 * r, 0.036],
          [r, 0.03],
          [r, -0.03]
        ]
      : [
          [1.5 * r, -0.034],
          [1.4 * r, 0.007],
          [1.22 * r, 0.036],
          [r, 0.03]
        ];
  const brass: THREE.BufferGeometry[] = [S.lathe(frame, seg)];
  if (q >= 2) {
    const count = r > 0.05 ? 8 : q === 3 ? 6 : 4;
    brass.push(rivets(Array.from({ length: count }, (_, i) => {
      const a = ((i + 0.5) / count) * Math.PI * 2;
      return [new THREE.Vector3(Math.sin(a) * 1.335 * r, 0.007, Math.cos(a) * 1.335 * r), new THREE.Vector3(0, 1, 0)] as Spot;
    }), 0.0065, pick(b, 5, 5, 8)));
  }
  const bar = (x: number, across: boolean) => {
    const len = 2 * Math.sqrt((1.06 * r) ** 2 - x * x);
    return placed(S.cylinder(0.0042, 0.0042, len, pick(b, 4, 5, 8)), across ? [0, 0.036, x] : [x, 0.036, 0], across ? [0, 0, Math.PI / 2] : ALONG);
  };
  const xs = bars === 'upright' ? [-0.62 * r, 0, 0.62 * r] : bars === 'hash' ? [-0.36 * r, 0.36 * r] : [0];
  for (const x of q >= 2 || bars === 'upright' ? xs : []) brass.push(bar(x, false));
  if (q >= 2 && bars !== 'upright') for (const x of xs) brass.push(bar(x, true));
  b.add('head', join(...brass), BRONZE, { at, rot, look: 'metal' });
  b.add('head', placed(S.cylinder(r, r, 0.02, seg), [0, 0.008, 0]), DARK, { at, rot, look: 'rubber' });
  b.add('head', placed(S.cylinder(r, r, 0.004, seg), [0, 0.028, 0]), GLASS, { at, rot, look: 'glass' });
}

/** Standard-dress helmet: brass bonnet on a neck ring, four ports, exhaust valve, crown fitting, a starfish stowaway. */
export function helmet(b: PartSet) {
  const q = tier(b);
  const seg = pick(b, 12, 18, 40);
  b.lathe('head', [[0.108, -0.034], ...dome(pick(b, 5, 8, 16))], BRASS, { look: shine(b), seg });
  b.lathe(
    'head',
    [
      [0.104, -0.05],
      [0.126, -0.046],
      [0.13, -0.036],
      [0.13, -0.018],
      [0.124, -0.01],
      [0.112, -0.008]
    ],
    BRONZE,
    { look: shine(b), seg }
  );

  port(b, 0.066, 'upright', [0, 0.095, -0.15], [-Math.PI / 2, 0, 0]);
  b.mirror((_, sign) => {
    b.ball('head', 0.017, '#e9f3ff', { at: [sign * 0.031, 0.1, -0.173], scale: [1, 1.3, 0.5], look: 'glow' });
    port(b, 0.04, 'hash', [sign * 0.153, 0.1, -0.004], [0, 0, sign * -Math.PI / 2]);
  });
  if (q >= 2) port(b, 0.03, 'cross', [0, 0.1 + 0.752 * 0.156, -0.659 * 0.156], [-0.72, 0, 0]);

  // Crown fitting with a lifting eye.
  b.lathe(
    'head',
    [
      [0.05, 0.262],
      [0.05, 0.274],
      [0.043, 0.28],
      [0.036, 0.28],
      [0.036, 0.294],
      [0.042, 0.298],
      [0.042, 0.308],
      [0.032, 0.314],
      [0, 0.314]
    ],
    BRONZE,
    { look: 'metal', seg: pick(b, 8, 12, 20) }
  );
  // Exhaust valve on the right rear quarter.
  const out = new THREE.Vector3(0.7, 0.16, 0.7).normalize();
  const valve: V3 = [Math.acos(out.y), Math.atan2(out.x, out.z), 0];
  const on = (d: number) => CENTER.clone().addScaledVector(out, RADIUS + d).toArray() as V3;
  b.cyl('head', 0.03, 0.036, 0.016, BRONZE, { at: on(0.002), rot: valve, look: 'metal', seg: pick(b, 8, 10, 16) });
  b.cyl('head', 0.014, 0.014, 0.03, COPPER, { at: on(0.02), rot: valve, look: shine(b), seg: pick(b, 6, 8, 12) });
  b.cyl('head', 0.028, 0.028, 0.012, BRASS, { at: on(0.04), rot: valve, look: shine(b), seg: q === 3 ? 12 : 8 });
  if (q < 2) return;

  b.torus('head', 0.016, 0.0045, BRASS, { at: [0, 0.324, 0], rot: [0, Math.PI / 2, 0], look: shine(b) });
  const count = q === 3 ? 18 : 10;
  const base: Spot[] = Array.from({ length: count }, (_, i) => {
    const a = ((i + 0.5) / count) * Math.PI * 2;
    const n = new THREE.Vector3(Math.sin(a), -0.55, -Math.cos(a)).normalize();
    return [CENTER.clone().addScaledVector(n, RADIUS), n];
  });
  b.add('head', rivets(base, 0.0065, pick(b, 5, 5, 8)), BRONZE, { look: 'metal' });
  // Seam strap over the crown from ear to ear.
  const strap: V3[] = Array.from({ length: 9 }, (_, i) => {
    const a = -1.05 + (i / 8) * 2.1;
    return [Math.sin(a) * (RADIUS + 0.002), CENTER.y + Math.cos(a) * (RADIUS + 0.002) * 1.03, 0.03];
  });
  b.add('head', sweep(strap, () => [0.011, 0.003], { seg: pick(b, 8, 12, 24), radial: pick(b, 4, 6, 8), up: [0, 0, 1] }), BRONZE, { look: 'metal' });

  starfish(b);
}

/** A small starfish clinging to the bonnet, on the side the showroom sees. */
function starfish(b: PartSet) {
  const q = tier(b);
  const n = new THREE.Vector3(-0.56, 0.66, -0.5).normalize();
  const spot: Spot = [CENTER.clone().addScaledVector(n, RADIUS * 1.012), n];
  const arms = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const reach = i % 2 ? 0.05 : 0.056;
    return sweep(
      [
        [0, 0.004, 0],
        [c * reach * 0.4, 0.005, s * reach * 0.4],
        [c * reach * 0.78, 0.001, s * reach * 0.78],
        [c * reach, -0.005, s * reach]
      ],
      (t) => [0.0125 - 0.008 * t, 0.0075 - 0.004 * t],
      { seg: q === 3 ? 6 : 3, radial: q === 3 ? 8 : 5, up: [0, 1, 0], caps: true }
    );
  });
  const hub = placed(new THREE.SphereGeometry(0.016, q === 3 ? 10 : 6, q === 3 ? 6 : 4), [0, 0.003, 0], [0, 0, 0], [1, 0.55, 1]);
  b.add('head', mounted([spot], join(...arms, hub), [0.2, 1, 0.4]), STAR, { look: 'plastic' });
  if (q < 3) return;
  const dots: Spot[] = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.floor(i / 2) / 5) * Math.PI * 2 + 0.3;
    const d = i % 2 ? 0.034 : 0.018;
    return [new THREE.Vector3(Math.cos(a) * d, i % 2 ? 0.0075 : 0.011, Math.sin(a) * d), new THREE.Vector3(0, 1, 0)] as Spot;
  });
  b.add('head', mounted([spot], rivets(dots, 0.0028, 5), [0.2, 1, 0.4]), '#bfe2ff', { look: 'plastic' });
}
