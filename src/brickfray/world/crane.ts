import type { Element } from './plan';
import { frameOf, pen, type At, type Pen } from './props-kit';
import { CONTAINER, CONTAINER_SIZE } from './props-harbor';
import { shade, type PlanCollider } from './util';

const YELLOW = '#f2b01d';
const DARK = '#2f363d';
const WHITE = '#e9e6dc';
const LEG_X = 3.3;
const LEG_Z = 1.6;
const PORTAL = 7.2;
/** Bogie height: a step, not a jump, so a runner along the stack is not stopped by the crane's feet. */
const BOGIE = 0.45;
const HOUSE = 8.0;
const PIVOT: [number, number, number] = [0, 10.0, 1.4];
const TIP: [number, number, number] = [0, 17.6, 16.4];
const APEX: [number, number, number] = [0, 15.2, -0.8];

export interface CraneParams extends At {
  /** Height of the hanging load's underside; omit for an empty hook. */
  load?: number;
  loadColor?: string;
}

/** Portal crane on quay rails; walkable under the portal both ways, boom out over the water (+z). */
export const CRANE: Element<CraneParams> = {
  colliders(p) {
    const f = frameOf(p);
    const out: PlanCollider[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push(f.box([sx * LEG_X - 0.8, 0, sz * LEG_Z - 0.35], [sx * LEG_X + 0.8, BOGIE, sz * LEG_Z + 0.35], 'metal'));
        out.push(f.box([sx * LEG_X - 0.3, BOGIE, sz * LEG_Z - 0.3], [sx * LEG_X + 0.3, PORTAL, sz * LEG_Z + 0.3], 'metal'));
      }
    }
    out.push(f.box([-LEG_X - 0.6, PORTAL, -LEG_Z - 0.6], [LEG_X + 0.6, HOUSE, LEG_Z + 0.6], 'metal'));
    out.push(f.box([-2.0, HOUSE, -3.2], [2.0, HOUSE + 2.8, 1.2], 'metal'));
    if (p.load !== undefined) out.push(...loadColliders(p));
    return out;
  },
  draw(d, p) {
    const t = pen(d, p);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        t.box(sx * LEG_X, 0, sz * LEG_Z, 1.6, BOGIE, 0.7, DARK, 'metal', 0.04);
        if (d.detail > 0) for (const wx of [-0.5, 0.5]) t.cylZ(sx * LEG_X + wx, 0.2, sz * LEG_Z, 0.2, 0.76, '#545c63', 'metal');
        t.box(sx * LEG_X, BOGIE, sz * LEG_Z, 0.6, PORTAL - BOGIE, 0.6, YELLOW, 'metal', 0.03);
      }
      t.box(sx * LEG_X, PORTAL - 0.8, 0, 0.5, 0.8, LEG_Z * 2, YELLOW, 'metal', 0.02);
      t.box(sx * LEG_X, 1.0, 0, 0.3, 0.3, LEG_Z * 2 - 0.6, YELLOW, 'metal', 0.02);
    }
    for (const sz of [-1, 1]) {
      t.box(0, PORTAL - 0.8, sz * LEG_Z, LEG_X * 2, 0.8, 0.5, YELLOW, 'metal', 0.02);
      for (const sx of [-1, 1]) t.beam(sx * (LEG_X - 0.3), PORTAL - 2.4, sz * LEG_Z, sx * (LEG_X - 1.8), PORTAL - 0.8, sz * LEG_Z, 0.2, YELLOW, 'metal');
    }
    t.box(0, PORTAL, 0, LEG_X * 2 + 1.2, HOUSE - PORTAL, LEG_Z * 2 + 1.2, DARK, 'metal', 0.04);
    t.cyl(0, HOUSE, 0, 1.6, 0.3, '#545c63', 'metal', 0.04);
    house(t, d.detail);
    boom(t, d.detail);
    if (p.load !== undefined) hook(t, p, d.detail);
    const f = frameOf(p);
    d.anim.blink(f.p(TIP[0], TIP[1] + 0.3, TIP[2]), '#ff3b2f', 0.22);
    d.anim.blink(f.p(APEX[0], APEX[1] + 0.3, APEX[2]), '#ff3b2f', 0.2);
  }
};

function house(t: Pen, detail: number) {
  const y = HOUSE + 0.3;
  t.box(0, y, -1.0, 4.0, 2.5, 4.4, WHITE, 'metal', 0.04);
  t.box(0, y + 2.5, -1.0, 4.2, 0.2, 4.6, shade(WHITE, -0.12), 'metal', 0.02);
  t.box(0, y, -3.6, 3.6, 1.6, 1.2, '#545c63', 'metal', 0.04);
  t.box(1.4, y + 0.4, 1.6, 1.4, 1.9, 1.4, WHITE, 'metal', 0.03);
  t.box(1.4, y + 1.1, 2.32, 1.2, 0.9, 0.04, '#3f6f8f', 'glass', 0);
  for (const sx of [-1, 1]) t.beam(sx * 1.6, y + 2.5, -0.6, APEX[0] + sx * 0.4, APEX[1], APEX[2], 0.26, YELLOW, 'metal');
  t.beam(0, y + 2.5, -2.8, APEX[0], APEX[1], APEX[2], 0.22, YELLOW, 'metal');
  t.box(0, y + 1.6, 1.22, 4.0, 0.3, 0.04, YELLOW, 'metal', 0);
  if (detail === 0) return;
  t.box(2.12, y + 1.1, 1.6, 0.04, 0.9, 1.1, '#3f6f8f', 'glass', 0);
  for (const x of [-1.2, -0.4, 0.4]) t.box(x, y + 0.8, 1.22, 0.5, 0.9, 0.05, '#b7bcc2', 'metal', 0);
}

function boom(t: Pen, detail: number) {
  const [px, py, pz] = PIVOT;
  const [tx, ty, tz] = TIP;
  const w0 = 0.9;
  const w1 = 0.3;
  const h0 = 1.0;
  const h1 = 0.4;
  const at = (u: number, sx: number, sy: number): [number, number, number] => {
    const w = w0 + (w1 - w0) * u;
    const h = h0 + (h1 - h0) * u;
    return [px + (tx - px) * u + sx * w, py + (ty - py) * u + sy * h, pz + (tz - pz) * u];
  };
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const a = at(0, sx, sy);
    const b = at(1, sx, sy);
    t.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.16, YELLOW, 'metal');
  }
  const n = detail === 2 ? 14 : 8;
  for (let i = 0; i < n; i++) {
    const u0 = i / n;
    const u1 = (i + 1) / n;
    for (const sx of [-1, 1]) {
      const a = at(u0, sx, i % 2 ? -1 : 1);
      const b = at(u1, sx, i % 2 ? 1 : -1);
      t.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.08, YELLOW, 'metal');
    }
    for (const sy of [-1, 1]) {
      const a = at(u0, i % 2 ? -1 : 1, sy);
      const b = at(u1, i % 2 ? 1 : -1, sy);
      t.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.07, YELLOW, 'metal');
    }
  }
  t.box(tx, ty - 0.5, tz, 0.9, 0.9, 0.9, DARK, 'metal', 0.05);
  for (const sx of [-1, 1]) t.beam(APEX[0] + sx * 0.3, APEX[1], APEX[2], tx + sx * 0.2, ty + 0.3, tz, 0.05, '#1b1f23', 'metal');
}

function loadColliders(p: CraneParams): PlanCollider[] {
  const f = frameOf(p);
  const y = p.load!;
  const { length: L, width: W, height: H } = CONTAINER_SIZE;
  return [f.box([-L / 2, y, TIP[2] - W / 2], [L / 2, y + H, TIP[2] + W / 2], 'metal')];
}

function hook(t: Pen, p: CraneParams, detail: number) {
  const y = p.load!;
  const { length: L, height: H } = CONTAINER_SIZE;
  const [tx, ty, tz] = TIP;
  for (const sx of [-1, 1]) t.beam(tx + sx * 0.15, ty - 0.5, tz, tx + sx * 0.15, y + H + 1.2, tz, 0.04, '#1b1f23', 'metal');
  t.box(tx, y + H + 0.9, tz, 0.7, 0.5, 0.5, YELLOW, 'metal', 0.04);
  t.box(tx, y + H + 0.1, tz, L - 0.2, 0.2, 2.2, YELLOW, 'metal', 0.02);
  for (const sx of [-1, 1]) t.beam(tx, y + H + 0.9, tz, tx + sx * (L / 2 - 0.4), y + H + 0.3, tz, 0.05, '#1b1f23', 'metal');
  CONTAINER.draw(t.d, { color: p.loadColor ?? '#2f7fbf', ...stand(p, y, tz) });
}

function stand(p: CraneParams, y: number, z: number) {
  const f = frameOf(p);
  const [x, , wz] = f.p(0, 0, z);
  return { x, y: (p.y ?? 0) + y, z: wz, turns: p.turns ?? 0 };
}
