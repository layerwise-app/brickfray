import * as THREE from 'three';

/** Atlas cells: soft star, flame petal, soft core, energy ring, smoke puff and spark streak; hard-edged three- and four-lobed blooms (two cuts each) and a hard-edged flame tongue. */
export const Cell = { Star: 0, Petal: 1, Core: 2, Ring: 3, Puff: 4, Streak: 5, Bloom3: 6, Bloom3b: 7, Bloom4: 8, Bloom4b: 9, Tongue: 10 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];
export const CELLS = 11;

const S = 128;

/** Flat bands from the rim in: hot orange, yellow, near white; the core is drawn on top. */
const BANDS: [number, string][] = [
  [1, 'rgb(232,92,20)'],
  [0.74, 'rgb(255,186,58)'],
  [0.46, 'rgb(255,236,170)']
];
const CORE = 'rgb(255,252,240)';

/** The cards' white-hot shapes; cards tint them and fade them out. */
export function flashAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = S * CELLS;
  canvas.height = S;
  const g = canvas.getContext('2d')!;
  const radial = (cx: number, cy: number, r: number, stops: [number, string][]) => {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [at, c] of stops) grad.addColorStop(at, c);
    return grad;
  };
  const fire: [number, string][] = [[0, 'rgba(255,255,245,1)'], [0.25, 'rgba(255,236,170,0.95)'], [0.6, 'rgba(255,170,80,0.55)'], [1, 'rgba(255,120,40,0)']];
  // Star: 7 uneven spikes.
  g.save();
  g.translate(S / 2, S / 2);
  g.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = i % 2 === 0 ? S * (0.38 + 0.1 * Math.sin(i * 2.3)) : S * 0.13;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = radial(0, 0, S * 0.48, fire);
  g.fill();
  g.restore();
  // Petal: teardrop, v = 1 the far end.
  g.save();
  g.translate(S * 1.5, 0);
  g.beginPath();
  g.moveTo(0, S * 0.98);
  g.bezierCurveTo(S * 0.42, S * 0.7, S * 0.3, S * 0.2, 0, S * 0.02);
  g.bezierCurveTo(-S * 0.3, S * 0.2, -S * 0.42, S * 0.7, 0, S * 0.98);
  const pg = g.createLinearGradient(0, S, 0, 0);
  pg.addColorStop(0, 'rgba(255,252,235,1)');
  pg.addColorStop(0.35, 'rgba(255,220,150,0.9)');
  pg.addColorStop(0.75, 'rgba(255,150,70,0.45)');
  pg.addColorStop(1, 'rgba(255,110,40,0)');
  g.fillStyle = pg;
  g.fill();
  g.restore();
  // Core.
  g.fillStyle = radial(S * 2.5, S / 2, S * 0.5, fire);
  g.fillRect(S * 2, 0, S, S);
  // Ring: thin bright band with a soft halo, empty middle.
  g.fillStyle = radial(S * 3.5, S / 2, S * 0.5, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0)'], [0.78, 'rgba(255,255,255,1)'], [0.86, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
  g.fillRect(S * 3, 0, S, S);
  // Puff: lumpy soft blob.
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const cx = S * 4.5 + Math.cos(a) * S * 0.14 * (i % 3);
    const cy = S / 2 + Math.sin(a) * S * 0.14 * (i % 3);
    g.fillStyle = radial(cx, cy, S * 0.32, [[0, 'rgba(255,255,255,0.5)'], [0.6, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
    g.fillRect(S * 4, 0, S, S);
  }
  // Streak: narrow, brightest at the near end.
  const sg = g.createLinearGradient(0, S, 0, 0);
  sg.addColorStop(0, 'rgba(255,255,255,1)');
  sg.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sg;
  g.beginPath();
  g.moveTo(S * 5.5 - S * 0.12, S);
  g.lineTo(S * 5.5 + S * 0.12, S);
  g.lineTo(S * 5.5 + S * 0.03, 0);
  g.lineTo(S * 5.5 - S * 0.03, 0);
  g.closePath();
  g.fill();
  // Blooms: pointed lobes (length, half-angle) round a white core, so a flash keeps its outline as it fades.
  bloom(g, Cell.Bloom3, [[1, 0.42], [0.78, 0.36], [0.9, 0.4]], 0.2);
  bloom(g, Cell.Bloom3b, [[0.84, 0.46], [1, 0.34], [0.7, 0.42]], -0.35);
  bloom(g, Cell.Bloom4, [[1, 0.36], [0.72, 0.32], [0.92, 0.36], [0.66, 0.3]], 0.1);
  bloom(g, Cell.Bloom4b, [[0.86, 0.3], [1, 0.38], [0.64, 0.34], [0.94, 0.32]], 0.5);
  tongue(g, Cell.Tongue);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function bloom(g: CanvasRenderingContext2D, cell: number, lobes: [number, number][], turn: number) {
  g.save();
  g.translate(S * cell + S / 2, S / 2);
  for (const [scale, color] of BANDS) {
    g.beginPath();
    lobes.forEach(([len, half], i) => {
      const a = turn + (i / lobes.length) * Math.PI * 2;
      const r = S * 0.48 * len * scale;
      const w = half * (0.8 + 0.2 * scale);
      const c = r * 0.55;
      g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(a - w) * c, Math.sin(a - w) * c, Math.cos(a) * r, Math.sin(a) * r);
      g.quadraticCurveTo(Math.cos(a + w) * c, Math.sin(a + w) * c, 0, 0);
    });
    g.fillStyle = color;
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, S * 0.12, 0, Math.PI * 2);
  g.fillStyle = CORE;
  g.fill();
  g.restore();
}

/** A flame tongue along the barrel: narrow at the muzzle (v = 0), full a third of the way out, a sharp point at v = 1. */
function tongue(g: CanvasRenderingContext2D, cell: number) {
  g.save();
  g.translate(S * cell + S / 2, 0);
  for (const [scale, color] of BANDS) {
    const w = S * 0.46 * scale;
    const tip = S * (1 - 0.98 * scale);
    g.beginPath();
    g.moveTo(-w * 0.4, S);
    g.bezierCurveTo(-w * 1.1, S * 0.72, -w * 0.9, S * 0.4, 0, tip);
    g.bezierCurveTo(w * 0.9, S * 0.4, w * 1.1, S * 0.72, w * 0.4, S);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }
  g.beginPath();
  g.ellipse(0, S * 0.86, S * 0.07, S * 0.13, 0, 0, Math.PI * 2);
  g.fillStyle = CORE;
  g.fill();
  g.restore();
}
