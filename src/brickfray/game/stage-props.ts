import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterId } from '../characters/types';
import { Cluster, LENS, setMaterial } from './stage-kit';
import { bubble, peak, pine, skirt, skyline, tower } from './stage-shapes';

type Build = () => Cluster[];

/**
 * What stands far behind each character, off to both sides: a few toy-brick builds that hint at its trade (a
 * builder's crane and brick pallets, a ranger's pines, a knight's towers…), lit softly from the key's side and the
 * wall's glow, darker at the foot, in the wall's own hues so they add depth without competing with the figure. A build
 * that far back stands on ground rising toward the wall (`RISE`) with its foot about 0.95 m up the screen from the
 * stand's, clear of the name column below it: the left set stays under 0.7 m to clear the logo, the right one under
 * 1.1 m to clear the buttons in the corner.
 */
const SETS: Record<CharacterId, Build> = {
  rivet: () => {
    const yard = new Cluster(-1.8, 20);
    const P = yard.pitch;
    // A pallet of bricks: runners, a deck, two courses laid crosswise, a third half done.
    yard.shadow(-0.08, 0.6);
    for (const x of [-0.31, -0.08, 0.15]) yard.brick(x, 0, 1, 6, 2, { studs: false, accent: true });
    yard.brick(-0.08, yard.plates(2), 8, 6, 1, { studs: false, accent: true });
    let y = yard.plates(3);
    for (const [x, z] of [[-0.23, -0.15], [0.07, -0.15], [-0.23, 0], [0.07, 0], [-0.23, 0.15], [0.07, 0.15]]) yard.brick(x!, y, 4, 2, 3, { z });
    y += yard.plates(3);
    for (const x of [-0.305, -0.155, -0.005, 0.145]) yard.brick(x, y, 2, 6, 3);
    y += yard.plates(3);
    for (const [x, z] of [[-0.23, -0.15], [-0.23, 0], [0.07, -0.15]]) yard.brick(x!, y, 4, 2, 3, { z });
    yard.brick(-0.16, y + yard.plates(3), 2, 2, 3, { z: -0.04 });
    // A loose stack off to the side, and a cone.
    yard.shadow(-0.62, 0.18).brick(-0.62, 0, 2, 4, 3, { yaw: 0.3 }).brick(-0.6, yard.plates(3), 2, 2, 3, { yaw: -0.2 });
    yard.shadow(0.46, 0.14).brick(0.46, 0, 3, 3, 1, { accent: true }).round(0.46, yard.plates(1), 2, 4, { top: 0.66, accent: true, studs: false });
    yard.round(0.46, yard.plates(5), 1.4, 2, { studs: false }).round(0.46, yard.plates(7), 1.1, 3, { top: 0.4, accent: true });
    const crane = new Cluster(1.56, 23);
    // A tower crane: a ladder mast of round bricks braced by plates, a cab, the jib with its hook, a counterweight.
    crane.shadow(0, 0.32).brick(0, 0, 4, 4, 3, { accent: true });
    let m = crane.plates(3);
    for (let i = 0; i < 8; i++) {
      for (const x of [-P / 2, P / 2]) crane.round(x, m, 1, 3, { studs: false });
      m += crane.plates(3);
      if (i % 3 === 2) {
        crane.brick(0, m, 2, 2, 1, { studs: false, accent: true });
        m += crane.plates(1);
      }
    }
    crane.brick(0.02, m, 3, 2, 3).slope(0.02, m + crane.plates(3), 3, 2, 2, { yaw: Math.PI });
    const jib = m + crane.plates(1);
    crane.brick(-0.4, jib, 12, 1, 1, { z: -P * 0.5 }).brick(-0.36, jib + crane.plates(1), 12, 1, 1, { z: -P * 0.5, accent: true });
    crane.brick(0.3, jib, 4, 1, 1, { z: -P * 0.5 }).brick(0.34, jib + crane.plates(1), 2, 2, 6, { accent: true });
    crane.round(-0.72, jib - 0.3, 0.3, 10, { studs: false }).brick(-0.72, jib - 0.36, 2, 1, 2, { accent: true });
    // Far off, a town going up: brick blocks of different heights in the haze.
    const town = new Cluster(-2.3, 52, 0.09);
    skyline(town, [[-0.5, 3, 9], [-0.2, 2, 15], [0.1, 4, 6], [0.42, 3, 12]]);
    const site = new Cluster(2.5, 56, 0.09);
    skyline(site, [[-0.3, 3, 12], [0, 2, 18], [0.3, 4, 9]]);
    return [yard, crane, town, site];
  },
  vega: () => {
    const peaks = new Cluster(-1.86, 30, 0.068);
    peak(peaks, 0, 12, 5);
    peak(peaks, 0.52, 8, 4, -0.25);
    peak(peaks, -0.5, 4, 4, -0.12);
    const camp = new Cluster(1.25, 21);
    // A ridge tent end-on to the lens, a flagpole with its pennant on the near side, a little fire.
    const run = camp.pitch * 1.5;
    camp.shadow(0.12, 0.36).slope(0.12 - run, 0, 6, 3, 8, { yaw: -Math.PI / 2 }).slope(0.12 + run, 0, 6, 3, 8, { yaw: Math.PI / 2 });
    let y = 0;
    camp.shadow(-0.2, 0.06);
    for (let i = 0; i < 9; i++) {
      camp.round(-0.2, y, 1, 3, { studs: i === 8 });
      y += camp.plates(3);
    }
    camp.brick(-0.08, y - camp.plates(4), 3, 1, 3, { accent: true, studs: false });
    camp.round(0.42, 0, 2, 1, { accent: true }).round(0.42, camp.plates(1), 1, 3, { top: 0.4, accent: true });
    // A mountain rising behind the camp, and a lesser one beside it running off the screen's edge.
    const ridge = new Cluster(1.32, 40, 0.068);
    peak(ridge, 0, 8, 5);
    peak(ridge, 0.6, 4, 4, -0.25);
    // A far range in the haze between the near peaks.
    const range = new Cluster(-1.05, 58, 0.075);
    peak(range, 0, 8, 4);
    peak(range, 0.5, 4, 4, -0.2);
    return [peaks, camp, ridge, range];
  },
  clack: () => {
    const wall = new Cluster(-1.84, 21);
    // A curtain wall in running bond with battlements, ending in a round tower.
    wall.shadow(-0.3, 0.5);
    const P = wall.pitch;
    for (let course = 0; course < 4; course++) {
      const y = course * wall.plates(3);
      const offset = course % 2 ? 2 : 0;
      for (let s = -12 + offset; s < 0; s += 4) {
        const w = Math.min(4, -s);
        wall.brick((s + w / 2) * P + 0.12, y, w, 2, 3, { studs: false });
      }
      if (offset) wall.brick(-11 * P + 0.12, y, 2, 2, 3, { studs: false });
    }
    for (let s = -12; s < 0; s += 3) wall.brick((s + 1) * P + 0.12, 4 * wall.plates(3), 2, 2, 3);
    tower(wall, 0.3, 4, 6, false);
    const keep = new Cluster(1.54, 24);
    tower(keep, 0, 4, 6, true);
    // A far castle on its hill in the haze.
    const far = new Cluster(-1.15, 56, 0.08);
    far.shadow(0, 0.5).brick(0, 0, 12, 4, 3).brick(0, far.plates(3), 8, 4, 3);
    tower(far, -0.2, 3, 3, true);
    tower(far, 0.24, 3, 2, false);
    return [wall, keep, far];
  },
  coral: () => {
    const rocks = new Cluster(-1.84, 19);
    // A rock pile of bricks and slopes with coral branching off it, and bubbles going up.
    rocks.shadow(-0.05, 0.62);
    rocks.brick(0, 0, 8, 4, 3).slope(-0.4, 0, 2, 4, 3, { yaw: Math.PI / 2 }).slope(0.4, 0, 2, 4, 3, { yaw: -Math.PI / 2 });
    rocks.brick(-0.04, rocks.plates(3), 5, 3, 3).slope(-0.3, rocks.plates(3), 2, 3, 3, { yaw: Math.PI / 2 }).slope(0.22, rocks.plates(3), 2, 3, 3, { yaw: -Math.PI / 2 });
    rocks.slope(-0.06, rocks.plates(6), 3, 2, 3, { yaw: Math.PI / 2 });
    rocks.shadow(-0.52, 0.2).brick(-0.52, 0, 3, 3, 3).slope(-0.52, rocks.plates(3), 3, 2, 2);
    // Branching coral: a stem of round plates leaning as it grows, side shoots of round plates on short arms.
    for (const [x, n, lean] of [[0.24, 9, 1], [0.12, 6, -1], [-0.2, 7, 1]] as const) {
      let y = rocks.plates(6);
      for (let i = 0; i < n; i++) {
        const at = x + lean * Math.sin(i * 0.5) * 0.03;
        rocks.round(at, y, 1, 2, { accent: true, studs: i === n - 1 });
        if (i === 3 || i === 6) {
          const side = (i === 3 ? 1 : -1) * lean;
          rocks.brick(at + side * rocks.pitch * 0.5, y, 2, 1, 1, { accent: true, studs: false });
          rocks.round(at + side * rocks.pitch, y + rocks.plates(1), 1, 4, { accent: true });
        }
        y += rocks.plates(2);
      }
    }
    bubble(rocks, -0.26, 0.42, 1);
    bubble(rocks, -0.12, 0.6, 2);
    bubble(rocks, -0.3, 0.76, 1);
    const sub = new Cluster(1.52, 24);
    // A brick submarine: hull with sloped bow and stern, conning tower and periscope, portholes, a propeller.
    const keel = 0.5;
    sub.brick(0, keel, 6, 3, 6).slope(-0.3, keel, 2, 3, 6, { yaw: Math.PI / 2 }).slope(0.3, keel, 2, 3, 4, { yaw: -Math.PI / 2 });
    sub.brick(0.06, keel + sub.plates(6), 3, 2, 6).round(0.12, keel + sub.plates(12), 0.6, 9, { studs: false }).brick(0.155, keel + sub.plates(20), 2, 1, 1, { studs: false });
    for (const x of [-0.15, 0, 0.15]) sub.round(x, keel + sub.plates(3), 1, 1, { pitch: Math.PI / 2, z: 0.11, accent: true });
    sub.round(0.4, keel + sub.plates(2), 0.6, 3, { pitch: Math.PI / 2, roll: Math.PI / 2, studs: false });
    sub.brick(0.44, keel + sub.plates(1), 1, 1, 6, { studs: false, accent: true }).brick(0.44, keel + sub.plates(3), 1, 1, 1, { studs: false, roll: Math.PI / 2, accent: true });
    bubble(sub, -0.56, 0.8, 1);
    bubble(sub, -0.66, 0.94, 2);
    bubble(sub, -0.6, 1.08, 1);
    // Far reef in the murk: low rocks of bricks and slopes with coral stems standing up out of them.
    const reef = new Cluster(-1.15, 54, 0.08);
    reef.shadow(0, 0.6).brick(-0.1, 0, 6, 4, 3).slope(-0.4, 0, 2, 4, 3, { yaw: Math.PI / 2 }).slope(0.2, 0, 2, 4, 3, { yaw: -Math.PI / 2 });
    reef.brick(0.34, 0, 3, 3, 2).slope(0.34, reef.plates(2), 3, 2, 2).brick(-0.14, reef.plates(3), 3, 3, 3).slope(-0.14, reef.plates(6), 3, 2, 2);
    for (const [x, n] of [[-0.3, 6], [0.06, 9], [0.44, 5]] as const) {
      for (let i = 0; i < n; i++) reef.round(x + Math.sin(i * 0.6) * 0.02, reef.plates(3 + i * 2), 1, 2, { accent: true, studs: i === n - 1 });
    }
    return [rocks, sub, reef];
  },
  moss: () => {
    const left = new Cluster(-1.78, 18, 0.065);
    pine(left, 0, 0.8);
    pine(left, -0.4, 0.58);
    const far = new Cluster(-1.3, 32, 0.065);
    pine(far, 0, 0.6);
    const right = new Cluster(1.5, 21, 0.065);
    pine(right, 0, 1.08);
    pine(right, 0.4, 0.72);
    const back = new Cluster(2.3, 34, 0.065);
    pine(back, 0, 0.8);
    // A far treeline in the haze.
    const wood = new Cluster(-2.1, 56, 0.07);
    for (const [x, h] of [[-0.55, 0.5], [-0.25, 0.62], [0.05, 0.46], [0.35, 0.58]] as const) pine(wood, x, h);
    return [left, far, right, back, wood];
  },
  nova: () => {
    const moon = new Cluster(-1.8, 30);
    // A ringed planet of stacked round plates, two little moons.
    const R = 0.23;
    const step = moon.plates(1);
    for (let y = -R; y < R - step / 2; y += step) {
      const mid = y + step / 2;
      const size = (2 * Math.sqrt(Math.max(0, R * R - mid * mid))) / moon.pitch;
      if (size > 0.3) moon.round(0, 0.42 + y, size, 1, { studs: y + step >= R - step / 2 });
    }
    moon.ring(0, 0.42, 0.38, 0.3, { pitch: 0.3, roll: 0.35, accent: true });
    bubble(moon, -0.52, 0.72, 1);
    bubble(moon, 0.5, 0.1, 1);
    const pad = new Cluster(1.54, 22);
    // A rocket on its pad beside a gantry.
    pad.shadow(0, 0.42).brick(0, 0, 8, 8, 1, { accent: true }).brick(0, pad.plates(1), 4, 4, 2);
    let y = pad.plates(3);
    for (let i = 0; i < 6; i++) {
      pad.round(0, y, 3, 3, { studs: false, accent: i === 4 });
      y += pad.plates(3);
    }
    pad.round(0, y, 3, 4, { top: 0.55, studs: false }).round(0, y + pad.plates(4), 1.6, 3, { top: 0.4 });
    for (const yaw of [0.5, 2.6, 4.7]) pad.slope(Math.sin(yaw) * 0.12, pad.plates(3), 1, 2, 5, { yaw, z: Math.cos(yaw) * 0.12, accent: true, studs: false });
    pad.round(0, pad.plates(13), 1, 1, { pitch: Math.PI / 2, z: 0.115, accent: true });
    let g = pad.plates(1);
    for (let i = 0; i < 9; i++) {
      pad.brick(0.31, g, 1, 1, 3, { studs: false });
      g += pad.plates(3);
      if (i === 3 || i === 7) pad.brick(0.22, g - pad.plates(1), 3, 1, 1, { studs: false, accent: true });
    }
    // Far craggy ridges of the moon's surface in the haze.
    const crags = new Cluster(-2.3, 56, 0.09);
    skyline(crags, [[-0.4, 4, 6], [-0.1, 3, 9], [0.2, 4, 4], [0.48, 2, 7]]);
    const rim = new Cluster(2.6, 58, 0.09);
    skyline(rim, [[-0.3, 3, 8], [0, 4, 5], [0.3, 2, 10]]);
    return [moon, pad, crags, rim];
  }
};

/** How high the far ground stands above the stand's floor, in meters: a near build's foot rises about 0.12 m on screen. */
const RISE = 0.5;
/** The far sets stand about 1.5 m to each side: the narrowest view, in meters across, that still shows enough of them. */
const PROPS_SPAN = 2.9;
/**
 * On a view narrower than that (an upright phone), the one build of each set kept in sight, drawn in to the screen's
 * edge on its own side, where the figure holds nothing: which of the set's builds, and how far inside the edge it stands.
 */
const NARROW: Record<CharacterId, { piece: number; inset: number }> = {
  rivet: { piece: 1, inset: 0.22 },
  vega: { piece: 0, inset: 0.35 },
  clack: { piece: 1, inset: 0.25 },
  coral: { piece: 1, inset: 0.45 },
  moss: { piece: 2, inset: 0.3 },
  nova: { piece: 1, inset: 0.3 }
};

/**
 * Where the menu's column on one side of the figure stands, in the lens's clip space (y −1 at the bottom, 1 at the
 * top): a build behind it is lifted until its foot clears the column's top, as far as the header over it allows.
 */
export interface Column {
  left: number;
  right: number;
  top: number;
  ceiling: number;
}

/** Clip-space room kept between a lifted build and the column under it or the header over it. */
const CLEAR = 0.03;

interface Piece {
  mesh: THREE.Mesh;
  side: number;
  depth: number;
}

const near = new THREE.Vector3();
const far = new THREE.Vector3();

/** The far sets, one mesh per build, built the first time a character is shown. */
export class StageProps {
  readonly group = new THREE.Group();
  private readonly look = setMaterial();
  private readonly sets = new Map<CharacterId, { group: THREE.Group; pieces: Piece[] }>();
  private shown: CharacterId | null = null;

  constructor() {
    this.group.position.y = RISE;
  }

  /** Builds `id`'s set ahead of its first show, hidden until then: building is the slow part of a first pick. */
  prebuild(id: CharacterId) {
    if (this.sets.has(id)) return;
    const group = new THREE.Group();
    const pieces = SETS[id]().map((cluster): Piece => {
      const mesh = new THREE.Mesh(mergeGeometries(cluster.parts)!, this.look.material);
      mesh.geometry.computeBoundingBox();
      for (const part of cluster.parts) part.dispose();
      mesh.frustumCulled = false;
      group.add(mesh);
      return { mesh, side: cluster.side, depth: cluster.depth };
    });
    this.sets.set(id, { group, pieces });
    group.visible = false;
    this.group.add(group);
  }

  /** Shows `id`'s set in tones of its studio: the wall darkened toward the corners for shade, lifted toward the glow where lit, the ring's colour for its accents. */
  show(id: CharacterId, palette: { wall: string; glow: string; top: string; ring: string }) {
    this.prebuild(id);
    this.shown = id;
    for (const [key, set] of this.sets) set.group.visible = key === id;
    const u = this.look.uniforms;
    const body = new THREE.Color(palette.wall).lerp(new THREE.Color(palette.top), 0.45);
    u.uShade.value.copy(body).multiplyScalar(0.28);
    u.uLit.value.copy(body).lerp(new THREE.Color(palette.glow), 0.3).multiplyScalar(1.9);
    u.uAccentShade.value.copy(body).lerp(new THREE.Color(palette.ring), 0.2).multiplyScalar(0.45);
    u.uAccentLit.value.copy(body).lerp(new THREE.Color(palette.ring), 0.3).multiplyScalar(1.45);
    const glow = new THREE.Color(palette.glow);
    u.uTint.value.copy(glow).multiplyScalar(1 / Math.max(glow.r, glow.g, glow.b, 1e-3)).lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(1.12);
  }

  /**
   * Lays the shown set out for a view from `left` to `right`, in meters across the screen at the stand, seen by a lens
   * circling the stand at `eye` with the sets stretched `stretch` times in depth; `lens` and `columns` lift a build
   * that would stand behind one of the menu's columns.
   */
  fit(left: number, right: number, eye: THREE.Vector3, stretch: number, lens?: THREE.Camera, columns: (Column | null)[] = []) {
    if (!this.shown) return;
    const wide = right - left > PROPS_SPAN;
    const keep = NARROW[this.shown];
    const distance = Math.hypot(eye.x, eye.z);
    const angle = Math.atan2(eye.x, eye.z);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.sets.get(this.shown)!.pieces.forEach((piece, i) => {
      const kept = !wide && i === keep.piece;
      piece.mesh.visible = wide || kept;
      piece.mesh.position.x = 0;
      piece.mesh.position.y = 0;
      if (!kept) return;
      // Where on the floor that far back the build must stand to show at `at` on the screen from where the lens is now.
      const at = piece.side < 0 ? left + keep.inset : right - keep.inset;
      const back = piece.depth * stretch;
      const x = (at * (distance + back * cos) - distance * back * sin) / (distance * cos + at * sin);
      piece.mesh.position.x = x - (piece.side * (LENS + piece.depth)) / LENS;
    });
    if (!lens || !columns.some(Boolean)) return;
    this.group.updateMatrixWorld(true);
    for (const piece of this.sets.get(this.shown)!.pieces) {
      const column = columns[piece.side < 0 ? 0 : 1];
      if (piece.mesh.visible && column) this.lift(piece, lens, column);
    }
  }

  /** Raises a build whose foot would show behind `column`, by what its foot is short of the column's top. */
  private lift(piece: Piece, lens: THREE.Camera, column: Column) {
    const box = piece.mesh.geometry.boundingBox!;
    const at = (x: number, y: number, out: THREE.Vector3) => out.set(x + piece.mesh.position.x, y, box.max.z).applyMatrix4(this.group.matrixWorld).project(lens);
    const x0 = at(box.min.x, box.min.y, near).x;
    const x1 = at(box.max.x, box.min.y, far).x;
    if (Math.max(x0, x1) < column.left || Math.min(x0, x1) > column.right) return;
    const foot = at((box.min.x + box.max.x) / 2, box.min.y, near).y;
    const top = at((box.min.x + box.max.x) / 2, box.max.y, far).y;
    const short = column.top + CLEAR - foot;
    if (short <= 0) return;
    const rise = Math.min(short, column.ceiling - CLEAR - top);
    if (rise > 0) piece.mesh.position.y = (rise * (box.max.y - box.min.y)) / (top - foot);
  }

  dispose() {
    for (const set of this.sets.values()) for (const piece of set.pieces) piece.mesh.geometry.dispose();
    this.look.material.dispose();
  }
}
