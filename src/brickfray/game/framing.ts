export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** What the menu overlay puts on the screen, in CSS pixels: the header's pieces and the panels below. */
export interface StageCover {
  header: Rect[];
  panels: Rect[];
}

/** A lens on the +Z axis looking back at the stand's axis; heights are above the stand's top. */
export interface Lens {
  /** Vertical field of view in degrees. */
  fov: number;
  eye: number;
  aim: number;
}

/** Where the aim point lands on screen and how many pixels a meter takes there. */
export interface Framing {
  scale: number;
  x: number;
  y: number;
}

/**
 * The figure as the lens sees it: the left and right edge of each thin horizontal slice, in meters on the plane
 * through the aim point, with `x` right of it and slice `i` at height `levelOf(i)`. The stand it is on is part of it.
 */
export interface Profile {
  left: Float32Array;
  right: Float32Array;
  /** Highest point of the figure. */
  top: number;
  /** Where the stand's top and its lowest visible edge fall. */
  feet: number;
  base: number;
}

const STEP = 0.02;
const Y0 = -2;
const SLICES = 260;
/** Room for the part of the idle the outline did not sample: the slow weight shift. */
const SLACK = 0.035;
/** Half the width of a head, in meters. */
const HEAD = 0.13;

/** Height of a profile slice above the aim point. */
export const levelOf = (slice: number) => Y0 + slice * STEP;

const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];

function project(lens: Lens, distance: number, x: number, y: number, z: number, out: { x: number; y: number }) {
  const rise = lens.aim - lens.eye;
  const reach = Math.hypot(distance, rise);
  const fy = rise / reach;
  const fz = -distance / reach;
  const ry = y - lens.eye;
  const rz = z - distance;
  const depth = ry * fy + rz * fz;
  out.x = (x / depth) * reach;
  out.y = ((ry * -fz + rz * fy) / depth) * reach;
}

/**
 * Projects an outline (boxes of eight corners, in the figure's frame) for a lens `distance` away, with the figure
 * turned to each of `yaws`, and the stand as a disc of `standRadius` whose top is `standHeight` above the floor.
 * The figure counts as at least `minTop` tall, so a shorter one is framed like a tall one and stands shorter.
 */
export function silhouette(points: Float32Array, yaws: number[], lens: Lens, distance: number, standRadius: number, standHeight: number, minTop = 0): Profile {
  const left = new Float32Array(SLICES).fill(Infinity);
  const right = new Float32Array(SLICES).fill(-Infinity);
  const corner = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
  let top = -Infinity;
  for (const yaw of yaws) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (let box = 0; box < points.length; box += 24) {
      for (let c = 0; c < 8; c++) {
        const x = points[box + c * 3]!;
        const z = points[box + c * 3 + 2]!;
        project(lens, distance, x * cos + z * sin, points[box + c * 3 + 1]!, z * cos - x * sin, corner[c]!);
        top = Math.max(top, corner[c]!.y);
      }
      // A slice's extremes lie on the box's projected edges.
      for (let e = 0; e < EDGES.length; e += 2) {
        const a = corner[EDGES[e]!]!;
        const b = corner[EDGES[e + 1]!]!;
        const steps = Math.ceil(Math.abs(a.y - b.y) / STEP) + 1;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const i = Math.floor((a.y + (b.y - a.y) * t - Y0) / STEP);
          if (i < 0 || i >= SLICES) continue;
          const x = a.x + (b.x - a.x) * t;
          if (x < left[i]!) left[i] = x;
          if (x > right[i]!) right[i] = x;
        }
      }
    }
  }
  for (let i = 0; i < SLICES; i++) {
    left[i]! -= SLACK;
    right[i]! += SLACK;
  }
  const at = { x: 0, y: 0 };
  project(lens, distance, 0, 0, 0, at);
  const feet = at.y;
  // Up to `minTop` the figure is at least a head wide, so the header holds a short one down like a tall one.
  project(lens, distance, 0, minTop, 0, at);
  top = Math.max(top, at.y);
  for (let i = Math.max(0, Math.floor((feet - Y0) / STEP)); i < SLICES && levelOf(i) <= at.y; i++) {
    left[i] = Math.min(left[i]!, -HEAD);
    right[i] = Math.max(right[i]!, HEAD);
  }
  project(lens, distance, 0, -standHeight, standRadius, at);
  const base = at.y;
  // The stand counts as part of the picture: a slab as wide as its disc, from its near bottom edge to its far top edge.
  project(lens, distance, 0, 0, -standRadius, at);
  const half = standRadius / Math.sqrt(1 - (standRadius / distance) ** 2);
  for (let i = Math.max(0, Math.floor((base - Y0) / STEP)); i < SLICES && levelOf(i) <= at.y; i++) {
    left[i] = Math.min(left[i]!, -half);
    right[i] = Math.max(right[i]!, half);
  }
  return { left, right, top: top + SLACK, feet, base };
}

/**
 * The largest framing that keeps the whole figure and its stand on screen and clear of everything the menu shows.
 * Panels beside the figure (wide layout) bound it left and right, and the stand sits level with their bottom edge;
 * a panel across the bottom (stacked layout) is a floor the stand rests above, centered.
 */
export function frame(profile: Profile, width: number, height: number, cover: StageCover | null): Framing {
  const margin = Math.max(12, Math.min(width, height) * 0.028);
  const gap = Math.max(14, margin);
  const header = cover?.header ?? [];
  const across = (cover?.panels ?? []).filter((r) => r.left < width / 2 && r.right > width / 2);
  const sides = (cover?.panels ?? []).filter((r) => !across.includes(r));
  const stacked = across.length > 0;
  // A sideways phone has height for the figure alone: it stands on the bottom margin and keeps a little air overhead.
  const short = height < 560;
  const top = short ? Math.max(margin, height * 0.07) : margin;
  const ground = stacked
    ? Math.min(...across.map((r) => r.top)) - Math.max(8, margin * 0.7)
    : short
      ? height - margin * 0.6
      : Math.min(height - margin * 0.6, sides.length ? Math.max(...sides.map((r) => r.bottom)) : height - margin);
  const bandLeft = Math.max(0, ...sides.filter((r) => r.right <= width / 2).map((r) => r.right));
  const bandRight = Math.min(width, ...sides.filter((r) => r.left >= width / 2).map((r) => r.left));
  const center = stacked ? width / 2 : (bandLeft + bandRight) / 2;
  const shift = stacked ? width * 0.04 : (bandRight - bandLeft) * 0.2;
  const blocks = [...header, ...sides];

  /** The aim point's x at this scale, or null when the picture does not fit. */
  const place = (scale: number) => {
    const y0 = ground + scale * profile.base;
    if (y0 - scale * profile.top < top) return null;
    let lo = center - shift;
    let hi = center + shift;
    for (let i = 0; i < SLICES; i++) {
      const left = profile.left[i]!;
      if (left === Infinity) continue;
      const right = profile.right[i]!;
      const y = y0 - scale * levelOf(i);
      lo = Math.max(lo, margin - scale * left);
      hi = Math.min(hi, width - margin - scale * right);
      for (const r of blocks) {
        if (y <= r.top - gap || y >= r.bottom + gap) continue;
        if ((r.left + r.right) / 2 < center) lo = Math.max(lo, r.right + gap - scale * left);
        else hi = Math.min(hi, r.left - gap - scale * right);
      }
    }
    return lo <= hi ? Math.min(hi, Math.max(lo, center)) : null;
  };

  const most = height * 0.48;
  let scale = most;
  let x = place(scale);
  while (x === null && scale > 20) {
    scale *= 0.97;
    x = place(scale);
  }
  // The scan stopped within 3% of the limit; close in on it.
  let lo = scale;
  let hi = Math.min(most, scale / 0.97);
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    const at = place(mid);
    if (at === null) hi = mid;
    else {
      lo = mid;
      x = at;
    }
  }
  return { scale: lo, x: x ?? center, y: ground + lo * profile.base };
}
