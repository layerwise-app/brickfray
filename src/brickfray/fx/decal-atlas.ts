export type DecalKind = 'chip' | 'spall' | 'dent' | 'crack' | 'splinter' | 'scorch';

/** Atlas columns and rows; a cell is [column, row] with row 0 at the bottom of the texture. */
export const DECAL_GRID = [4, 3] as const;
export const DECAL_CELLS: Record<DecalKind, readonly (readonly [number, number])[]> = {
  chip: [[0, 2], [1, 2]],
  spall: [[0, 0], [1, 0]],
  dent: [[2, 2], [2, 0]],
  crack: [[3, 2], [0, 1]],
  splinter: [[1, 1], [3, 0]],
  scorch: [[2, 1], [3, 1]]
};

const CELL = 128;
const TAU = Math.PI * 2;

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Draw = (g: CanvasRenderingContext2D, rand: () => number) => void;

/** A closed ragged outline around the origin; `r` is in cell halves (1 = the cell edge). */
function ragged(g: CanvasRenderingContext2D, rand: () => number, r: number, rough: number, points: number) {
  g.beginPath();
  const turn = rand() * TAU;
  for (let i = 0; i < points; i++) {
    const a = turn + (i / points) * TAU;
    const d = r * (1 - rough + rand() * rough * 2);
    if (i === 0) g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    else g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  g.closePath();
}

function halo(g: CanvasRenderingContext2D, r: number, stops: [number, string][]) {
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(-1, -1, 2, 2);
}

/** Soft blotches of `color` scattered around the centre: a smudge with an uneven edge instead of a ring. */
function smudge(g: CanvasRenderingContext2D, rand: () => number, color: string, alpha: number, reach: number, blots: number) {
  for (let i = 0; i < blots; i++) {
    const a = rand() * TAU;
    const d = rand() * reach * 0.45;
    const r = reach * (0.35 + rand() * 0.3);
    g.save();
    g.translate(Math.cos(a) * d, Math.sin(a) * d);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, `rgba(${color},${(alpha * (0.6 + rand() * 0.4)).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grad;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }
}

/** A bullet chip in plastic: a small dark pit, a thin stress-whitened rim, a few flakes, a faint uneven scuff. */
const chip: Draw = (g, rand) => {
  smudge(g, rand, '40,34,30', 0.16, 0.7, 5);
  g.fillStyle = 'rgba(246,244,238,0.8)';
  ragged(g, rand, 0.3, 0.28, 9);
  g.fill();
  g.fillStyle = 'rgba(92,88,82,0.9)';
  ragged(g, rand, 0.23, 0.22, 8);
  g.fill();
  g.fillStyle = 'rgba(18,18,22,0.95)';
  ragged(g, rand, 0.16, 0.22, 7);
  g.fill();
  g.fillStyle = 'rgba(250,248,242,0.75)';
  for (let i = 0; i < 4; i++) {
    const a = rand() * TAU;
    const d = 0.36 + rand() * 0.24;
    g.save();
    g.translate(Math.cos(a) * d, Math.sin(a) * d);
    ragged(g, rand, 0.035 + rand() * 0.035, 0.4, 4);
    g.fill();
    g.restore();
  }
};

/**
 * A bullet strike on stone, shaded for light from above like the dent: a halo of pale powder, a chipped crater of
 * fresh pale stone with an angular broken edge (shadowed lip on top, lit lip below), a dark pit, pale flakes and grit.
 */
const spall: Draw = (g, rand) => {
  smudge(g, rand, '230,226,216', 0.26, 0.9, 7);
  smudge(g, rand, '90,84,76', 0.1, 0.5, 3);
  const r = 0.34 + rand() * 0.05;
  g.fillStyle = 'rgba(218,212,200,0.85)';
  ragged(g, rand, r, 0.32, 10);
  g.fill();
  const lip = g.createLinearGradient(0, -r, 0, r);
  lip.addColorStop(0, 'rgba(58,52,46,0.75)');
  lip.addColorStop(0.45, 'rgba(110,104,96,0.15)');
  lip.addColorStop(1, 'rgba(250,248,240,0.7)');
  g.strokeStyle = lip;
  g.lineWidth = 0.05;
  g.lineJoin = 'miter';
  ragged(g, rand, r * 0.94, 0.26, 10);
  g.stroke();
  const bowl = g.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
  bowl.addColorStop(0, 'rgba(56,52,48,0.92)');
  bowl.addColorStop(0.5, 'rgba(134,126,116,0.85)');
  bowl.addColorStop(1, 'rgba(206,198,184,0.85)');
  g.fillStyle = bowl;
  ragged(g, rand, r * 0.74, 0.3, 9);
  g.fill();
  g.fillStyle = 'rgba(30,28,26,0.95)';
  g.save();
  g.translate((rand() - 0.5) * 0.06, -0.04);
  ragged(g, rand, 0.12, 0.3, 7);
  g.fill();
  g.restore();
  for (let i = 0; i < 7; i++) {
    const a = rand() * TAU;
    const d = r + 0.06 + rand() * 0.32;
    g.save();
    g.translate(Math.cos(a) * d, Math.sin(a) * d);
    g.fillStyle = i % 3 ? 'rgba(238,234,224,0.9)' : 'rgba(84,78,70,0.75)';
    ragged(g, rand, 0.03 + rand() * 0.035, 0.45, 4);
    g.fill();
    g.restore();
  }
};

/**
 * A dent punched into sheet metal, shaded for light from above (the mark's +Y is laid toward world up): the upper
 * inner wall in shadow, the lower one catching the light, a raised lip bright on top and dark below, a torn hole off
 * centre, scorched paint and a few bare scratches.
 */
const dent: Draw = (g, rand) => {
  smudge(g, rand, '30,24,20', 0.24, 0.78, 6);
  const r = 0.3 + rand() * 0.05;
  const lip = g.createLinearGradient(0, -r - 0.08, 0, r + 0.08);
  lip.addColorStop(0, 'rgba(244,246,250,0.75)');
  lip.addColorStop(0.42, 'rgba(200,204,210,0.12)');
  lip.addColorStop(0.62, 'rgba(20,20,24,0.16)');
  lip.addColorStop(1, 'rgba(14,14,18,0.6)');
  g.strokeStyle = lip;
  g.lineWidth = 0.075;
  ragged(g, rand, r + 0.04, 0.07, 15);
  g.stroke();
  const bowl = g.createLinearGradient(0, -r, 0, r);
  bowl.addColorStop(0, 'rgba(10,10,12,0.88)');
  bowl.addColorStop(0.45, 'rgba(46,46,52,0.62)');
  bowl.addColorStop(0.8, 'rgba(176,180,188,0.55)');
  bowl.addColorStop(1, 'rgba(232,236,242,0.72)');
  g.fillStyle = bowl;
  ragged(g, rand, r, 0.08, 14);
  g.fill();
  const hx = (rand() - 0.5) * 0.1;
  const hy = -0.03 - rand() * 0.05;
  g.save();
  g.translate(hx, hy);
  g.fillStyle = 'rgba(196,200,208,0.7)';
  ragged(g, rand, 0.13, 0.25, 13);
  g.fill();
  g.translate(0, -0.014);
  g.fillStyle = 'rgba(8,8,10,0.97)';
  ragged(g, rand, 0.11, 0.25, 12);
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(226,230,236,0.45)';
  g.lineWidth = 0.018;
  for (let i = 0; i < 4; i++) {
    const a = rand() * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * (r + 0.08), Math.sin(a) * (r + 0.08));
    g.lineTo(Math.cos(a) * (r + 0.22 + rand() * 0.2), Math.sin(a) * (r + 0.22 + rand() * 0.2));
    g.stroke();
  }
};

/** Shattered glass: a punched hole, long radial cracks and two broken rings joining them. */
const crack: Draw = (g, rand) => {
  halo(g, 0.5, [[0, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineCap = 'round';
  const spokes = 11;
  const ends: [number, number][] = [];
  const turn = rand() * TAU;
  for (let i = 0; i < spokes; i++) {
    const a = turn + ((i + rand() * 0.6) / spokes) * TAU;
    const len = 0.5 + rand() * 0.45;
    ends.push([a, len]);
    g.lineWidth = 0.034;
    g.beginPath();
    g.moveTo(Math.cos(a) * 0.08, Math.sin(a) * 0.08);
    const bend = a + (rand() - 0.5) * 0.25;
    g.lineTo(Math.cos(bend) * len * 0.55, Math.sin(bend) * len * 0.55);
    g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    g.stroke();
  }
  g.lineWidth = 0.026;
  for (const ring of [0.3, 0.56]) {
    for (let i = 0; i < spokes; i++) {
      const [a0, l0] = ends[i]!;
      const [a1, l1] = ends[(i + 1) % spokes]!;
      if (rand() < 0.3 || l0 < ring || l1 < ring) continue;
      const r0 = ring * (0.9 + rand() * 0.2);
      const r1 = ring * (0.9 + rand() * 0.2);
      g.beginPath();
      g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
      g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
      g.stroke();
    }
  }
  g.fillStyle = 'rgba(18,24,30,0.9)';
  ragged(g, rand, 0.1, 0.3, 7);
  g.fill();
};

/** Wood torn along the grain: a dark hole with long pale splinters to either side of it. */
const splinter: Draw = (g, rand) => {
  smudge(g, rand, '40,24,12', 0.26, 0.66, 5);
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    const y = (rand() - 0.5) * 0.36;
    const len = 0.36 + rand() * 0.52;
    const w = 0.035 + rand() * 0.05;
    g.fillStyle = i % 3 ? 'rgba(236,208,160,0.92)' : 'rgba(200,160,108,0.92)';
    g.beginPath();
    g.moveTo(0, y - w);
    g.lineTo(side * len, y + (rand() - 0.5) * 0.08);
    g.lineTo(0, y + w);
    g.closePath();
    g.fill();
  }
  g.fillStyle = 'rgba(28,16,8,0.95)';
  g.beginPath();
  g.ellipse(0, 0, 0.26, 0.15, 0, 0, TAU);
  g.fill();
};

/**
 * Blast scorch, drawn to be multiplied over the floor: soot thick at the centre in a few overlapping blotches so the
 * edge is not a circle, soft wide streaks thrown outward rather than a hard star, and a few darker flecks.
 */
const scorch: Draw = (g, rand) => {
  halo(g, 0.8, [[0, 'rgba(10,9,9,0.86)'], [0.35, 'rgba(16,14,13,0.7)'], [0.7, 'rgba(26,23,20,0.3)'], [1, 'rgba(30,26,22,0)']]);
  for (let i = 0; i < 6; i++) {
    const a = rand() * TAU;
    const d = 0.25 + rand() * 0.3;
    g.save();
    g.translate(Math.cos(a) * d, Math.sin(a) * d);
    halo(g, 0.22 + rand() * 0.2, [[0, 'rgba(18,16,14,0.5)'], [1, 'rgba(26,23,20,0)']]);
    g.restore();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU;
    const from = 0.3 + rand() * 0.25;
    const to = Math.min(0.95, from + 0.2 + rand() * 0.35);
    const grad = g.createLinearGradient(Math.cos(a) * from, Math.sin(a) * from, Math.cos(a) * to, Math.sin(a) * to);
    grad.addColorStop(0, `rgba(14,13,13,${(0.14 + rand() * 0.12).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(14,13,13,0)');
    g.strokeStyle = grad;
    g.lineWidth = 0.07 + rand() * 0.08;
    g.beginPath();
    g.moveTo(Math.cos(a) * from, Math.sin(a) * from);
    g.lineTo(Math.cos(a) * to, Math.sin(a) * to);
    g.stroke();
  }
  g.fillStyle = 'rgba(12,11,10,0.45)';
  for (let i = 0; i < 10; i++) {
    const a = rand() * TAU;
    const d = 0.15 + rand() * 0.55;
    g.beginPath();
    g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.012 + rand() * 0.02, 0, TAU);
    g.fill();
  }
};

const DRAW: Record<DecalKind, Draw> = { chip, spall, dent, crack, splinter, scorch };

export function drawDecalAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * DECAL_GRID[0];
  canvas.height = CELL * DECAL_GRID[1];
  const g = canvas.getContext('2d')!;
  let seed = 11;
  for (const kind of Object.keys(DECAL_CELLS) as DecalKind[]) {
    for (const [column, row] of DECAL_CELLS[kind]) {
      g.save();
      g.beginPath();
      g.rect(column * CELL, (DECAL_GRID[1] - 1 - row) * CELL, CELL, CELL);
      g.clip();
      g.translate((column + 0.5) * CELL, (DECAL_GRID[1] - 0.5 - row) * CELL);
      g.scale(CELL / 2, CELL / 2);
      DRAW[kind](g, random(seed));
      seed += 7919;
      g.restore();
    }
  }
  return canvas;
}
