import * as THREE from 'three';
import type { QualityProfile } from '../engine/quality';
import { BONE, BONES, type BoneName, type V3 } from './skeleton';
import * as S from './shapes';

/** Surface look per part, baked into the `surface` vertex attribute (roughness, metalness, glow, tint flag; 0.25 there marks cloth). */
export type Look = 'plastic' | 'gloss' | 'cloth' | 'matte' | 'rubber' | 'skin' | 'metal' | 'chrome' | 'gold' | 'glow' | 'glass' | 'tint';

const LOOKS: Record<Exclude<Look, 'glass'>, [number, number, number, number]> = {
  plastic: [0.36, 0, 0, 0],
  gloss: [0.16, 0, 0, 0],
  cloth: [0.9, 0, 0, 0.25],
  matte: [1, 0, 0, 0],
  rubber: [0.88, 0, 0, 0],
  skin: [0.55, 0, 0, 0],
  metal: [0.32, 0.85, 0, 0],
  chrome: [0.12, 1, 0, 0],
  gold: [0.2, 1, 0, 0],
  glow: [0.5, 0, 1.8, 0],
  tint: [0.4, 0, 0.12, 1]
};

/** `grip` wraps a pistol grip, `cup` holds a handguard from below, `hold` closes around a handle that runs across the palm; the rest are free hands. */
export type HandShape = 'grip' | 'cup' | 'hold' | 'fist' | 'open' | 'relaxed' | 'point';
export interface Hands {
  L: HandShape;
  R: HandShape;
}
/** The hands every match build has: on the gun. */
export const DEFAULT_HANDS: Hands = { L: 'cup', R: 'grip' };

export interface PartOptions {
  at?: V3;
  rot?: V3;
  scale?: V3;
  look?: Look;
}

interface Piece {
  geometry: THREE.BufferGeometry;
  bone: number;
  color: THREE.Color;
  look: Look;
  matrix: THREE.Matrix4;
}

export interface BakedCharacter {
  main: THREE.BufferGeometry;
  glass: THREE.BufferGeometry | null;
  /** Per-bone pieces in bone-local space, centered; `center` is the bone-local offset. */
  pieces: { bone: number; geometry: THREE.BufferGeometry; glass: boolean; center: THREE.Vector3 }[];
  triangles: number;
}

/**
 * Costumes are drawn on a slim torso and every torso part is deepened by this much when it is added,
 * so the body has a chest and a seat in profile and each garment keeps its fit.
 */
export const TORSO_DEPTH = 1.12;
/** Share of the medium tier's segment counts the lean low tier keeps. */
const LEAN = 0.5;
const TORSO = new Set<BoneName>(['pelvis', 'spine', 'chest']);
const deepen = new THREE.Matrix4().makeScale(1, 1, TORSO_DEPTH);

const e = new THREE.Euler();
const q = new THREE.Quaternion();
const v = new THREE.Vector3();
const sc = new THREE.Vector3();

/**
 * Collects a character's parts in bone-local space (each bone's origin at its
 * joint, rest rotation identity) and bakes one rigidly skinned geometry plus
 * an optional glass geometry. Shape helpers pick segment counts per tier.
 */
export class PartSet {
  readonly pieces: Piece[] = [];
  readonly detail: 0 | 1 | 2;
  /** Showroom build: seen close up, so rounder shapes and the extra parts behind `if (b.hero)`. */
  readonly hero: boolean;
  /** Hand shapes to build; a showroom stance picks them. */
  readonly hands: Hands;
  /** Low tier cut from the medium design: every costume part kept, with the low tier's segment counts and no bevels. */
  readonly lean: boolean;

  constructor(
    readonly profile: QualityProfile,
    options: { hero?: boolean; hands?: Hands; lean?: boolean } = {}
  ) {
    this.hero = options.hero ?? false;
    this.lean = !this.hero && profile.detail === 0 && (options.lean ?? false);
    this.detail = this.hero ? 2 : this.lean ? 1 : profile.detail;
    this.hands = options.hands ?? DEFAULT_HANDS;
  }

  /** Segment count for the current tier. */
  seg(low: number, medium: number, high: number) {
    if (this.hero) return Math.round(high * 1.7);
    if (this.lean) return low;
    return this.detail === 0 ? low : this.detail === 1 ? medium : high;
  }

  get bevel() {
    return this.detail === 0 || this.lean ? 0 : this.detail === 1 ? 0.008 : 0.012;
  }

  /** A costume's medium-tier count, cut down on the lean low tier; even counts stay even (symmetric parts). */
  cut(n: number) {
    if (!this.lean) return n;
    const m = Math.max(Math.min(n, n >= 6 ? 6 : 3), Math.round(n * LEAN));
    return Math.min(n, n % 2 ? m : m + (m % 2));
  }

  add(bone: BoneName, geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOptions = {}) {
    const [rx, ry, rz] = o.rot ?? [0, 0, 0];
    q.setFromEuler(e.set(rx, ry, rz, 'YXZ'));
    v.set(...(o.at ?? [0, 0, 0]));
    sc.set(...(o.scale ?? [1, 1, 1]));
    const matrix = new THREE.Matrix4().compose(v, q, sc);
    if (TORSO.has(bone)) matrix.premultiply(deepen);
    this.pieces.push({ geometry, bone: BONE[bone], color: new THREE.Color(color), look: o.look ?? 'plastic', matrix });
    return this;
  }

  box(bone: BoneName, size: V3, color: THREE.ColorRepresentation, o: PartOptions & { bevel?: number } = {}) {
    const b = o.bevel ?? Math.min(this.bevel, Math.min(...size) * 0.3);
    return this.add(bone, S.box(size[0], size[1], size[2], this.detail === 0 || this.lean ? 0 : b), color, o);
  }

  /** Tapered box: bottom [w, d] to top [w, d] over height h. */
  taper(bone: BoneName, bottom: [number, number], top: [number, number], h: number, color: THREE.ColorRepresentation, o: PartOptions & { bevel?: number; shiftZ?: number } = {}) {
    const b = this.detail === 0 || this.lean ? 0 : (o.bevel ?? this.bevel * 1.4);
    return this.add(bone, S.taper(bottom[0], bottom[1], top[0], top[1], h, b, o.shiftZ ?? 0), color, o);
  }

  cyl(bone: BoneName, rTop: number, rBottom: number, h: number, color: THREE.ColorRepresentation, o: PartOptions & { seg?: number; open?: boolean } = {}) {
    return this.add(bone, S.cylinder(rTop, rBottom, h, o.seg ?? this.seg(6, 12, 18), o.open), color, o);
  }

  ball(bone: BoneName, r: number, color: THREE.ColorRepresentation, o: PartOptions = {}) {
    const n = this.sized(r * 2);
    return this.add(bone, S.sphere(r, n, Math.max(4, Math.round(n * 0.7))), color, o);
  }

  /** Segment count by part size: small details stay cheap on every tier. */
  private sized(size: number) {
    if (size < 0.035) return this.seg(5, 6, 7);
    if (size < 0.08) return this.seg(6, 8, 10);
    if (size < 0.22) return this.seg(6, 10, 12);
    return this.seg(8, 12, 16);
  }

  dome(bone: BoneName, r: number, color: THREE.ColorRepresentation, o: PartOptions = {}) {
    const n = this.sized(r * 2);
    return this.add(bone, S.dome(r, n, Math.max(3, Math.round(n * 0.4))), color, o);
  }

  /** Rounded box (superellipsoid); low tier falls back to a plain box unless `keep`. */
  blob(bone: BoneName, size: V3, color: THREE.ColorRepresentation, o: PartOptions & { e?: number; taper?: number; keep?: boolean } = {}) {
    if (this.detail === 0 && !o.keep) return this.box(bone, size, color, o);
    const g = S.blob(size[0], size[1], size[2], o.e ?? 0.45, this.sized(Math.max(...size)), o.taper ?? 0);
    return this.add(bone, g, color, o);
  }

  /** Sphere section facing -Z (visor, faceplate). */
  section(bone: BoneName, r: number, wide: number, tall: number, color: THREE.ColorRepresentation, o: PartOptions = {}) {
    return this.add(bone, S.section(r, wide, tall, this.seg(6, 12, 18), this.seg(4, 8, 12)), color, o);
  }

  limb(bone: BoneName, rTop: number, rBottom: number, len: number, color: THREE.ColorRepresentation, o: PartOptions = {}) {
    return this.add(bone, S.limb(rTop, rBottom, len, this.seg(6, 10, 12), this.detail > 0), color, o);
  }

  torus(bone: BoneName, radius: number, tube: number, color: THREE.ColorRepresentation, o: PartOptions & { arc?: number } = {}) {
    const radial = tube < 0.015 ? this.seg(3, 4, 5) : this.seg(4, 6, 7);
    return this.add(bone, S.torus(radius, tube, radial, this.seg(8, 14, 20), o.arc), color, o);
  }

  tube(bone: BoneName, points: V3[], radius: number, color: THREE.ColorRepresentation, o: PartOptions = {}) {
    return this.add(bone, S.tube(points, radius, this.seg(4, 10, 16), this.seg(4, 6, 8)), color, o);
  }

  lathe(bone: BoneName, profile: [number, number][], color: THREE.ColorRepresentation, o: PartOptions & { seg?: number } = {}) {
    return this.add(bone, S.lathe(profile, o.seg ?? this.seg(8, 14, 22)), color, o);
  }

  /** Same part on both sides: `fn(side, sign)` with sign -1 for left, +1 for right. */
  mirror(fn: (side: 'L' | 'R', sign: number) => void) {
    fn('L', -1);
    fn('R', 1);
  }

  bake(restModel: THREE.Vector3[]): BakedCharacter {
    const main = new Batch(true);
    const glass = new Batch(false);
    const perBone = BONES.map(() => ({ solid: new Batch(true, true), glass: new Batch(false, true) }));
    const world = new THREE.Matrix4();
    for (const piece of this.pieces) {
      const rest = restModel[piece.bone]!;
      world.makeTranslation(rest.x, rest.y, rest.z).multiply(piece.matrix);
      const isGlass = piece.look === 'glass';
      (isGlass ? glass : main).push(piece, world);
      if (piece.look !== 'tint') (isGlass ? perBone[piece.bone]!.glass : perBone[piece.bone]!.solid).push(piece, piece.matrix);
    }
    const pieces: BakedCharacter['pieces'] = [];
    perBone.forEach((set, bone) => {
      for (const [batch, isGlass] of [
        [set.solid, false],
        [set.glass, true]
      ] as const) {
        if (!batch.count) continue;
        const geometry = batch.build();
        geometry.computeBoundingBox();
        const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.computeBoundingSphere();
        pieces.push({ bone, geometry, glass: isGlass, center });
      }
    });
    const mainGeometry = main.build();
    return { main: mainGeometry, glass: glass.count ? glass.build() : null, pieces, triangles: (main.count + glass.count) / 3 };
  }
}

const nm = new THREE.Matrix3();

/** Pieces gathered into one geometry, written straight into typed arrays once all of them are in. */
class Batch {
  private entries: { piece: Piece; matrix: THREE.Matrix4 }[] = [];
  private vertices = 0;

  constructor(
    private withSurface: boolean,
    private piece = false
  ) {}

  get count() {
    return this.vertices;
  }

  push(p: Piece, matrix: THREE.Matrix4) {
    this.entries.push({ piece: p, matrix: matrix.clone() });
    this.vertices += p.geometry.getAttribute('position').count;
  }

  build() {
    const n = this.vertices;
    const pos = new Float32Array(n * 3);
    const nrm = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const surf = this.withSurface ? new Float32Array(n * 4) : null;
    const bone = this.piece ? null : new Uint16Array(n * 4);
    let v = 0;
    for (const { piece: p, matrix } of this.entries) {
      const pa = (p.geometry.getAttribute('position') as THREE.BufferAttribute).array;
      const na = (p.geometry.getAttribute('normal') as THREE.BufferAttribute).array;
      const m = matrix.elements;
      const k = nm.getNormalMatrix(matrix).elements;
      const look = p.look === 'glass' ? LOOKS.gloss : LOOKS[p.look];
      const { r, g, b } = p.color;
      for (let i = 0; i < pa.length; i += 3, v++) {
        const x = pa[i]!;
        const y = pa[i + 1]!;
        const z = pa[i + 2]!;
        const w = 1 / (m[3]! * x + m[7]! * y + m[11]! * z + m[15]!);
        pos[v * 3] = (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) * w;
        pos[v * 3 + 1] = (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) * w;
        pos[v * 3 + 2] = (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!) * w;
        const nx = na[i]!;
        const ny = na[i + 1]!;
        const nz = na[i + 2]!;
        const tx = k[0]! * nx + k[3]! * ny + k[6]! * nz;
        const ty = k[1]! * nx + k[4]! * ny + k[7]! * nz;
        const tz = k[2]! * nx + k[5]! * ny + k[8]! * nz;
        const s = 1 / (Math.sqrt(tx * tx + ty * ty + tz * tz) || 1);
        nrm[v * 3] = tx * s;
        nrm[v * 3 + 1] = ty * s;
        nrm[v * 3 + 2] = tz * s;
        col[v * 3] = r;
        col[v * 3 + 1] = g;
        col[v * 3 + 2] = b;
        if (surf) surf.set(look, v * 4);
        if (bone) bone[v * 4] = p.bone;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (surf) geometry.setAttribute('surface', new THREE.BufferAttribute(surf, 4));
    if (bone) {
      const weight = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) weight[i * 4] = 1;
      geometry.setAttribute('skinIndex', new THREE.BufferAttribute(bone, 4));
      geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
    }
    return geometry;
  }
}
