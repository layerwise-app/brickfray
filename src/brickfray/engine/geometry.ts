import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { QualityProfile } from './quality';

/** Stud pitch, brick height and plate height in meters. Everything snaps to these. */
export const PITCH = 0.4;
export const BRICK = 0.48;
export const PLATE = 0.16;
export const STUD_RADIUS = 0.12;
export const STUD_HEIGHT = 0.085;
/** Gap between neighbouring parts so seams catch the light. */
const GAP = 0.0025;

const cache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, make: () => THREE.BufferGeometry) {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = make();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    cache.set(key, geometry);
  }
  return geometry;
}

export function clearGeometryCache() {
  for (const geometry of cache.values()) geometry.dispose();
  cache.clear();
}

/** Strip to position + normal, non-indexed, so any two parts can be merged or batched. */
export function normalizeGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  }
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  return out;
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const tmpC = new THREE.Vector3();

/** Flat-shaded convex polyhedron from faces; faces are wound outward automatically. */
function polyhedron(faces: THREE.Vector3[][]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const face of faces) {
    tmpC.set(0, 0, 0);
    for (const p of face) tmpC.add(p);
    tmpC.divideScalar(face.length);
    tmpA.subVectors(face[1]!, face[0]!);
    tmpB.subVectors(face[2]!, face[0]!);
    tmpN.crossVectors(tmpA, tmpB).normalize();
    const flip = tmpN.dot(tmpC) < 0;
    if (flip) tmpN.negate();
    for (let i = 1; i < face.length - 1; i++) {
      const tri = flip ? [face[0]!, face[i + 1]!, face[i]!] : [face[0]!, face[i]!, face[i + 1]!];
      for (const p of tri) {
        positions.push(p.x, p.y, p.z);
        normals.push(tmpN.x, tmpN.y, tmpN.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

/** Box centered on the origin whose twelve edges are cut at 45 degrees by `bevel`. */
export function chamferBox(w: number, h: number, d: number, bevel: number): THREE.BufferGeometry {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const b = Math.min(bevel, hw * 0.45, hh * 0.45, hd * 0.45);
  if (b <= 0) return normalizeGeometry(new THREE.BoxGeometry(w, h, d));
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const faces: THREE.Vector3[][] = [];
  for (const s of [-1, 1]) {
    faces.push([V(s * hw, -(hh - b), -(hd - b)), V(s * hw, hh - b, -(hd - b)), V(s * hw, hh - b, hd - b), V(s * hw, -(hh - b), hd - b)]);
    faces.push([V(-(hw - b), s * hh, -(hd - b)), V(hw - b, s * hh, -(hd - b)), V(hw - b, s * hh, hd - b), V(-(hw - b), s * hh, hd - b)]);
    faces.push([V(-(hw - b), -(hh - b), s * hd), V(hw - b, -(hh - b), s * hd), V(hw - b, hh - b, s * hd), V(-(hw - b), hh - b, s * hd)]);
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      faces.push([V(sx * hw, sy * (hh - b), -(hd - b)), V(sx * (hw - b), sy * hh, -(hd - b)), V(sx * (hw - b), sy * hh, hd - b), V(sx * hw, sy * (hh - b), hd - b)]);
    }
    for (const sz of [-1, 1]) {
      faces.push([V(sx * hw, -(hh - b), sz * (hd - b)), V(sx * hw, hh - b, sz * (hd - b)), V(sx * (hw - b), hh - b, sz * hd), V(sx * (hw - b), -(hh - b), sz * hd)]);
    }
  }
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) {
      faces.push([V(-(hw - b), sy * (hh - b), sz * hd), V(hw - b, sy * (hh - b), sz * hd), V(hw - b, sy * hh, sz * (hd - b)), V(-(hw - b), sy * hh, sz * (hd - b))]);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    faces.push([V(sx * hw, sy * (hh - b), sz * (hd - b)), V(sx * (hw - b), sy * hh, sz * (hd - b)), V(sx * (hw - b), sy * (hh - b), sz * hd)]);
  }
  return polyhedron(faces);
}

/** A cylinder standing on the origin with a rounded top edge (smooth normals). */
export function roundedCylinder(radius: number, height: number, segments: number, edge: number, bottomEdge = 0): THREE.BufferGeometry {
  const e = Math.min(edge, radius * 0.4, height * 0.4);
  const be = Math.min(bottomEdge, radius * 0.4, height * 0.4);
  const points: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  if (be > 0) {
    points.push(new THREE.Vector2(radius - be, 0));
    for (let i = 1; i <= 2; i++) {
      const a = (i / 2) * (Math.PI / 2);
      points.push(new THREE.Vector2(radius - be + Math.sin(a) * be, be - Math.cos(a) * be));
    }
  } else points.push(new THREE.Vector2(radius, 0));
  if (e > 0) {
    points.push(new THREE.Vector2(radius, height - e));
    for (let i = 1; i <= 3; i++) {
      const a = (i / 3) * (Math.PI / 2);
      points.push(new THREE.Vector2(radius - e + Math.cos(a) * e, height - e + Math.sin(a) * e));
    }
  } else {
    points.push(new THREE.Vector2(radius, height));
    points.push(new THREE.Vector2(radius * 0.999, height));
  }
  points.push(new THREE.Vector2(0, height));
  return normalizeGeometry(new THREE.LatheGeometry(points, Math.max(5, segments)));
}

function studGeometry(profile: QualityProfile) {
  return cached(`stud:${profile.studSegments}`, () =>
    roundedCylinder(STUD_RADIUS, STUD_HEIGHT, profile.studSegments, profile.detail >= 2 ? 0.014 : profile.detail >= 1 ? 0.01 : 0)
  );
}

export interface PartSpec {
  /** Studs along x. */
  w: number;
  /** Studs along z. */
  d: number;
  /** Height in plates: 3 is a brick, 1 a plate. */
  h: number;
  studs?: boolean;
  shape?: 'box' | 'round' | 'slope' | 'inverted-slope' | 'cone';
}

export function partKey(spec: PartSpec) {
  return `${spec.shape ?? 'box'}:${spec.w}x${spec.d}x${spec.h}:${spec.studs === false ? 0 : 1}`;
}

/**
 * A toy part sitting on the origin (bottom center) with optional studs on top.
 * Low quality returns plain boxes without studs, so a whole city stays cheap.
 */
export function partGeometry(spec: PartSpec, profile: QualityProfile): THREE.BufferGeometry {
  const key = `${partKey(spec)}:${profile.level}`;
  return cached(key, () => {
    const width = spec.w * PITCH - GAP * 2;
    const depth = spec.d * PITCH - GAP * 2;
    const height = spec.h * PLATE - GAP;
    const shape = spec.shape ?? 'box';
    const pieces: THREE.BufferGeometry[] = [];
    let topY = height;
    if (shape === 'round') {
      const radius = Math.min(width, depth) / 2;
      const segments = profile.level === 'low' ? 10 : profile.level === 'medium' ? 20 : 32;
      pieces.push(roundedCylinder(radius, height, segments, profile.bevel * 0.8, profile.bevel * 0.5));
    } else if (shape === 'cone') {
      const radius = Math.min(width, depth) / 2;
      const segments = profile.level === 'low' ? 10 : profile.level === 'medium' ? 20 : 32;
      const cone = normalizeGeometry(new THREE.CylinderGeometry(radius * 0.45, radius, height, segments));
      cone.translate(0, height / 2, 0);
      pieces.push(cone);
      topY = height;
    } else if (shape === 'slope' || shape === 'inverted-slope') {
      pieces.push(slopeGeometry(width, height, depth, shape === 'inverted-slope'));
      topY = height;
    } else {
      const box = chamferBox(width, height, depth, profile.bevel);
      box.translate(0, height / 2, 0);
      pieces.push(box);
    }
    const wantStuds = spec.studs !== false && profile.studSegments > 0 && shape !== 'cone';
    if (wantStuds) {
      const stud = studGeometry(profile);
      // A slope keeps studs only on its flat back row.
      const rows = shape === 'slope' ? 1 : spec.d;
      for (let x = 0; x < spec.w; x++) {
        for (let z = 0; z < rows; z++) {
          const s = stud.clone();
          const sz = shape === 'slope' ? -depth / 2 + PITCH / 2 : (z - (spec.d - 1) / 2) * PITCH;
          s.translate((x - (spec.w - 1) / 2) * PITCH, topY, sz);
          pieces.push(s);
        }
      }
    }
    return pieces.length === 1 ? pieces[0]! : mergeGeometries(pieces)!;
  });
}

/** Roof slope: full height at -z, sloping down to a short lip at +z. */
function slopeGeometry(w: number, h: number, d: number, inverted: boolean): THREE.BufferGeometry {
  const hw = w / 2;
  const hd = d / 2;
  const lip = Math.min(PLATE * 0.6, h * 0.3);
  const back = Math.min(PITCH * 0.95, d * 0.5);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const yTop = inverted ? 0 : h;
  // profile in (z, y) going around the cross-section
  const profile = inverted
    ? [V(0, h, -hd), V(0, h, hd), V(0, h - lip, hd), V(0, 0, -hd + back), V(0, 0, -hd)]
    : [V(0, 0, -hd), V(0, 0, hd), V(0, lip, hd), V(0, yTop, -hd + back), V(0, h, -hd)];
  // polyhedron() decides winding from the origin, so build it centered and lift afterwards.
  const cy = h / 2;
  const left = profile.map((p) => V(-hw, p.y - cy, p.z));
  const right = profile.map((p) => V(hw, p.y - cy, p.z));
  const faces: THREE.Vector3[][] = [left, right];
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length;
    faces.push([left[i]!, left[j]!, right[j]!, right[i]!]);
  }
  const geometry = polyhedron(faces);
  geometry.translate(0, cy, 0);
  return geometry;
}

/** Merge geometries, each with its own transform, into one; used to bake props. */
export function mergeWithTransforms(items: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[]) {
  const parts = items.map(({ geometry, matrix }) => {
    const g = geometry.clone();
    g.applyMatrix4(matrix);
    return g;
  });
  return mergeGeometries(parts)!;
}
