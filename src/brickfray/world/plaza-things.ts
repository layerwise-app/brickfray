import type { Drawer } from './plan';
import type { Piece } from './plaza-layout';
import { BLOOMS, IRON, WOOD } from './plaza-style';
import { Pen } from './props-kit';
import { Frame, Rng, shade } from './util';

const PRODUCE: [string, string][] = [['#c8231b', '#f58a1f'], ['#f6c624', '#a6c629'], ['#5aa83f', '#2f7a34'], ['#c43a85', '#f3a6c3'], ['#f58a1f', '#f6c624']];
const PANELS = ['#2f8a3e', '#c8231b', '#1f62c7', '#f58a1f', '#1fa7a0', '#7b4fd6'];

/** A pen whose local x runs along the piece's long side and +z out of one long face, origin at the footprint centre. */
export function pieceFrame(p: Piece, flip = false) {
  const [x0, , z0] = p.min;
  const [x1, , z1] = p.max;
  const alongX = x1 - x0 >= z1 - z0;
  const turns = (alongX ? 0 : 1) + (flip ? 2 : 0);
  return { f: new Frame((x0 + x1) / 2, p.min[1], (z0 + z1) / 2, turns), len: alongX ? x1 - x0 : z1 - z0, wid: alongX ? z1 - z0 : x1 - x0, h: p.max[1] - p.min[1] };
}

const hashOf = (p: Piece) => Math.round(p.min[0] * 13 + p.min[2] * 7 + p.max[1] * 3);

/** Kiosk: coloured panels, a hatch with an awning on both long sides, a cap and a sign board up to the collider top. */
export function kiosk(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const rng = new Rng(hashOf(p));
  const panel = rng.pick(PANELS);
  const trim = '#f2f2ee';
  const cap = Math.min(h - 0.4, 2.56);
  t.box(0, 0, 0, len, 0.16, wid, '#545c63', undefined, 0.02);
  t.box(0, 0.16, 0, len - 0.12, cap - 0.16, wid - 0.12, panel, undefined, 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (len / 2 - 0.08), 0.16, sz * (wid / 2 - 0.08), 0.16, cap - 0.16, 0.16, trim, undefined, 0.02);
  for (const s of [-1, 1]) {
    const z = s * (wid / 2 - 0.05);
    const hw = Math.min(len - 0.8, 1.6);
    t.box(0, 1.05, z, hw, 0.9, 0.04, '#23303b', undefined, 0);
    t.box(0, 1.0, z + s * 0.12, hw + 0.2, 0.08, 0.3, trim, undefined, 0.01);
    // A striped awning: from below it reads as cloth, not a flat slab.
    const aw = hw + 0.3;
    const strips = 5;
    for (let i = 0; i < strips; i++) t.prism('kiosk-awn', [[0, 2.2], [0.5, 1.98], [0.5, 1.92], [0, 2.14]], aw / strips, -aw / 2 + (aw / strips) * (i + 0.5), 0, z, i % 2 ? trim : s > 0 ? panel : shade(panel, -0.05), undefined, s > 0 ? 0 : Math.PI);
    if (d.detail > 0) for (let k = 0; k < 4; k++) t.box(-hw / 2 + 0.2 + k * ((hw - 0.4) / 3), 1.08, z + s * 0.16, 0.22, rng.range(0.12, 0.26), 0.16, rng.pick(BLOOMS), undefined, 0.01);
  }
  t.box(0, cap, 0, len + 0.3, 0.14, wid + 0.3, trim, undefined, 0.03);
  if (h - cap > 0.5) {
    t.box(0, cap + 0.14, 0, len - 0.4, h - cap - 0.3, wid - 0.4, shade(panel, -0.1), undefined, 0.03);
    t.box(0, h - 0.16, 0, len - 0.1, 0.16, wid - 0.1, trim, undefined, 0.03);
    for (const s of [-1, 1]) t.box(0, cap + 0.3, s * (wid / 2 - 0.19), len - 0.8, h - cap - 0.7, 0.04, rng.pick(['#f6c624', '#f2f2ee', '#f3a6c3']), undefined, 0.01);
  } else t.box(0, cap + 0.14, 0, len - 0.2, h - cap - 0.14, wid - 0.2, shade(panel, -0.1), undefined, 0.02);
}

/** Market counter: a wooden body with crates of produce on top. */
export function counter(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const rng = new Rng(hashOf(p));
  t.box(0, 0, 0, len, h - 0.28, wid, '#b98a5a', undefined, 0.02);
  t.box(0, 0.1, 0, len + 0.04, 0.5, wid + 0.04, rng.pick(PANELS), undefined, 0.01);
  const crates = Math.max(1, Math.round(len / 0.9));
  const cw = len / crates;
  for (let i = 0; i < crates; i++) {
    const x = -len / 2 + cw * (i + 0.5);
    const [c1, c2] = rng.pick(PRODUCE);
    t.box(x, h - 0.28, 0, cw - 0.06, 0.16, wid - 0.06, '#9a6a3f', undefined, 0.01);
    if (d.detail === 0) t.box(x, h - 0.12, 0, cw - 0.16, 0.1, wid - 0.16, c1!, undefined, 0.02);
    else for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 2; iz++) t.ball(x - cw / 3 + (ix * cw) / 3, h - 0.06, (iz - 0.5) * (wid / 2.2), Math.min(0.11, cw / 7), (ix + iz) % 3 ? c1! : c2!);
  }
}

/** Shelving: a back board and shelves of goods (bread, boxes, jars) or a stack of washing machines. */
export function shelf(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const rng = new Rng(hashOf(p));
  if (p.tag === 'laundrette') {
    t.box(0, 0, 0, len, h, wid, '#e9e6dc', undefined, 0.03);
    const n = Math.max(1, Math.round(len / 0.8));
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
      const x = -len / 2 + (len / n) * (i + 0.5);
      t.ringUp(x, 0.6 + k * 1.1, s * (wid / 2 + 0.01), 0.24, 0.05, '#9aa3ab', 'chrome');
      t.cylZ(x, 0.6 + k * 1.1, s * (wid / 2 - 0.01), 0.2, 0.02, '#4f6476', 'glass');
    }
    return;
  }
  t.box(0, 0, 0, len, h, 0.12, WOOD, undefined, 0.01);
  for (const s of [-1, 1]) for (const y of [0.1, 0.7, 1.3, 1.9]) {
    t.box(0, y, s * (wid / 4 + 0.03), len, 0.06, wid / 2 - 0.06, '#b98a5a', undefined, 0.01);
    if (y > 1.9) continue;
    if (d.detail === 0) {
      t.box(0, y + 0.06, s * (wid / 4 + 0.03), len - 0.16, 0.26, 0.26, p.tag === 'bakery' ? '#c99a3e' : rng.pick(PANELS), undefined, 0.01);
      continue;
    }
    const n = Math.max(2, Math.round(len / 0.35));
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + (len / n) * (i + 0.5);
      const z = s * (wid / 4 + 0.03);
      if (p.tag === 'florist') {
        t.cyl(x, y + 0.06, z, 0.1, 0.18, '#b44a31', undefined, 0.01, 8);
        t.ball(x, y + 0.34, z, 0.15, rng.pick(BLOOMS), [1, 0.8, 1]);
      } else if (p.tag === 'bakery') t.ball(x, y + 0.16, z, 0.13, rng.pick(['#c99a3e', '#b07a3a', '#e0b46a']), [1.3, 0.75, 0.9]);
      else t.box(x, y + 0.06, z, len / n - 0.06, rng.range(0.18, 0.4), 0.26, rng.pick([...PANELS, '#f2f2ee', '#f6c624']), undefined, 0.01);
    }
  }
  for (const x of [-len / 2 + 0.04, len / 2 - 0.04]) t.box(x, 0, 0, 0.08, h, wid, WOOD, undefined, 0.01);
}

/** Railings: posts, a top rail and a mid rail (bullets pass, players don't). */
export function railing(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const color = p.surface === 'wood' ? WOOD : IRON;
  const posts = Math.max(1, Math.round(len / 1.2));
  for (let i = 0; i <= posts; i++) t.box(-len / 2 + (len * i) / posts, 0, 0, 0.07, h, Math.min(wid, 0.07), color, 'metal', 0);
  t.box(0, h - 0.07, 0, len, 0.07, Math.min(wid, 0.12), color, 'metal', 0);
  if (h > 0.6) t.box(0, h * 0.45, 0, len, 0.05, Math.min(wid, 0.06), color, 'metal', 0);
  if ((h > 2.4 || p.tag === 'railing') && d.detail > 0) for (let i = 0; i < posts * 3; i++) t.box(-len / 2 + (len * (i + 0.5)) / (posts * 3), 0, 0, 0.03, h, 0.03, color, 'metal', 0);
}

/** Construction hoarding: painted ply with posters and a capping strip. */
export function hoarding(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const rng = new Rng(hashOf(p));
  const base = p.min[1];
  t.box(0, 0, 0, len, h, wid, '#2a5fa8', undefined, 0.01);
  t.box(0, h - 0.12, 0, len + 0.04, 0.12, wid + 0.08, '#f2f2ee', undefined, 0.01);
  if (base > 0 || d.detail === 0) return;
  const n = Math.floor(len / 1.6);
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    if (rng.chance(0.35)) continue;
    const x = -len / 2 + (len / n) * (i + 0.5);
    t.box(x, 0.5, s * (wid / 2 + 0.005), 1.0, 1.3, 0.01, rng.pick(['#f6c624', '#f2f2ee', '#c8231b', '#f58a1f']), undefined, 0);
    t.box(x, 0.9, s * (wid / 2 + 0.012), 0.7, 0.5, 0.01, rng.pick(['#2f363d', '#1fa7a0', '#7b4fd6']), undefined, 0);
  }
}

/** Hedge (low) or a brick garden wall with a stone coping (tall). */
export function garden(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  if (h <= 1.3 || p.tag === 'yew') {
    const yew = p.tag === 'yew';
    t.box(0, 0, 0, len, h - 0.1, wid, yew ? '#1f4f2a' : '#2f7a34', undefined, 0.06);
    const n = Math.max(2, Math.round(len / 0.6));
    for (let i = 0; i < n; i++) t.box(-len / 2 + (len / n) * (i + 0.5), h - 0.2, 0, len / n + 0.04, 0.2, wid + 0.06, yew ? (i % 2 ? '#26603a' : '#2f6a3a') : i % 2 ? '#3f8f3a' : '#5aa83f', undefined, 0.07);
    return;
  }
  t.box(0, 0, 0, len, h - 0.16, wid, '#b44a31', undefined, 0.02);
  t.box(0, h - 0.16, 0, len + 0.08, 0.16, wid + 0.12, '#e3d6bc', undefined, 0.02);
  for (const s of [-1, 1]) {
    t.box(0, 0, s * (wid / 2), len, 0.32, 0.04, '#8a3b2a', undefined, 0);
    if (d.detail === 0) continue;
    for (let u = -len / 2 + 1.2; u < len / 2 - 0.6; u += 2.4) t.box(u, 0, s * (wid / 2 + 0.04), 0.36, h - 0.16, 0.08, '#a8452e', undefined, 0.01);
  }
}

/** Stacks by what they are: timber, crates, a box lorry, the boat on its cradle, site materials, a skip. */
export function stack(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const rng = new Rng(hashOf(p));
  switch (p.tag) {
    case 'van': {
      const cab = 1.6;
      t.box(-cab / 2, 0.5, 0, len - cab, h - 0.5, wid, '#f2f2ee', undefined, 0.06);
      t.box(-cab / 2, 1.2, 0, len - cab + 0.02, 0.4, wid + 0.02, '#c8231b', undefined, 0.01);
      t.box(len / 2 - cab / 2, 0.5, 0, cab - 0.1, h - 0.9, wid - 0.1, '#1f62c7', undefined, 0.08);
      t.box(len / 2 - 0.04, 1.4, 0, 0.06, 0.7, wid - 0.4, '#8fb9cf', 'glass', 0.01);
      for (const s of [-1, 1]) t.box(len / 2 - cab / 2, 1.4, s * (wid / 2 - 0.04), cab - 0.6, 0.6, 0.06, '#8fb9cf', 'glass', 0.01);
      t.box(0, 0.24, 0, len, 0.28, wid - 0.1, '#2f363d', undefined, 0.02);
      for (const x of [-len / 2 + 0.9, len / 2 - 0.9]) for (const s of [-1, 1]) t.cylZ(x, 0.42, s * (wid / 2 - 0.12), 0.42, 0.3, '#1f2328', 'rubber', 0.04);
      return;
    }
    case 'shed': {
      for (const x of [-len / 2 + 0.6, len / 2 - 0.6]) t.box(x, 0, 0, 0.3, 0.7, wid, WOOD, undefined, 0.01);
      t.box(0, 0.6, 0, len - 0.2, 0.5, wid - 0.5, '#f2f2ee', undefined, 0.08);
      t.box(0, 1.1, 0, len, 0.36, wid, '#1f62c7', undefined, 0.08);
      t.box(len / 2 - 0.3, 0.9, 0, 0.6, 0.5, wid * 0.5, '#1f62c7', undefined, 0.08);
      t.box(0, h - 0.14, 0, len - 0.3, 0.14, wid - 0.1, '#c8231b', undefined, 0.03);
      if (d.detail > 0) for (const x of [-0.8, 0.4]) t.box(x, 1.2, 0, 0.12, 0.3, wid - 0.2, '#b98a5a', undefined, 0.01);
      return;
    }
    case 'skip': {
      t.box(0, 0.1, 0, len - 0.4, h - 0.1, wid, '#f6c624', undefined, 0.04);
      t.box(0, h - 0.2, 0, len, 0.2, wid + 0.06, '#e0a81a', undefined, 0.02);
      if (d.detail > 0) for (let i = 0; i < 6; i++) t.box(rng.range(-len / 3, len / 3), h - 0.1, rng.range(-wid / 3, wid / 3), rng.range(0.3, 0.7), 0.16, 0.2, rng.pick(['#8a5f3a', '#9aa3ab', '#c9c6bd']), undefined, 0.01, rng.range(0, 3));
      return;
    }
    case 'site': {
      const pallets = Math.max(1, Math.round(len / 1.2));
      for (let i = 0; i < pallets; i++) {
        const x = -len / 2 + (len / pallets) * (i + 0.5);
        t.box(x, 0, 0, len / pallets - 0.08, 0.14, wid, WOOD, undefined, 0.01);
        t.box(x, 0.14, 0, len / pallets - 0.16, h - 0.24, wid - 0.1, rng.pick(['#b44a31', '#c9c6bd', '#a6abaf']), undefined, 0.02);
        t.box(x, h - 0.1, 0, len / pallets - 0.12, 0.1, wid - 0.06, '#e9e6dc', undefined, 0.01);
      }
      return;
    }
    default: {
      if (h >= 2.3) {
        const layers = Math.round(h / 0.3);
        for (let k = 0; k < layers; k++) t.box(0, k * (h / layers), 0, len - (k % 2) * 0.1, h / layers - 0.02, wid - ((k + 1) % 2) * 0.1, k % 3 ? '#b98a5a' : '#a8774a', undefined, 0.01);
        for (const x of [-len / 3, len / 3]) t.box(x, 0, 0, 0.08, h + 0.02, wid + 0.04, IRON, 'metal', 0);
        return;
      }
      const cols = Math.max(1, Math.round(len / 0.9));
      const rows = Math.max(1, Math.round(wid / 0.9));
      const tiers = Math.max(1, Math.round(h / 0.9));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) for (let k = 0; k < tiers; k++) {
        const s = len / cols;
        const w = wid / rows;
        const x = -len / 2 + s * (i + 0.5);
        const z = -wid / 2 + w * (j + 0.5);
        const c = rng.pick(['#b98a5a', '#a8774a', '#c99a3e']);
        t.box(x, k * (h / tiers), z, s - 0.04, h / tiers - 0.02, w - 0.04, c, undefined, 0.02);
        if (d.detail > 0) t.box(x, k * (h / tiers) + h / tiers / 2 - 0.05, z, s, 0.1, w + 0.01, shade(c, -0.18), undefined, 0);
      }
    }
  }
}
