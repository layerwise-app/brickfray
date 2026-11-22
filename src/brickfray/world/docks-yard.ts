import { CRANE } from './crane';
import { containerSlot } from './docks-ground';
import type { Element, Plan } from './plan';
import { Pen } from './props-kit';
import { CONTAINER, CONTAINER_SIZE, BARREL, LIFEBUOY, MOORING, PALLET, PLANKS, ROPE, crateStack } from './props-harbor';
import { BOLLARD, CONE, LAMP } from './props-street';
import { FORKLIFT, VAN } from './props-vehicles';
import { box, Frame } from './util';
import { METAL_STAIRS } from './warehouse';

const H = CONTAINER_SIZE.height;
const WEST = ['#c0392b', '#e67e22', '#d9b93a', '#8e5a9a'];
const EAST = ['#2f7fbf', '#16a085', '#2e8b57', '#7f8c8d'];
/** The crane portal's z: its legs stand on the crane rails, their feet clear of the quay rail. */
export const CRANE_Z = 7.1;
/** Stacks standing on the quay edge (x of their centres on the east side, mirrored west): the quay rail stops at them. */
export const QUAY_STACKS = [14.0, 33.2];
const YARD_STAIR = { y0: 0, width: 1.6, steps: 6, rise: H / 6, run: 0.6, style: { colors: ['#8a9096'], variance: 0 }, surface: 'metal' as const };

/** A yard top's second way up, from the quay side: a stair climbing north to a steel landing flush with the container top. */
const TOP_STAIR: Element<{ x: number }> = {
  colliders(p) {
    const out = METAL_STAIRS.colliders!(topStair(p.x));
    out.push(box([p.x - 0.8, H - 0.16, -5.2], [p.x + 0.8, H, -4.0], 'metal', { walk: true }));
    return out;
  },
  nav: (p) => METAL_STAIRS.nav?.(topStair(p.x)) ?? [],
  draw(d, p) {
    METAL_STAIRS.draw(d, topStair(p.x));
    const t = new Pen(d, new Frame(p.x, 0, -4.6));
    t.box(0, H - 0.16, 0, 1.6, 0.16, 1.2, '#8a9096', 'metal', 0.01);
    t.box(0, H - 0.3, -0.56, 1.6, 0.14, 0.08, '#f6c624', 'metal', 0);
    for (const x of [-0.72, 0.72]) t.box(x, 0, -0.52, 0.1, H - 0.16, 0.1, '#545c63', 'metal', 0);
  }
};
const topStair = (x: number) => ({ ...YARD_STAIR, x, z: -0.4, dir: 'n' as const });

/** Tally clerk's hut at the head of the crane road: white walls under a red roof, the yard's landmark at eye level. */
const HUT: Element<{ x: number; z: number }> = {
  colliders: (p) => [box([p.x - 1.0, 0, p.z - 0.8], [p.x + 1.0, 2.8, p.z + 0.8], 'wood')],
  draw(d, p) {
    const t = new Pen(d, new Frame(p.x, 0, p.z));
    const glass = '#26323a';
    t.box(0, 0, 0, 2.0, 0.3, 1.6, '#545c63', undefined, 0.01);
    t.box(0, 0.3, 0, 1.9, 2.2, 1.5, '#efe9dc', undefined, 0.02);
    t.box(0, 2.5, 0, 2.3, 0.18, 1.9, '#c0392b', undefined, 0.02);
    t.box(0, 2.68, 0, 2.0, 0.12, 1.6, '#a93226', undefined, 0.01);
    t.box(0, 2.8, 0.3, 1.6, 0.5, 0.08, '#f6c624', undefined, 0.01);
    t.box(-0.45, 0.3, 0.76, 0.7, 1.8, 0.04, '#2f7fbf', undefined, 0.01);
    t.box(0.45, 1.2, 0.76, 0.7, 0.7, 0.04, glass, undefined, 0.01);
    for (const sx of [-1, 1]) t.box(sx * 0.96, 1.2, 0, 0.04, 0.7, 1.0, glass, undefined, 0.01);
    for (let i = 0; i < 5; i++) t.box(-0.8 + i * 0.4, 0.3, 0.77, 0.2, 0.16, 0.04, i % 2 ? '#23272b' : '#f6c624', undefined, 0);
    if (d.detail > 0) t.box(-0.45, 2.2, 0.82, 0.3, 0.08, 0.1, '#fff1c4', 'glow', 0);
  }
};

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
    // The second way up keeps the yard top from being a dead end, and it can be taken from below the top's edge.
    p.add(TOP_STAIR, { x: s * 16.6 });
    p.navSeeds.push([s * 15.2, H, -3.6]);
    // Two crates high against the stair's open side at its foot: the low treads are boarded only from the front.
    for (const k of crateStack({ x: s * 15.2, z: -1.0 }, [0, 1.12].map((level) => ({ dx: 0, dz: 0, level, size: 'large' as const })))) p.add(k.el, k.p);
    c(21.6, -3.2, pal[2]!, { turns: 1 });
    c(21.6, -3.2, pal[0]!, { turns: 1, y: H });
    c(8.8, 2.4, pal[1]!, { open: true });
    c(8.8, 2.4, pal[3]!, { y: H });
    for (const k of crateStack({ x: s * 3.2, z: 2.0 }, [0, 1.2].flatMap((dz) => [{ dx: 0, dz, level: 0, size: 'large' as const }, { dx: 0, dz, level: 1.12, size: 'large' as const }]))) p.add(k.el, k.p);
    c(17.6, 2.4, pal[0]!);
    c(17.6, 2.4, pal[1]!, { y: H });
    c(QUAY_STACKS[0]!, 8.8, pal[0]!);
    c(QUAY_STACKS[0]!, 8.8, pal[2]!, { y: H });
    for (const [z, a, b] of [[-21.0, 0, 2], [-10.6, 3, 1], [-1.4, 1, 0], [4.6, 2, 3]] as const) {
      c(26.4, z, pal[a]!, { turns: 1 });
      c(26.4, z, pal[b]!, { turns: 1, y: H });
    }
    c(QUAY_STACKS[1]!, 8.8, pal[2]!);
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
    p.add(PALLET, { x: s * 18.8, z: 4.0, load: 'sacks' });

    for (const x of [6.4, 28.8]) p.add(MOORING, { x: s * x, z: 8.8 });
    p.add(ROPE, { x: s * 10.4, z: 8.4 });
    p.add(ROPE, { x: s * 20.8, z: 8.6 });
    p.add(LIFEBUOY, { x: s * 21.8, z: 9.7, turns: 2 });
    for (const k of crateStack({ x: s * 21.2, z: 6.6 }, [0, 1.12].flatMap((level) => [{ dx: 0, dz: 0, level, size: 'large' as const }, { dx: s * 1.2, dz: 0, level, size: 'large' as const }]))) p.add(k.el, k.p);
    p.add(LAMP, { x: s * 16.0, z: 4.8 });
    p.add(LAMP, { x: s * 35.2, z: 6.8 });
    p.add(LAMP, { x: s * 16.0, z: -12.8 });
    p.add(ROPE, { x: s * 22.4, z: 15.2 });
    p.add(LIFEBUOY, { x: s * 20.4, z: 23.0, turns: 2 });
    for (const x of [35.2, 35.8]) p.add(CONE, { x: s * x, z: 8.8 });
    p.add(BOLLARD, { x: s * 14.4, z: -14.0, color: '#f6c624' });
  }
  const block = (z: number, rows: number[]) => {
    for (const k of crateStack({ x: 0, z }, [-0.6, 0.6].flatMap((dx) => rows.flatMap((dz) => [{ dx, dz, level: 0, size: 'large' as const }, { dx, dz, level: 1.12, size: 'large' as const }])))) p.add(k.el, k.p);
  };
  block(-8.0, [-2.4, -1.2, 0, 1.2]);
  p.add(HUT, { x: 0, z: 0.6 });
  p.add(CRANE, { x: 0, z: CRANE_Z, load: 9.6, loadColor: '#e67e22' });
  // Cargo set down under the portal: it breaks the crane road's base-to-base line and the warehouse-to-boat lines.
  block(CRANE_Z, [-0.6, 0.6]);
  p.add(ROPE, { x: -0.88, z: 14.6 });
}
