import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { chamferBox } from '../engine/geometry';

/** Lens distance the sets are laid out for (see `StageSet`). */
export const LENS = 6.5;
/** The light the far sets are shaded for: the key from above left and in front, and the wall's pool of light behind the figure. */
const KEY = new THREE.Vector3(-0.5, 0.72, 0.48).normalize();

/** Toy-brick proportions as fractions of the stud pitch, the same as the game's own bricks. */
const PLATE = 0.4;
const STUD_R = 0.3;
const STUD_H = 0.2;
const GAP = 0.02;

export interface PartOptions {
  /** Toward the lens, in meters. */
  z?: number;
  yaw?: number;
  /** Roll about the view axis, then pitch about the lateral axis, applied before the yaw. */
  roll?: number;
  pitch?: number;
  /** Drawn in the set's accent tone instead of its body tone. */
  accent?: boolean;
  /** Studs on top; false makes a tile. */
  studs?: boolean;
}

/**
 * One cluster of a far set, built from toy bricks. Sizes and positions are in meters as they appear beside the figure:
 * the cluster is scaled up by its depth, so a stack 1 m tall here looks 1 m tall on screen wherever it stands. Each
 * vertex carries how lit it is (red) and whether it is accent (green); the set's material turns those into colour.
 */
export class Cluster {
  readonly parts: THREE.BufferGeometry[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion();
  /** Each brick's own shade, from a fixed sequence so a set looks the same every time. */
  private seed: number;
  /** Which way the wall's light pool lies from here: toward the middle of the screen. */
  private readonly pool: THREE.Vector3;

  /** `side` is where it shows left or right of the figure, `depth` how far behind the stand it stands, `pitch` its stud pitch in meters. */
  constructor(
    readonly side: number,
    readonly depth: number,
    readonly pitch = 0.075
  ) {
    const scale = (LENS + depth) / LENS;
    this.matrix.compose(new THREE.Vector3(side * scale, 0, -depth), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
    this.pool = new THREE.Vector3(-Math.sign(side), 0.35, -0.5).normalize();
    this.seed = Math.round(Math.abs(side * 977 + depth * 131)) % 2147483646 || 1;
  }

  /** Height of `n` plates. */
  plates(n: number) {
    return n * PLATE * this.pitch;
  }

  /**
   * A block `w` × `d` studs and `h` plates tall standing on `y`, centred on `x`, laid the way a builder would: courses
   * one brick (three plates) high, each course of bricks at most four studs long in running bond, studs on top only.
   */
  brick(x: number, y: number, w: number, d: number, h: number, o: PartOptions = {}) {
    const P = this.pitch;
    const courses: number[] = [];
    if (w <= 1 || d <= 1) courses.push(h);
    else for (let left = h; left > 0; left -= Math.min(3, left)) courses.push(Math.min(3, left));
    let base = 0;
    courses.forEach((plates, c) => {
      const height = this.plates(plates) - GAP * P;
      for (const [i0, wi] of lay(w, c)) {
        for (const [j0, dj] of lay(d, c + 1)) {
          const ox = (i0 + wi / 2 - w / 2) * P;
          const oz = (j0 + dj / 2 - d / 2) * P;
          const box = chamferBox(wi * P - GAP * P * 2, height, dj * P - GAP * P * 2, P * 0.09);
          box.translate(ox, base + height / 2, oz);
          const pieces: THREE.BufferGeometry[] = [box];
          if (o.studs !== false && c === courses.length - 1) {
            for (let i = 0; i < wi; i++) for (let j = 0; j < dj; j++) pieces.push(this.stud(ox + (i - (wi - 1) / 2) * P, base + height, oz + (j - (dj - 1) / 2) * P));
          }
          this.add(pieces, x, y, o);
        }
      }
      base += this.plates(plates);
    });
    return this;
  }

  /** A round brick `size` studs across and `h` plates tall; `top` narrows its upper end (a cone at 0.45). */
  round(x: number, y: number, size: number, h: number, o: PartOptions & { top?: number } = {}) {
    const P = this.pitch;
    const r = (size * P) / 2 - GAP * P;
    const height = this.plates(h) - GAP * P;
    const top = r * (o.top ?? 1);
    const body = new THREE.CylinderGeometry(top, r, height, Math.max(10, Math.round(size * 8)), 1);
    body.translate(0, height / 2, 0);
    const pieces: THREE.BufferGeometry[] = [body];
    if (o.studs !== false && top > STUD_R * P) pieces.push(this.stud(0, height, 0));
    return this.add(pieces, x, y, o);
  }

  /** A slope `w` studs wide falling over `d` studs toward the lens (turn it with `yaw`), `h` plates tall at its back. */
  slope(x: number, y: number, w: number, d: number, h: number, o: PartOptions = {}) {
    const P = this.pitch;
    const height = this.plates(h) - GAP * P;
    const depth = d * P - GAP * P * 2;
    const back = Math.min(P, depth / 2);
    const lip = Math.min(this.plates(1) * 0.6, height * 0.3);
    const shape = new THREE.Shape([
      new THREE.Vector2(-depth / 2, 0),
      new THREE.Vector2(depth / 2, 0),
      new THREE.Vector2(depth / 2, lip),
      new THREE.Vector2(-depth / 2 + back, height),
      new THREE.Vector2(-depth / 2, height)
    ]);
    // A long run is several slopes side by side.
    for (const [i0, wi] of lay(w, 0)) {
      const width = wi * P - GAP * P * 2;
      const ox = (i0 + wi / 2 - w / 2) * P;
      const wedge = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
      wedge.rotateY(-Math.PI / 2);
      wedge.translate(ox + width / 2, 0, 0);
      const pieces: THREE.BufferGeometry[] = [wedge];
      if (o.studs !== false) for (let i = 0; i < wi; i++) pieces.push(this.stud(ox + (i - (wi - 1) / 2) * P, height, -depth / 2 + back / 2));
      this.add(pieces, x, y, o);
    }
    return this;
  }

  /** A flat ring plate (outer and inner radius in meters) with studs round it, like a big round plate with a hole. */
  ring(x: number, y: number, outer: number, inner: number, o: PartOptions = {}) {
    const P = this.pitch;
    const height = this.plates(1) - GAP * P;
    const shape = new THREE.Shape().absarc(0, 0, outer, 0, Math.PI * 2, false);
    shape.holes.push(new THREE.Path().absarc(0, 0, inner, 0, Math.PI * 2, true));
    const disc = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 40 });
    disc.rotateX(-Math.PI / 2);
    const pieces: THREE.BufferGeometry[] = [disc];
    const mid = (outer + inner) / 2;
    const count = Math.floor((Math.PI * 2 * mid) / P);
    if (o.studs !== false) for (let i = 0; i < count; i++) pieces.push(this.stud(Math.cos((i / count) * Math.PI * 2) * mid, height, -Math.sin((i / count) * Math.PI * 2) * mid));
    return this.add(pieces, x, y, o);
  }

  /** The dark patch a stack leaves on the floor round its foot. */
  shadow(x: number, radius: number, z = 0) {
    const patch = new THREE.CircleGeometry(radius, 24);
    patch.rotateX(-Math.PI / 2);
    patch.scale(1, 1, 0.6);
    patch.translate(0, 0.003, 0);
    const part = strip(patch.toNonIndexed());
    patch.dispose();
    part.translate(x, 0, z);
    part.setAttribute('color', new THREE.BufferAttribute(new Float32Array(part.getAttribute('position').count * 3), 3));
    part.deleteAttribute('normal');
    part.applyMatrix4(this.matrix);
    this.parts.push(part);
    return this;
  }

  private stud(x: number, y: number, z: number) {
    const P = this.pitch;
    const side = new THREE.CylinderGeometry(STUD_R * P, STUD_R * P, STUD_H * P, 12, 1, true);
    side.translate(0, (STUD_H * P) / 2, 0);
    const cap = new THREE.CircleGeometry(STUD_R * P, 12);
    cap.rotateX(-Math.PI / 2);
    cap.translate(0, STUD_H * P, 0);
    const stud = mergeGeometries([side.toNonIndexed(), cap.toNonIndexed()].map(strip))!;
    stud.translate(x, y, z);
    return stud;
  }

  private add(pieces: THREE.BufferGeometry[], x: number, y: number, o: PartOptions) {
    const part = mergeGeometries(pieces.map((g) => strip(g.index ? g.toNonIndexed() : g)))!;
    // Each brick darkens toward its own foot, so every course meets the one below at a dark seam.
    part.computeBoundingBox();
    const { min, max } = part.boundingBox!;
    const tall = Math.max(1e-4, max.y - min.y);
    const local = Float32Array.from({ length: part.getAttribute('position').count }, (_, i) => (part.getAttribute('position').getY(i) - min.y) / tall);
    this.turn.setFromEuler(new THREE.Euler(o.pitch ?? 0, o.yaw ?? 0, o.roll ?? 0, 'YXZ'));
    part.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, o.z ?? 0), this.turn, new THREE.Vector3(1, 1, 1)));
    const normal = part.getAttribute('normal');
    const position = part.getAttribute('position');
    const tone = new Float32Array(normal.count * 3);
    const n = new THREE.Vector3();
    this.seed = (this.seed * 16807) % 2147483647;
    const shade = (this.seed - 1) / 2147483646;
    for (let i = 0; i < normal.count; i++) {
      n.fromBufferAttribute(normal, i).normalize();
      // Key light, a little sky from above, the pool's glow on the sides that face it, and a rim from high behind on
      // what faces up or turns away from the lens (top bevels, the flanks of studs and bricks); darker toward the set's
      // foot and each brick's own.
      const rim = 0.9 * Math.max(0, n.y) ** 1.5 + (n.y > -0.2 ? 0.35 * (1 - Math.abs(n.z)) : 0);
      const lit = 0.02 + 0.8 * Math.max(0, n.dot(KEY)) + 0.06 * (0.5 + 0.5 * n.y) + 0.35 * Math.max(0, n.dot(this.pool)) + rim;
      const foot = 0.55 + 0.45 * THREE.MathUtils.smoothstep(position.getY(i), 0, 0.35);
      // Bevels facing down sit in the seam's shadow.
      const seam = (0.7 + 0.3 * THREE.MathUtils.smoothstep(local[i]!, 0, 0.42)) * (n.y < -0.3 ? 0.4 : 1);
      tone[i * 3] = Math.min(1, lit * foot * seam);
      tone[i * 3 + 1] = o.accent ? 1 : 0;
      tone[i * 3 + 2] = shade;
    }
    part.setAttribute('color', new THREE.BufferAttribute(tone, 3));
    part.deleteAttribute('normal');
    part.applyMatrix4(this.matrix);
    this.parts.push(part);
    for (const piece of pieces) piece.dispose();
    return this;
  }
}

/**
 * Bricks along a run of `n` studs in course `c`: where each starts and how long it is, at most four long and never a
 * single stud left over; odd courses start half a brick in so the joints alternate. A run of four or less, or one that
 * is not whole studs, is one piece.
 */
function lay(n: number, c: number): [number, number][] {
  if (n <= 4 || !Number.isInteger(n)) return [[0, n]];
  const out: [number, number][] = [];
  let at = 0;
  if (c % 2) {
    out.push([0, 2]);
    at = 2;
  }
  while (at < n) {
    let len = Math.min(4, n - at);
    if (n - at - len === 1) len = 3;
    out.push([at, len]);
    at += len;
  }
  return out;
}

/** Position and normal only, unindexed, so any two parts merge. */
function strip(geometry: THREE.BufferGeometry) {
  for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
  return geometry;
}

/**
 * The far sets' material: unlit, its colour ramped from a shade to a lit tone by each vertex's baked light, in the
 * set's body or accent colours, then fogged into the wall.
 */
export function setMaterial() {
  const uniforms = {
    uShade: { value: new THREE.Color() },
    uLit: { value: new THREE.Color() },
    uAccentShade: { value: new THREE.Color() },
    uAccentLit: { value: new THREE.Color() },
    uTint: { value: new THREE.Color() }
  };
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    // Bricks differ a little from one to the next, as a real pile of them does: a step lighter or darker, and the
    // lighter ones a touch toward the set's second tone.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uShade; uniform vec3 uLit; uniform vec3 uAccentShade; uniform vec3 uAccentLit; uniform vec3 uTint;')
      .replace(
        '#include <color_fragment>',
        `vec3 brick = mix( mix( uShade, uLit, vColor.r ), mix( uAccentShade, uAccentLit, vColor.r ), vColor.g );
        diffuseColor.rgb = mix( brick, brick * uTint, 0.6 * vColor.b ) * ( 0.84 + 0.32 * vColor.b );`
      );
  };
  material.customProgramCacheKey = () => 'bf-stage-set';
  return { material, uniforms };
}
