import * as THREE from 'three';
import type { CharacterInfo } from '../../characters/types';

/** Below this colour difference (CIE76) an accent is too close to the glove to stand out on a gun of the glove's colour. */
const DISTINCT = 40;

/**
 * The first-person glove's knuckle pads and finger plates: the character's accent that differs most from the glove,
 * so a hand never melts into a gun painted like it; when neither accent stands out, a lighter or darker glove.
 */
export function padColor(info: CharacterInfo): THREE.Color {
  const glove = new THREE.Color(info.glove);
  const base = lab(glove);
  let best = glove.clone();
  let most = 0;
  for (const hex of [info.secondary, info.primary]) {
    const c = new THREE.Color(hex);
    const d = distance(lab(c), base);
    if (d > most) {
      most = d;
      best = c;
    }
  }
  if (most >= DISTINCT) return best;
  return base[0] > 55 ? glove.clone().multiplyScalar(0.3) : glove.clone().lerp(new THREE.Color(1, 1, 1), 0.5);
}

/** CIE L*a*b* of a linear-RGB colour (D65). */
function lab(c: THREE.Color): [number, number, number] {
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * c.r + 0.3576 * c.g + 0.1805 * c.b) / 0.9505);
  const y = f(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
  const z = f((0.0193 * c.r + 0.1192 * c.g + 0.9505 * c.b) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function distance(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}
