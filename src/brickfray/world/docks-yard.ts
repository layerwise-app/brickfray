import { CRANE } from './crane';
import { containerSlot } from './docks-ground';
import type { Plan } from './plan';
import { CONTAINER, CONTAINER_SIZE, CRATE, BARREL, LIFEBUOY, MOORING, PALLET, PLANKS, ROPE, crateStack } from './props-harbor';
import { BOLLARD, CONE, LAMP } from './props-street';
import { FORKLIFT, VAN } from './props-vehicles';
import { METAL_STAIRS } from './warehouse';

const H = CONTAINER_SIZE.height;
const WEST = ['#c0392b', '#e67e22', '#d9b93a', '#8e5a9a'];
const EAST = ['#2f7fbf', '#16a085', '#2e8b57', '#7f8c8d'];
const YARD_STAIR = { y0: 0, width: 1.6, steps: 6, rise: H / 6, run: 0.6, style: { colors: ['#8a9096'], variance: 0 }, surface: 'metal' as const };

/** Container yard and quay life; mirrored about x = 0 with each side in its own colors. */
export function docksYard(p: Plan) {
  for (const s of [-1, 1] as const) {
    const pal = s < 0 ? WEST : EAST;
    const c = (x: number, z: number, color: string, o: { turns?: number; y?: number; open?: boolean; walk?: boolean } = {}) => {
      if (!o.y && z > -14.4) containerSlot(p, s * x, z, o.turns, CONTAINER_SIZE.length, CONTAINER_SIZE.width);
      p.add(CONTAINER, { x: s * x, z, color, turns: o.turns, y: o.y, open: o.open, walk: o.walk });
    };
    c(1.2, -3.2, s < 0 ? '#c0392b' : '#2f7fbf', { turns: 1 });
    c(1.2, -3.2, s < 0 ? '#e67e22' : '#16a085', { turns: 1, y: H });
    c(12.8, -10.4, pal[0]!);
    c(12.8, -10.4, pal[2]!, { y: H });
    c(21.2, -10.4, pal[1]!, { open: true });
    c(12.8, -3.2, pal[3]!, { walk: true });
    p.add(METAL_STAIRS, { ...YARD_STAIR, x: s * 6.2, z: -3.2, dir: s < 0 ? 'w' : 'e' });
    c(21.6, -3.2, pal[2]!, { turns: 1 });
    c(21.6, -3.2, pal[0]!, { turns: 1, y: H });
    c(8.8, 2.4, pal[1]!, { open: true });
    c(8.8, 2.4, pal[3]!, { y: H });
    for (const k of crateStack({ x: s * 3.2, z: 2.0 }, [0, 1.2].flatMap((dz) => [{ dx: 0, dz, level: 0, size: 'large' as const }, { dx: 0, dz, level: 1.12, size: 'large' as const }]))) p.add(k.el, k.p);
    c(17.6, 2.4, pal[0]!);
    c(17.6, 2.4, pal[1]!, { y: H });
    c(14.0, 8.8, pal[0]!);
    c(14.0, 8.8, pal[2]!, { y: H });
    for (const [z, a, b] of [[-21.0, 0, 2], [-10.6, 3, 1], [-1.4, 1, 0], [4.6, 2, 3]] as const) {
      c(26.4, z, pal[a]!, { turns: 1 });
      c(26.4, z, pal[b]!, { turns: 1, y: H });
    }
    c(33.2, 8.8, pal[2]!);
    c(20.0, -14.6, pal[2]!, { turns: 1 });
    c(20.0, -14.6, pal[3]!, { turns: 1, y: H });
    c(24.0, -25.2, pal[3]!);
    c(24.0, -25.2, pal[1]!, { y: H });

    p.add(PALLET, { x: s * 3.2, z: -11.6, load: 'sacks' });
    p.add(PALLET, { x: s * 3.2, z: -12.6, load: 'boxes', turns: 0 });
    for (const k of crateStack({ x: s * 6.4, z: -7.6 }, [{ dx: 0, dz: 0, level: 0, size: 'large' }, { dx: 0.9, dz: 0.3, level: 0 }])) p.add(k.el, k.p);
    p.add(FORKLIFT, { x: s * 32.4, z: -15.2, turns: 1, color: s < 0 ? '#f6c624' : '#f05a1a' });
    p.add(PALLET, { x: s * 32.4, z: -17.6, load: 'boxes' });
    p.add(VAN, { x: s * 22.4, z: -18.8, turns: 1, color: s < 0 ? '#e9e6dc' : '#d9b93a', stripe: s < 0 ? '#c0392b' : '#2f7fbf' });
    p.add(PLANKS, { x: s * 33.2, z: -27.4, layers: 5 });
    for (const k of crateStack({ x: s * 35.0, z: -9.6 }, [{ dx: 0, dz: 0, level: 0, size: 'large' }, { dx: 0, dz: 1.2, level: 0, size: 'large' }, { dx: 0, dz: 0.6, level: 1.12 }])) p.add(k.el, k.p);
    for (const [x, z] of [[23.6, 4.0], [22.9, 4.6], [23.8, 4.8]] as const) p.add(BARREL, { x: s * x, z, kind: 'drum', color: s < 0 ? '#c0392b' : '#2f7fbf' });
    p.add(PALLET, { x: s * 19.6, z: 5.6, load: 'sacks', turns: 1 });

    for (const x of [6.4, 18.4, 28.8]) p.add(MOORING, { x: s * x, z: 9.5 });
    p.add(ROPE, { x: s * 10.4, z: 8.8 });
    p.add(ROPE, { x: s * 20.8, z: 8.6 });
    p.add(LIFEBUOY, { x: s * 21.8, z: 9.7, turns: 2 });
    for (const k of crateStack({ x: s * 21.2, z: 6.4 }, [{ dx: 0, dz: 0, level: 0, size: 'large' }, { dx: s * 1.2, dz: 0, level: 0 }])) p.add(k.el, k.p);
    p.add(LAMP, { x: s * 16.0, z: 4.8 });
    p.add(LAMP, { x: s * 35.2, z: 6.8 });
    p.add(LAMP, { x: s * 16.0, z: -12.8 });
    for (const z of [12.8, 17.6]) p.add(MOORING, { x: s * 25.2, z });
    p.add(MOORING, { x: s * 25.2, z: 22.8 });
    p.add(ROPE, { x: s * 22.9, z: 18.8 });
    p.add(CRATE, { x: s * 23.2, z: 13.6, size: 'large' });
    p.add(LIFEBUOY, { x: s * 12.0, z: 23.0, turns: 2 });
    p.add(BARREL, { x: s * 18.0, z: 21.0 });
    p.add(BARREL, { x: s * 18.6, z: 21.4 });
    for (const x of [35.2, 35.8]) p.add(CONE, { x: s * x, z: 9.4 });
    p.add(BOLLARD, { x: s * 14.4, z: -14.0, color: '#f6c624' });
  }
  const block = (z: number, rows: number[]) => {
    for (const k of crateStack({ x: 0, z }, [-0.6, 0.6].flatMap((dx) => rows.flatMap((dz) => [{ dx, dz, level: 0, size: 'large' as const }, { dx, dz, level: 1.12, size: 'large' as const }])))) p.add(k.el, k.p);
  };
  block(-8.0, [-1.2, 0, 1.2]);
  for (const k of crateStack({ x: 0, z: 0.4 }, [{ dx: 0, dz: 0, level: 0, size: 'large' }, { dx: 0, dz: 0, level: 1.12, size: 'large' }])) p.add(k.el, k.p);
  p.add(CRANE, { x: 0, z: 7.6, load: 9.6, loadColor: '#e67e22' });
  for (const k of crateStack({ x: 1.0, z: 10.6 }, [{ dx: 0, dz: 0, level: 0, size: 'large' }, { dx: 0, dz: 0, level: 1.12, size: 'large' }])) p.add(k.el, k.p);
  for (const z of [12.4, 16.8]) p.add(MOORING, { x: 1.2, z });
  p.add(ROPE, { x: -0.9, z: 14.8 });
}
