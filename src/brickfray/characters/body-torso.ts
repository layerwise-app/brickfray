import { even, type BodyKit } from './body-kit';
import * as S from './shapes';

/** Hips, waist, ribcage with a collar, neck and belt: three rigid shells that overlap at the waist joints. */
export function torso(k: BodyKit) {
  const { b, s, omit, bulk, shirtLook, pantsLook, steps, fine } = k;
  const n = b.hero ? 28 : even(b.seg(8, 12, 16));
  const hips = Math.min(bulk, 1.05);

  if (!omit.has('hips')) {
    b.add(
      'pelvis',
      S.loft(
        [
          { y: -0.122, rx: 0.088, rz: 0.08, e: 2.5 },
          { y: -0.075, rx: 0.131 * hips, rz: 0.09, e: 2.8 },
          { y: -0.02, rx: 0.146 * hips, rz: 0.096, e: 3 },
          { y: 0.04, rx: 0.153 * hips, rz: 0.099, e: 3 }
        ],
        n,
        { steps, bottom: 0.03, top: 0.012 }
      ),
      s.pants,
      { look: pantsLook }
    );
  }
  if (!omit.has('belt') && s.belt) belt(k, hips);
  if (!omit.has('abdomen')) {
    b.add(
      'spine',
      S.loft(
        [
          { y: -0.06, rx: 0.136 * hips, rz: 0.088, e: 2.8 },
          { y: 0.04, rx: 0.132 * bulk, rz: 0.086, e: 2.7 },
          { y: 0.14, rx: 0.142 * bulk, rz: 0.089, e: 2.8 }
        ],
        n,
        { steps, bottom: 0.014, top: 0.02 }
      ),
      s.shirt,
      { look: shirtLook }
    );
  }
  if (!omit.has('chest')) {
    b.add(
      'chest',
      S.loft(
        [
          { y: -0.028, rx: 0.15 * bulk, rz: 0.094, e: 2.9 },
          { y: 0.05, rx: 0.165 * bulk, rz: 0.099, back: 0.097, e: 3 },
          { y: 0.13, rx: 0.18 * bulk, rz: 0.1035, back: 0.101, e: 3 },
          { y: 0.19, rx: 0.19 * bulk, rz: 0.1055, back: 0.104, e: 3.1 },
          { y: 0.226, rx: 0.15 * bulk, rz: 0.086, back: 0.088, e: 2.7 },
          { y: 0.257, rx: 0.088, rz: 0.066, back: 0.07, e: 2.3 }
        ],
        n,
        { steps, bottom: 0.018, top: 0.008 }
      ),
      s.shirt,
      { look: shirtLook }
    );
    if (fine && !omit.has('neck')) {
      b.add(
        'chest',
        S.loft(
          [
            { y: 0.25, rx: 0.07, rz: 0.064, e: 2.2 },
            { y: 0.268, rx: 0.066, rz: 0.061, e: 2.2 },
            { y: 0.276, rx: 0.062, rz: 0.057, e: 2.2 }
          ],
          b.hero ? 20 : 12,
          { top: 0.004 }
        ),
        s.shirt,
        { look: shirtLook }
      );
    }
  }
  if (!omit.has('neck')) {
    b.add(
      'neck',
      S.loft(
        [
          { y: -0.03, rx: 0.052, rz: 0.05 },
          { y: 0.02, rx: 0.046, rz: 0.046 },
          { y: 0.085, rx: 0.049, rz: 0.05 }
        ],
        b.hero ? 18 : even(b.seg(6, 10, 12)),
        { steps: Math.min(steps, 2) }
      ),
      s.skin,
      { look: 'skin' }
    );
  }
}

function belt(k: BodyKit, hips: number) {
  const { b, s, pantsLook, fine } = k;
  const color = s.belt!;
  const buckle = s.buckle ?? '#c9b27a';
  const rx = 0.1625 * hips;
  const rz = 0.1075;
  const e = 3.2;
  const lip = b.hero ? 0.004 : 0;
  const ring = (y: number, grow: number) => ({ y, rx: rx + grow, rz: rz + grow, e });
  const rings = lip ? [ring(0.009, -lip), ring(0.009 + lip, 0), ring(0.061 - lip, 0), ring(0.061, -lip)] : [ring(0.01, 0), ring(0.06, 0)];
  b.add('pelvis', S.loft(rings, b.hero ? 28 : even(b.seg(8, 12, 16))), color, { look: 'rubber' });
  const front = -(rz + 0.003);
  if (!fine) {
    b.box('pelvis', [0.06, 0.042, 0.02], buckle, { at: [0, 0.035, front], look: 'metal' });
    return;
  }
  b.box('pelvis', [0.064, 0.048, 0.014], buckle, { at: [0, 0.035, front], look: 'metal', bevel: 0.006 });
  if (!b.hero) return;
  b.box('pelvis', [0.04, 0.026, 0.012], color, { at: [0, 0.035, front - 0.004], look: 'rubber', bevel: 0.003 });
  b.box('pelvis', [0.034, 0.007, 0.008], buckle, { at: [0.004, 0.035, front - 0.009], look: 'metal', bevel: 0.002 });
  for (const x of [-0.092, 0.092]) {
    const z = rz * Math.pow(1 - Math.pow(Math.abs(x) / 0.1625, e), 1 / e) + 0.003;
    for (const side of [-1, 1]) b.box('pelvis', [0.014, 0.066, 0.008], s.pants, { at: [x * hips, 0.035, side * z], look: pantsLook, bevel: 0.003 });
  }
}
