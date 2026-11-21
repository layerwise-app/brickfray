import type { Cluster } from './stage-kit';

/** A brick core with slopes falling away from it on its four sides (two on `x` only when `sides` is 2). */
export const skirt = (c: Cluster, x: number, y: number, core: number, depth: number, h: number, o: { z?: number; yaw?: number; accent?: boolean; sides?: 2 | 4 } = {}) => {
  const P = c.pitch;
  const z = o.z ?? 0;
  const yaw = o.yaw ?? 0;
  if (core > 0) c.brick(x, y, core, depth, h, { z, yaw, accent: o.accent });
  const reach = (core / 2 + 1) * P;
  for (let k = 0; k < (o.sides ?? 4); k++) {
    // Each slope falls outward: yaw π/2 falls toward +x, -π/2 toward -x, 0 toward the lens, π away from it.
    const fall = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][k]! + yaw;
    const along = k < 2 ? depth : core;
    if (along <= 0) continue;
    const dx = Math.sin(fall) * reach;
    const dz = Math.cos(fall) * reach;
    c.slope(x + dx, y, along, 2, h, { z: z + dz, yaw: fall, accent: o.accent, studs: false });
  }
};

/** A brick pine: a round trunk and skirted tiers, each narrower and overhanging the one below, under a cone tip. */
export const pine = (c: Cluster, x: number, h: number, z = 0) => {
  const tiers = h >= 1 ? 4 : h >= 0.7 ? 3 : 2;
  c.shadow(x, h * 0.28, z).round(x, 0, 1, 4, { z, accent: true, studs: false });
  let y = c.plates(4);
  for (let k = 0; k < tiers; k++) {
    const core = tiers - k;
    skirt(c, x, y, core, core, 8, { z, yaw: (k % 2) * (Math.PI / 4) });
    y += c.plates(8);
  }
  c.round(x, y, 1.2, 4, { z, top: 0.3, studs: false });
};

/** A brick mountain: courses of bricks two high, each with slopes falling off both ends, narrowing to a peak; the top course in the accent (snow). */
export const peak = (c: Cluster, x: number, core: number, depth: number, z = 0) => {
  c.shadow(x, (core + 4) * c.pitch * 0.55, z);
  let y = 0;
  for (let w = core; w >= 0; w -= 4) {
    skirt(c, x, y, w, depth, 6, { z, accent: w < 4, sides: 2 });
    y += c.plates(6);
  }
  c.brick(x, y, 2, 2, 2, { z, accent: true });
};

/** A far skyline in the haze behind a set: stacks `[x, studs wide, plates tall]` of bricks standing in a loose row. */
export const skyline = (c: Cluster, stacks: [number, number, number][]) => {
  for (const [x, w, h] of stacks) c.shadow(x, w * c.pitch * 0.8).brick(x, 0, w, 2, h);
};

/** A round tower of stacked round bricks with a ring of battlements; `roof` adds a stepped cone and a pennant. */
export const tower = (c: Cluster, x: number, size: number, courses: number, roof: boolean) => {
  const P = c.pitch;
  const r = (size * P) / 2;
  c.shadow(x, r * 1.6);
  for (let i = 0; i < courses; i++) c.round(x, i * c.plates(3), size, 3, { studs: false });
  const top = courses * c.plates(3);
  c.ring(x, top, r + P * 0.35, r - P * 0.9);
  const merlons = Math.round((Math.PI * 2 * r) / (P * 1.6));
  for (let i = 0; i < merlons; i++) {
    const a = (i / merlons) * Math.PI * 2;
    c.brick(x + Math.cos(a) * (r - P * 0.1), top + c.plates(1), 1, 1, 3, { z: -Math.sin(a) * (r - P * 0.1), yaw: a });
  }
  for (const z of [r * 0.98]) c.brick(x, top * 0.62, 1, 1, 5, { z, accent: true, studs: false });
  if (!roof) return;
  let y = top + c.plates(1);
  for (const [d, h] of [[size + 0.6, 2], [size - 0.4, 2], [size - 1.4, 2], [Math.max(1, size - 2.4), 3], [1, 3]] as const) {
    c.round(x, y, d, h, { top: d > 1.5 ? 0.82 : 0.4, accent: true });
    y += c.plates(h);
  }
  c.round(x, y, 0.4, 5, { studs: false });
  c.brick(x + P, y + c.plates(3), 2, 1, 1, { accent: true, studs: false, z: 0 });
};

/** A bubble rising past the lens: a round plate turned to face it. */
export const bubble = (c: Cluster, x: number, y: number, size: number) => c.round(x, y, size, 1, { pitch: Math.PI / 2 });
