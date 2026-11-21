import { describe, expect, it } from 'vitest';
import { frame, levelOf, silhouette, type Rect, type StageCover } from './framing';

const LENS = { fov: 22, eye: 0.8, aim: 1.1 };

/** Eight corners of a slab from `a` to `b`, `thick` across: a body, or a rifle held up at an angle. */
function slab(a: [number, number], b: [number, number], thick: number) {
  const points: number[] = [];
  for (let corner = 0; corner < 8; corner++) {
    const [x, y] = corner & 2 ? b : a;
    points.push(x + (corner & 1 ? thick : -thick), y, corner & 4 ? thick : -thick);
  }
  return points;
}

const FIGURE = new Float32Array([...slab([0, 0], [0, 1.9], 0.34), ...slab([-0.3, 1.1], [-0.62, 2.45], 0.03)]);
const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom });

const STAND = { radius: 0.69, height: 0.16 };
const YAWS = [2.5, 2.64, 2.78];

/** The menu's layout at a size: logo and buttons on top, columns beside the figure when wide and a sheet under it when narrow. */
function menu(width: number, height: number): StageCover {
  const header = [rect(24, 20, Math.min(width * 0.55, 560), 110), rect(width - 200, 24, width - 24, 76)];
  if (width >= 1280) return { header, panels: [rect(32, height - 390, 420, height - 32), rect(width - 372, height - 320, width - 32, height - 32)] };
  if (width >= 1024) return { header, panels: [rect(24, height - 330, 334, height - 24), rect(width - 288, height - 290, width - 24, height - 24)] };
  // A phone held sideways: the same columns, closed up.
  if (height <= 560) return { header: [rect(12, 12, 190, 50), rect(width - 150, 12, width - 12, 50)], panels: [rect(12, height - 190, 290, height - 12), rect(width - 216, height - 170, width - 12, height - 12)] };
  return { header, panels: [rect(0, height - Math.min(400, height * 0.5), width, height)] };
}

/** Settles the framing as the showroom does: the outline's perspective follows the distance the framing asks for. */
function settle(width: number, height: number, cover: StageCover | null) {
  let distance = 8;
  let profile = silhouette(FIGURE, YAWS, LENS, distance, STAND.radius, STAND.height);
  let framing = frame(profile, width, height, cover);
  for (let round = 0; round < 2; round++) {
    distance = height / 2 / Math.tan((LENS.fov * Math.PI) / 360) / framing.scale;
    profile = silhouette(FIGURE, YAWS, LENS, distance, STAND.radius, STAND.height);
    framing = frame(profile, width, height, cover);
  }
  return { profile, framing };
}

describe('silhouette', () => {
  it('counts the stand as part of the picture, down to its near edge', () => {
    const profile = silhouette(FIGURE, YAWS, LENS, 8, STAND.radius, STAND.height);
    expect(profile.base).toBeLessThan(profile.feet - STAND.height * 0.9);
    const slice = profile.left.findIndex((left, i) => left !== Infinity && levelOf(i) > profile.base && levelOf(i) < profile.feet - 0.05);
    expect(profile.left[slice]).toBeLessThanOrEqual(-STAND.radius);
    expect(profile.right[slice]).toBeGreaterThanOrEqual(STAND.radius);
  });
});

describe('frame', () => {
  it.each([
    [2200, 900],
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [1024, 768],
    [844, 390],
    [667, 375],
    [768, 1024],
    [430, 900],
    [390, 844],
    [375, 667]
  ])('keeps the figure, its raised rifle and its stand clear of everything on screen at %i×%i', (width, height) => {
    const cover = menu(width, height);
    const { profile, framing } = settle(width, height, cover);
    const stacked = cover.panels.length === 1;
    const ground = stacked ? cover.panels[0]!.top : height;
    const top = framing.y - framing.scale * profile.top;
    const bottom = framing.y - framing.scale * profile.base;
    expect(top).toBeGreaterThanOrEqual(8);
    expect(bottom).toBeLessThanOrEqual(ground - 6);
    // Tall enough to read: the figure takes a good part of the height it can have.
    const free = ground - (stacked ? Math.max(...cover.header.map((r) => r.bottom)) : 0);
    expect(framing.scale * (profile.top - profile.base)).toBeGreaterThan(free * 0.7);
    if (stacked) expect(Math.abs(framing.x - width / 2)).toBeLessThanOrEqual(width * 0.04 + 1);
    profile.left.forEach((left, i) => {
      if (left === Infinity) return;
      const y = framing.y - framing.scale * levelOf(i);
      const x0 = framing.x + framing.scale * left;
      const x1 = framing.x + framing.scale * profile.right[i]!;
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(width);
      for (const r of [...cover.header, ...cover.panels]) expect(y < r.top || y > r.bottom || x1 < r.left || x0 > r.right).toBe(true);
    });
  });

  it.each([
    [1440, 900],
    [390, 844]
  ])('frames a short figure like a tall one when told how tall to count it, so the stand keeps its size at %i×%i', (width, height) => {
    const fit = (top: number, minTop: number) => frame(silhouette(new Float32Array(slab([0, 0], [0, top], 0.3)), YAWS, LENS, 7, STAND.radius, STAND.height, minTop), width, height, menu(width, height)).scale;
    expect(fit(1.6, 0)).toBeGreaterThan(fit(2, 0) * 1.1);
    expect(Math.abs(fit(1.6, 2.05) / fit(2, 2.05) - 1)).toBeLessThan(0.02);
  });

  it('stands the figure in the middle of an empty screen, on its bottom margin', () => {
    const { profile, framing } = settle(1280, 800, null);
    expect(framing.x).toBeCloseTo(640, 0);
    const bottom = framing.y - framing.scale * profile.base;
    expect(bottom).toBeGreaterThan(800 - 40);
    expect(bottom).toBeLessThan(800);
  });
});
