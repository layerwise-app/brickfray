import { GANGWAYS, SHIP } from './docks-layout';
import { WATER_Y } from './docks-parts';
import type { Element } from './plan';
import { CONTAINER } from './props-harbor';
import { Pen } from './props-kit';
import { box, Frame, shade, type PlanCollider } from './util';
import { METAL_STAIRS } from './warehouse';

const HULL = '#b0302a';
const BOOT = '#23272b';
const WHITE = '#f2efe6';
const DECK = '#7a6a58';
/** Bulwark height over the deck: more than a jump (1.2), so the deck has no foothold out over the water. */
const BULWARK = 1.4;
/** Walkable deck between the end cabins (|x| < DECK_X); the cabins and the bow stand higher than a jump. */
const DECK_X = 14.6;
const CABIN_H = 2.4;
/** Railing top over the deck: above a jump's reach from the deck, so the ship has no way over its side. */
const RAILING = 2.0;
const RAIL_RUNS = [[-DECK_X, -GANGWAYS.x1], [-GANGWAYS.x0, GANGWAYS.x0], [GANGWAYS.x1, DECK_X]] as const;
/** The wheelhouse amidships and the two deck containers, laid out so every walkway on deck is 3 m or more. */
const HOUSE = { x: 2.4, z0: 3.2, z1: 6.8 } as const;
const CARGO = { x0: 5.4, x1: 11.4, z0: 3.8, z1: 6.2 } as const;

export interface ShipParams {
  /** Centre along x and the hull's berth-side face z; the hull runs along x, its beam toward +z. */
  x: number;
  z: number;
}

/**
 * The red ship off the berth: an old coaster, its wheelhouse amidships (the berth's landmark), boarded by the two
 * gangway stairs. The main deck (2.2 m) is a raised post over the berth and down both quays: a standing head shows over
 * the 1.4 m bulwark, a crouch is hidden. Two containers on its hatches are the cover on deck.
 */
export const RED_SHIP: Element<ShipParams> = {
  colliders(p) {
    const h = SHIP.length / 2;
    const z0 = p.z;
    const z1 = p.z + SHIP.beam;
    const top = SHIP.deck + BULWARK;
    const out: PlanCollider[] = [box([p.x - h, -2, z0], [p.x + h, SHIP.deck, z1], 'metal', { walk: true })];
    for (const s of [-1, 1]) out.push(box([p.x + s * DECK_X, SHIP.deck, z0], [p.x + s * h, SHIP.deck + CABIN_H, z1], 'metal'));
    const rail = (x0: number, x1: number, za: number, zb: number) => {
      out.push(box([p.x + x0, SHIP.deck, za], [p.x + x1, top, zb], 'metal'));
      out.push(box([p.x + x0, top, za], [p.x + x1, SHIP.deck + RAILING, zb], 'metal', { bulletsPass: true }));
    };
    rail(-DECK_X, DECK_X, z1 - 0.2, z1);
    for (const [a, b] of RAIL_RUNS) rail(a, b, z0, z0 + 0.2);
    out.push(box([p.x - HOUSE.x, SHIP.deck, z0 + HOUSE.z0], [p.x + HOUSE.x, 8.4, z0 + HOUSE.z1], 'metal'));
    for (const s of [-1, 1]) out.push(box([p.x + s * CARGO.x0, SHIP.deck, z0 + CARGO.z0], [p.x + s * CARGO.x1, SHIP.deck + 2.56, z0 + CARGO.z1], 'metal'));
    return out;
  },
  draw(d, p) {
    const b = SHIP.beam / 2;
    const t = new Pen(d, new Frame(p.x, 0, p.z + b));
    const h = SHIP.length / 2;
    const bow = DECK_X;
    const top = SHIP.deck + BULWARK;
    const cabin = SHIP.deck + CABIN_H;
    // Hull to the deck; the stern block and the bulwarks (open at the gangway gates) above it, white-capped.
    t.span(-h, WATER_Y - 0.6, -b, bow, SHIP.deck, b, HULL, 'metal', 0);
    t.span(-h, SHIP.deck, -b, -DECK_X, top, b, HULL, 'metal', 0);
    t.span(-h - 0.03, top - 0.18, -b - 0.03, -DECK_X, top, b + 0.03, WHITE, 'metal', 0);
    const walls: [number, number, number, number][] = [[-DECK_X, DECK_X, b - 0.2, b + 0.03], ...RAIL_RUNS.map(([a, c]): [number, number, number, number] => [a, c, -b - 0.03, -b + 0.2])];
    for (const [a, c, z0, z1] of walls) {
      t.span(a, SHIP.deck, Math.max(z0, -b), c, top - 0.18, Math.min(z1, b), HULL, 'metal', 0);
      t.span(a, top - 0.18, z0, c, top, z1, WHITE, 'metal', 0);
    }
    // The bow is the forecastle: it rises to the cabin top from where the walkable deck ends.
    t.prismUp('ship2-bow', [[0, -b], [h - bow, -b * 0.3], [h - bow, b * 0.3], [0, b]], cabin - (WATER_Y - 0.6), bow, WATER_Y - 0.6, 0, HULL, 'metal');
    t.prismUp('ship2-bow-cap', [[0, -b - 0.02], [h - bow + 0.02, -b * 0.3 - 0.02], [h - bow + 0.02, b * 0.3 + 0.02], [0, b + 0.02]], 0.16, bow, cabin - 0.16, 0, WHITE, 'metal');
    t.span(-h - 0.02, WATER_Y - 0.6, -b - 0.02, bow, WATER_Y + 0.25, b + 0.02, BOOT, 'metal', 0);
    // Deck (the inner faces of the bulwarks read as a darker band above it).
    t.span(-DECK_X, SHIP.deck - 0.02, -b + 0.2, DECK_X, SHIP.deck + 0.01, b - 0.2, DECK, undefined, 0);
    t.span(-DECK_X, SHIP.deck, -b + 0.2, DECK_X, top - 0.18, -b + 0.24, shade(HULL, -0.25), 'metal', 0);
    t.span(-DECK_X, SHIP.deck, b - 0.24, DECK_X, top - 0.18, b - 0.2, shade(HULL, -0.25), 'metal', 0);
    // End cabins: the poop (west, raised over the stern) and the forecastle (the bow, east), white-capped.
    t.span(-h, top, -b, -DECK_X, cabin, b, HULL, 'metal', 0);
    t.span(-h - 0.02, cabin - 0.16, -b - 0.02, -DECK_X + 0.02, cabin, b + 0.02, WHITE, 'metal', 0);
    for (const s of [-1, 1]) {
      t.span(s * DECK_X - 0.06, SHIP.deck, -b + 0.4, s * DECK_X + 0.06, SHIP.deck + CABIN_H - 0.2, b - 0.4, shade(HULL, -0.1), 'metal', 0);
      if (d.detail > 0) for (const z of [-2.0, 2.0]) t.box(s * (DECK_X + 0.03), SHIP.deck + 0.4, z, 0.06, 1.6, 0.9, s < 0 ? '#3a4046' : '#545c63', 'metal', 0);
    }
    // Gangway gates in the berth-side bulwark: yellow posts either side. A see-through railing on the bulwarks.
    for (const s of [-1, 1]) for (const x of [GANGWAYS.x0, GANGWAYS.x1]) t.box(s * x, SHIP.deck, -b + 0.1, 0.16, RAILING + 0.1, 0.16, '#f6c624', 'metal', 0);
    for (const [z, runs] of [[b - 0.1, [[-DECK_X, DECK_X]]], [-b + 0.1, RAIL_RUNS]] as const) {
      for (const [x0, x1] of runs) {
        t.span(x0, SHIP.deck + RAILING - 0.06, z - 0.03, x1, SHIP.deck + RAILING, z + 0.03, WHITE, 'metal', 0);
        const n = Math.max(1, Math.round((x1 - x0) / (d.detail > 0 ? 1.6 : 3.2)));
        for (let i = 0; i <= n; i++) t.box(x0 + (i * (x1 - x0)) / n, top, z, 0.05, RAILING - BULWARK, 0.05, WHITE, 'metal', 0);
      }
    }
    house(t, b);
    for (const s of [-1, 1]) {
      const c = s < 0 ? '#c0392b' : '#2f7fbf';
      const [x, , z] = new Frame(p.x, 0, p.z).p(s * (CARGO.x0 + CARGO.x1) / 2, 0, (CARGO.z0 + CARGO.z1) / 2);
      CONTAINER.draw(d, { x, z, y: SHIP.deck, color: c, turns: 0 });
      mast(t, s * (DECK_X + 1.2), s);
    }
    if (d.detail === 0) return;
    for (const s of [-1, 1]) {
      for (const x of [-3.0, -1.0, 1.0, 3.0, -h + 1.0, -h + 2.6, bow - 3.0, bow - 1.4]) t.cylZ(x, 0.9, s * (b + 0.02), 0.16, 0.06, '#26323a', 'metal');
      for (const x of [-h + 0.5, bow - 0.5]) for (let k = 0; k < 4; k++) t.box(x, WATER_Y + 0.4 + k * 0.4, s * (b + 0.02), 0.3, 0.08, 0.05, WHITE, undefined, 0);
      t.box(bow - 1.4, 0.6, s * (b + 0.03), 0.8, 0.9, 0.08, BOOT, 'metal', 0);
    }
  }
};

/** The wheelhouse: two white tiers, the bridge windows, a funnel; lifeboats on davits either side. */
function house(t: Pen, b: number) {
  const z0 = -b + HOUSE.z0;
  const z1 = -b + HOUSE.z1;
  const y = SHIP.deck;
  t.span(-HOUSE.x, y, z0, HOUSE.x, y + 3.0, z1, WHITE, undefined, 0);
  t.span(-HOUSE.x - 0.4, y + 3.0, z0 - 0.4, HOUSE.x + 0.4, y + 3.2, z1 + 0.4, shade(WHITE, -0.1), undefined, 0);
  t.span(-HOUSE.x + 0.3, y + 3.2, z0 + 0.2, HOUSE.x - 0.3, 8.4, z1 - 0.2, WHITE, undefined, 0);
  for (const z of [z0 - 0.01, z1 - 0.03]) t.span(-HOUSE.x + 0.5, 7.0, z, HOUSE.x - 0.5, 7.8, z + 0.04, '#26323a', undefined, 0);
  for (const z of [z0 - 0.01, z1 - 0.03]) for (const x of [-1.2, 0, 1.2]) t.span(x - 0.35, y + 1.2, z, x + 0.35, y + 2.0, z + 0.04, '#26323a', undefined, 0);
  t.span(-0.9, 8.4, -0.9, 0.9, 10.8, 0.9, HULL, 'metal', 0);
  t.span(-0.95, 10.2, -0.95, 0.95, 10.8, 0.95, BOOT, 'metal', 0);
  t.span(-0.94, 9.1, -0.94, 0.94, 9.6, 0.94, WHITE, 'metal', 0);
  for (const z of [z0 - 0.5, z1 + 0.5]) t.box(0, y + 3.3, z, 3.4, 0.7, 0.8, '#e67e22', undefined, 0.04);
}

/** A mast with a cross-tree and a derrick boom resting over the cargo (`lean` toward the ship's middle). */
function mast(t: Pen, x: number, s: number) {
  const y = SHIP.deck + CABIN_H;
  t.box(x, y, 0, 0.3, 13.0 - y, 0.3, '#d9b93a', 'metal', 0);
  t.box(x, 10.6, 0, 0.18, 0.18, 4.4, '#d9b93a', 'metal', 0);
  t.beam(x, y + 0.6, 0, x - s * 6.0, 7.2, 0, 0.16, '#d9b93a', 'metal');
}

/** Rail height over each stair step: higher than a jump, so the stair has no foothold out over the gap. */
const STAIR_RAIL = 2.0;
/** The stair's foot screens: to the 4th step, where the steps themselves block a standing eye's line. */
const SCREEN = { top: 1.9, length: 1.8 } as const;

/**
 * Gangway stair from the berth's edge across the water gap up to a gate in the ship's bulwark, railed both sides.
 * `x` is the stair's centre, `z0` the berth's edge.
 */
export const GANGWAY_STAIR: Element<{ x: number; z0: number }> = {
  colliders(p) {
    const out = METAL_STAIRS.colliders!(stair(p));
    const w = (GANGWAYS.x1 - GANGWAYS.x0) / 2;
    for (const s of [-1, 1]) {
      out.push(box([p.x + s * w - 0.05, 0, p.z0], [p.x + s * w + 0.05, SHIP.deck + STAIR_RAIL, SHIP.z], 'metal', { bulletsPass: true }));
      out.push(box([p.x + s * (w + 0.05), 0, p.z0], [p.x + s * (w + 0.09), SCREEN.top, p.z0 + SCREEN.length], 'plastic'));
    }
    return out;
  },
  nav: (p) => METAL_STAIRS.nav!(stair(p)),
  draw(d, p) {
    METAL_STAIRS.draw(d, stair(p));
    const t = new Pen(d, new Frame(0, 0, 0));
    const w = (GANGWAYS.x1 - GANGWAYS.x0) / 2;
    const len = SHIP.z - p.z0;
    for (const s of [-1, 1]) {
      const x = p.x + s * w;
      t.beam(x, 1.1, p.z0, x, SHIP.deck + 1.1, SHIP.z, 0.07, '#f6c624', 'metal');
      t.beam(x, 0.55, p.z0, x, SHIP.deck + 0.55, SHIP.z, 0.05, '#2f363d', 'metal');
      for (const k of [0, 0.5, 1]) t.box(x, k * SHIP.deck, p.z0 + k * len, 0.07, 1.1, 0.07, '#f6c624', 'metal', 0);
    }
    // Canvas screens lashed along the stair's foot: with the steps above them they close the line along the water's
    // edge from one quay to the other.
    for (const s of [-1, 1]) {
      const x = p.x + s * (w + 0.07);
      t.span(x - 0.02, 0.1, p.z0, x + 0.02, SCREEN.top, p.z0 + SCREEN.length, '#e9e6dc', undefined, 0);
      t.span(x - s * 0.025 - 0.005, 1.0, p.z0 + 0.05, x - s * 0.025 + 0.005, 1.3, p.z0 + SCREEN.length - 0.05, s < 0 ? '#c0392b' : '#2f7fbf', undefined, 0);
      t.span(x + s * 0.025 - 0.005, 1.0, p.z0 + 0.05, x + s * 0.025 + 0.005, 1.3, p.z0 + SCREEN.length - 0.05, s < 0 ? '#c0392b' : '#2f7fbf', undefined, 0);
    }
    // Pontoon float under the stair and its foam.
    t.span(p.x - w, WATER_Y - 0.3, p.z0 + 0.2, p.x + w, WATER_Y + 0.25, SHIP.z - 0.2, '#3a4046', 'metal', 0);
    d.anim.foam.edge(p.x - w, p.z0 + 0.2, p.x + w, p.z0 + 0.2, WATER_Y, 0, 1, 0.5);
  }
};

const stair = (p: { x: number; z0: number }) => ({
  x: p.x,
  z: p.z0,
  y0: 0,
  dir: 's' as const,
  width: GANGWAYS.x1 - GANGWAYS.x0 - 0.1,
  steps: 5,
  rise: SHIP.deck / 5,
  run: (SHIP.z - p.z0) / 5,
  style: { colors: ['#8a9096'], variance: 0 },
  surface: 'metal' as const
});
