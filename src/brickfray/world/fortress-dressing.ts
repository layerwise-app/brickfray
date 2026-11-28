import { GATE, MILL } from './fortress-layout';
import { F } from './fortress-plan';
import type { Element, Plan } from './plan';
import { BANNER, FLAGPOLE, TORCH } from './props-castle';
import { Pen } from './props-kit';
import { box, Frame } from './util';

/** Team colours: blue for the west camp (team 0), red for the east (team 1). */
export const RED = ['#c8231b', '#f6c624', '#7a1712'];
export const BLUE = ['#1f62c7', '#f2f2ee', '#17284f'];

const OAK = '#5e3f27';
const PLANK = '#8a5f3a';
const IRON = '#3a3f45';
const CORBEL = '#b3ab98';
const MERLON = ['#9a9da0', '#8e9195', '#a6a9ac'];
const SLIT = '#1b1d20';

/** Flags, banners and torches by team, the keep's crown, the shut gates and the mill wheel. */
export function fortressDressing(p: Plan) {
  for (const s of [-1, 1] as const) {
    const colors = s < 0 ? BLUE : RED;
    // Flags over the keep's corner on each team's side, the gatehouse roof and the town gate towers.
    p.add(FLAGPOLE, { x: s * (F.keep - 0.6), y: 12.0, z: -s * (F.keep - 0.6), colors, height: 4.0, pattern: 'chevron' });
    p.add(FLAGPOLE, { x: s * Math.abs((GATE.x0 + GATE.x1) / 2), y: s < 0 ? GATE.top : GATE.floor + 3.2, z: s < 0 ? 0 : -6.4, colors, height: 3.2 });
    for (const z of s < 0 ? [-30.4, 30.4] : [-28.0, 27.2]) p.add(FLAGPOLE, { x: s * (s < 0 ? 35.6 : 36.0), y: 8.0, z, colors, height: 3.2, pattern: 'bands' });
    // Banners on the barbican's and the palisade's camp faces, so a player knows which camp is whose.
    for (const z of [-6.4, 6.4]) p.add(BANNER, { x: s * (48.0 + 0.02), y: s < 0 ? 3.2 : 2.0, z, turns: s < 0 ? 3 : 1, colors, width: 1.4, height: 2.6, pattern: 'border' });
    // Torches either side of each gate passage, on the yard face and the bailey face.
    for (const z of [-3.4, 3.4]) {
      p.add(TORCH, { x: s * 36.82, y: 2.6, z, turns: s < 0 ? 3 : 1 });
      p.add(TORCH, { x: s * 28.78, y: 2.6, z, turns: s < 0 ? 1 : 3 });
    }
  }
  p.add(KEEP_CROWN, {});
  p.add(GATES, {});
  p.add(ROOMS, {});
  p.add(WHEEL, {});
}

/** The keep's crown and faces: a corbelled parapet with merlons, arrow slits, a shut door in the north and south faces. */
const KEEP_CROWN: Element<Record<string, never>> = {
  draw(d) {
    const K = F.keep;
    const top = 12.0;
    for (const turns of [0, 1, 2, 3]) {
      const f = new Frame(turns === 1 ? K : turns === 3 ? -K : 0, 0, turns === 0 ? K : turns === 2 ? -K : 0, turns);
      const t = new Pen(d, f);
      t.box(0, top - 0.5, 0.12, K * 2 + 0.64, 0.5, 0.3, CORBEL, undefined, 0.03);
      if (d.detail > 0) for (let u = -K + 0.4; u <= K - 0.3; u += 0.8) t.box(u, top - 0.9, 0.08, 0.32, 0.4, 0.16, CORBEL, undefined, 0.02);
      for (let k = 0, u = -K + 0.4; u <= K - 0.3; u += 1.6, k++) t.box(u, top, 0.08, 0.8, 0.96, 0.48, MERLON[k % 3]!, undefined, 0.03);
      for (const u of [-5.6, 0, 5.6]) for (const y of [5.2, 8.4]) t.box(u, y, 0.02, 0.24, 1.3, 0.04, SLIT, undefined, 0);
      if (turns % 2 === 0) {
        // A shut oak door up three steps: drawn flat on the wall, the keep is not entered.
        t.box(0, 0, 0.03, 3.2, 3.6, 0.06, '#d8cfba', undefined, 0);
        t.box(0, 0, 0.07, 2.4, 3.0, 0.06, OAK, undefined, 0);
        if (d.detail > 0) for (const y of [0.8, 2.0]) t.box(0, y, 0.11, 2.2, 0.12, 0.03, IRON, 'metal', 0);
      }
    }
  }
};

/**
 * The gates: the west one stands open, its oak leaves folded back against the passage and its portcullis hauled up under
 * the room; the east one was battered in, one leaf hanging, its portcullis gone.
 */
const GATES: Element<Record<string, never>> = {
  draw(d) {
    const { x0, x1, half } = GATE;
    for (const s of [-1, 1]) {
      const zs = s < 0 ? [-half, half] : [-half];
      for (const z of zs) {
        const t = new Pen(d, new Frame(s * (Math.abs(x1) + 0.1), 0, z + (z < 0 ? 0.06 : -0.06), 0));
        // A leaf turned flat against the passage side: 2.6 long along x, a hand thick.
        t.box(s * 1.3, 0.02, 0, 2.6, 3.2, 0.08, OAK, undefined, 0);
        for (const y of [0.7, 1.9, 2.9]) t.box(s * 1.3, y, z < 0 ? 0.06 : -0.06, 2.5, 0.12, 0.04, IRON, 'metal', 0);
      }
      if (s < 0) {
        // The portcullis' foot showing under the room's floor at the yard end.
        const t = new Pen(d, new Frame(x0 + 0.5, 0, 0, 1));
        for (let u = -half + 0.2; u < half; u += 0.4) t.box(u, 2.9, 0, 0.06, 0.46, 0.06, IRON, 'metal', 0);
        t.box(0, 2.95, 0, half * 2, 0.08, 0.08, IRON, 'metal', 0);
      }
    }
  }
};

/** Gate-room fittings: the windlass that raises the portcullis, a weapon rack, powder kegs; in the east room, the fallen roof beams. */
const ROOMS: Element<Record<string, never>> = {
  colliders: () => [
    box([-34.0, GATE.floor, -0.7], [-31.6, GATE.floor + 1.2, 0.7], 'wood'),
    box([-36.0, GATE.floor, -5.6], [-35.6, GATE.floor + 1.8, -1.6], 'wood'),
    box([-36.0, GATE.floor, 4.4], [-34.8, GATE.floor + 1.1, 5.6], 'wood'),
    box([32.0, GATE.floor, -4.8], [34.4, GATE.floor + 0.9, -3.6], 'stone'),
    box([31.6, GATE.floor, 4.0], [34.0, GATE.floor + 0.5, 4.6], 'wood')
  ],
  draw(d) {
    const t = new Pen(d, new Frame(0, GATE.floor, 0, 0));
    // Windlass: two A-frames and a drum with its chain down through the floor.
    for (const x of [-33.8, -31.8]) {
      t.box(x, 0, -0.55, 0.16, 1.2, 0.16, OAK, undefined, 0.02);
      t.box(x, 0, 0.55, 0.16, 1.2, 0.16, OAK, undefined, 0.02);
      t.box(x, 0.95, 0, 0.16, 0.16, 1.26, OAK, undefined, 0.02);
    }
    t.box(-32.8, 0.85, 0, 2.2, 0.36, 0.36, PLANK, undefined, 0.06);
    t.box(-32.8, 0, 0, 0.08, 0.85, 0.08, IRON, 'metal', 0);
    for (const x of [-34.0, -31.6]) t.box(x, 0.85, 0, 0.08, 0.08, 1.2, IRON, 'metal', 0);
    // Rack of spears and bills against the north wall.
    t.box(-35.8, 0, -3.6, 0.36, 0.12, 4.0, OAK, undefined, 0.02);
    t.box(-35.8, 1.4, -3.6, 0.36, 0.12, 4.0, OAK, undefined, 0.02);
    for (let z = -5.4; z <= -1.8; z += 0.45) t.box(-35.8, 0.12, z, 0.05, 1.68, 0.05, '#8a8f96', 'metal', 0);
    // Kegs in the south corner.
    for (const [x, z] of [[-35.7, 4.7], [-35.1, 4.7], [-35.4, 5.3]] as const) t.cyl(x, 0, z, 0.28, 1.05, PLANK, undefined, 0.03);
    // East room: the roof's charred beams fallen across the floor, a heap of its slates and stones.
    t.box(33.2, 0, -4.2, 2.4, 0.9, 1.2, '#8f897c', undefined, 0.08);
    t.box(32.8, 0.6, -4.2, 1.2, 0.3, 0.8, '#7f796d', undefined, 0.06);
    t.box(32.8, 0, 4.3, 2.4, 0.5, 0.6, '#3b2b20', undefined, 0.04);
  }
};

/** The mill wheel, half sunk in its pit in the gallery's foot, turning in the race over the ford. */
const WHEEL: Element<Record<string, never>> = {
  // Shots pass between the spokes; only the hub stops them. Nobody walks through the wheel.
  colliders: () => [box([-0.3, F.ford, MILL.front], [0.3, 3.0, MILL.front + 1.7], 'wood', { bulletsPass: true }), box([-0.35, 1.0, MILL.front], [0.35, 1.6, MILL.front + 0.3], 'wood')],
  draw(d) {
    const t = new Pen(d, new Frame(0, 1.3, MILL.front, 1));
    const r = 1.7;
    for (const z of [-0.24, 0.24]) t.ringUp(0, 0, z, r, 0.08, OAK);
    t.cylZ(0, 0, 0, 0.26, 0.7, IRON, 'metal', 0.03);
    const n = d.detail === 0 ? 8 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      t.beam(0, 0, -0.24, c * r, s * r, -0.24, 0.08, PLANK);
      t.beam(0, 0, 0.24, c * r, s * r, 0.24, 0.08, PLANK);
      t.box(c * (r + 0.04), s * (r + 0.04) - 0.22, 0, 0.1, 0.44, 0.56, PLANK, undefined, 0.01, 0);
    }
    d.anim.foam.edge(-MILL.race, MILL.front + 0.2, MILL.race, MILL.front + 0.2, F.water, 0, 1, 0.8);
    d.anim.foam.edge(-MILL.race, F.edge - 0.1, MILL.race, F.edge - 0.1, F.water, 0, -1, 0.5);
  }
};
