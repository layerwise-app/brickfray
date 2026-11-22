import { describe, expect, it } from 'vitest';
import { DOCKS_SHIPS, docksBackdrop } from '../world/backdrop-docks';
import { WATER_Y } from '../world/docks-parts';
import { MAPS } from '../world/index';
import type { Drawer } from '../world/plan';
import type { Collider, MapId } from '../world/types';
import { pickSpot, SPOTS } from './scenery';

type P = readonly [number, number, number];

const MAP_IDS = Object.keys(MAPS) as MapId[];
/** Spots that fly (no perch under them) and spots out at sea, past the map's bounds by design. */
const FLYING = new Set(['gull']);
const AT_SEA = new Set(['horn']);
/** A perched spot has something solid (not the ground) this close. */
const SUPPORT = 3.5;

function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const within = (p: P, c: Collider) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];
const over = (p: P, c: Collider) => p[0] > c.min[0] && p[0] < c.max[0] && p[2] > c.min[2] && p[2] < c.max[2];
const gap = (p: P, c: Collider) => Math.hypot(...[0, 1, 2].map((a) => Math.max(c.min[a]! - p[a]!, 0, p[a]! - c.max[a]!)));

/** What is wrong with a scenery point on a map, if anything. */
function faults(map: MapId, spot: string, p: P): string[] {
  const { colliders, bounds } = MAPS[map].layout();
  const out: string[] = [];
  const solid = colliders.filter((c) => within(p, c));
  if (solid.length) out.push(`inside ${solid.map((c) => `${c.surface} [${c.min}]-[${c.max}]`).join(', ')}`);
  if (colliders.some((c) => over(p, c) && c.min[1] > p[1] && c.min[1] <= 0.5)) out.push('under the ground');
  if (AT_SEA.has(spot)) return out;
  const inMap = p[0] >= bounds.min[0] && p[0] <= bounds.max[0] && p[2] >= bounds.min[2] && p[2] <= bounds.max[2] && p[1] >= bounds.min[1];
  if (!inMap) out.push('outside the bounds');
  if (!FLYING.has(spot) && !colliders.some((c) => c.max[1] > 0.3 && gap(p, c) <= SUPPORT)) out.push('nothing to sit on');
  return out;
}

/** The ships docksBackdrop draws on a tier: centre and length of each hull (a box at the waterline past z = 100). */
function drawnShips(detail: 0 | 1 | 2) {
  const hulls: { x: number; z: number; len: number }[] = [];
  const any: unknown = new Proxy(() => {}, { get: () => any, apply: () => any });
  const put = (_f: unknown, key: string, _g: unknown, x: number, y: number, z: number) => {
    if (key.startsWith('box:') && Math.abs(y - (WATER_Y - 0.2)) < 1e-6 && z > 100) hulls.push({ x, z, len: Number(key.split(':')[1]) });
  };
  const d = new Proxy({ detail, profile: { bevel: 0.02 }, put }, { get: (t, k) => (k in t ? t[k as keyof typeof t] : any) });
  docksBackdrop(d as unknown as Drawer);
  return hulls;
}

describe('scenery sounds', () => {
  it.each(MAP_IDS)('%s: every spot sits on something real inside the map', (map) => {
    const bad: string[] = [];
    for (const s of SPOTS[map]) {
      expect(s.at.length, `${map} ${s.spot}`).toBeGreaterThan(0);
      for (const p of s.at) for (const f of faults(map, s.spot, p)) bad.push(`${s.spot} (${p.map((v) => v.toFixed(1))}): ${f}`);
    }
    expect(bad).toEqual([]);
  });

  it.each(MAP_IDS)('%s: picks that roam off their perch stay out of walls and inside the map', (map) => {
    const rng = seeded(11);
    const bad: string[] = [];
    for (let i = 0; i < 400; i++) {
      const { spot, position: q } = pickSpot(map, rng);
      const p: P = [q.x, q.y, q.z];
      for (const f of faults(map, spot, p).filter((f) => f !== 'nothing to sit on')) bad.push(`${spot} (${p.map((v) => v.toFixed(1))}): ${f}`);
    }
    expect(bad).toEqual([]);
  });

  it('sounds the docks horns from the bridges of the ships the backdrop draws', () => {
    const hulls = drawnShips(1);
    expect(drawnShips(2)).toEqual(hulls);
    expect(hulls.length).toBe(DOCKS_SHIPS.length);
    for (const [x, y, z] of DOCKS_SHIPS) {
      const ship = hulls.find((h) => Math.abs(h.z - z) < 1e-6 && Math.abs(h.x - h.len * 0.35 - x) < 0.01);
      expect(ship, `horn at ${x},${z}`).toBeDefined();
      expect(y).toBeGreaterThan(WATER_Y);
    }
    expect(SPOTS.docks.find((s) => s.spot === 'horn')?.at).toEqual(DOCKS_SHIPS);
  });

  it('draws the place the rank likes best', () => {
    const near = (at: { x: number; z: number }) => Math.hypot(at.x - 20, at.z - 30);
    const mean = (tries: number) => {
      const rng = seeded(3);
      let sum = 0;
      for (let i = 0; i < 300; i++) sum += near(pickSpot('plaza', rng, near, tries).position);
      return sum / 300;
    };
    expect(mean(4)).toBeLessThan(mean(1) * 0.75);
  });
});
