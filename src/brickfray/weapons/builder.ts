import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kit } from '../engine/kit';
import { paint, surfaceMaterial, type Surface } from './surface';
import { useLod, type Lod } from './shapes';

export type View = 'first' | 'third';

export function lodFor(kit: Kit, view: View): Lod {
  const level = kit.profile.level;
  if (view === 'third') {
    return level === 'high'
      ? { detail: 0, bevel: 0, seg: 8, segSmall: 6, curve: 2, glass: false, minor: true, third: true }
      : level === 'medium'
        ? { detail: 0, bevel: 0, seg: 7, segSmall: 5, curve: 1, glass: false, minor: true, third: true }
        : { detail: 0, bevel: 0, seg: 5, segSmall: 4, curve: 1, glass: false, minor: false, third: true };
  }
  return level === 'high'
    ? { detail: 2, bevel: 0.0014, seg: 22, segSmall: 10, curve: 5, glass: true, minor: true, third: false }
    : level === 'medium'
      ? { detail: 1, bevel: 0.0011, seg: 14, segSmall: 8, curve: 3, glass: true, minor: true, third: false }
      : { detail: 0, bevel: 0, seg: 8, segSmall: 6, curve: 2, glass: true, minor: true, third: false };
}

/** Euler-angle transform shorthand: position, rotation (radians, XYZ) and scale. */
export function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Places a Z-aligned shape at (x, y, z) with its axis pointing along (dx, dy, dz). */
export function aim(x: number, y: number, z: number, dx: number, dy: number, dz: number): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, new THREE.Vector3(dx, dy, dz).normalize());
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
}

interface Piece {
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
}

interface PartDraft {
  pivot: THREE.Vector3;
  opaque: Piece[];
  glass: Piece[];
  glassColor: string;
}

interface NodeDraft {
  part: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

/** A baked model: shared geometry per part, instantiated cheaply many times. */
export interface Template {
  parts: { name: string; pivot: THREE.Vector3; opaque: THREE.BufferGeometry | null; glass: THREE.BufferGeometry | null; glassColor: string }[];
  nodes: { name: string; part: string; position: THREE.Vector3; quaternion: THREE.Quaternion }[];
}

/**
 * Collects parts in model space (meters, barrel along -Z) and bakes them into
 * one opaque geometry (per-vertex color and finish) plus one glass geometry per
 * moving part. Pieces are authored in model coordinates; a part's pivot is
 * subtracted when baking so the part animates around it.
 */
export class ModelBuilder {
  private parts = new Map<string, PartDraft>();
  private nodes = new Map<string, NodeDraft>();
  private current: PartDraft;
  private currentName = 'body';

  constructor(readonly lod: Lod) {
    this.current = this.ensure('body', new THREE.Vector3());
    useLod(lod);
  }

  get detail() {
    return this.lod.detail;
  }

  get minor() {
    return this.lod.minor;
  }

  /** Switch the target part; later pieces and nodes belong to it. */
  part(name: string, pivot?: THREE.Vector3Like) {
    if (this.lod.third && name !== 'magazine' && name !== 'pin') name = 'body';
    this.current = this.ensure(name, pivot ? new THREE.Vector3().copy(pivot) : new THREE.Vector3());
    this.currentName = name;
    return this;
  }

  add(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, surface: Surface, matrix: THREE.Matrix4 = new THREE.Matrix4()) {
    const g = geometry.clone();
    paint(g, color, surface);
    this.current.opaque.push({ geometry: g, matrix });
    return this;
  }

  /** Lens glass; third-person builds turn it into dark glossy plastic. */
  glass(geometry: THREE.BufferGeometry, color: string, matrix: THREE.Matrix4 = new THREE.Matrix4()) {
    if (!this.lod.minor) return this;
    if (!this.lod.glass) return this.add(geometry, new THREE.Color(color).multiplyScalar(0.35), 'chrome', matrix);
    this.current.glass.push({ geometry: geometry.clone(), matrix });
    this.current.glassColor = color;
    return this;
  }

  /** A named attachment point, in model coordinates, parented to the current part. */
  node(name: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    this.nodes.set(name, { part: this.currentName, position: new THREE.Vector3(x, y, z), rotation: new THREE.Euler(rx, ry, rz) });
    return this;
  }

  bake(): Template {
    useLod(null);
    const parts: Template['parts'] = [];
    for (const [name, draft] of this.parts) {
      const shift = new THREE.Matrix4().makeTranslation(-draft.pivot.x, -draft.pivot.y, -draft.pivot.z);
      const merge = (pieces: Piece[]) => {
        if (!pieces.length) return null;
        const geos = pieces.map(({ geometry, matrix }) => {
          geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(shift, matrix));
          return geometry;
        });
        const merged = mergeGeometries(geos)!;
        for (const g of geos) g.dispose();
        merged.computeBoundingSphere();
        merged.computeBoundingBox();
        return merged;
      };
      parts.push({ name, pivot: draft.pivot.clone(), opaque: merge(draft.opaque), glass: merge(draft.glass), glassColor: draft.glassColor });
    }
    const nodes: Template['nodes'] = [];
    for (const [name, n] of this.nodes) {
      const pivot = this.parts.get(n.part)!.pivot;
      nodes.push({ name, part: n.part, position: n.position.clone().sub(pivot), quaternion: new THREE.Quaternion().setFromEuler(n.rotation) });
    }
    return { parts, nodes };
  }

  private ensure(name: string, pivot: THREE.Vector3) {
    let draft = this.parts.get(name);
    if (!draft) {
      draft = { pivot, opaque: [], glass: [], glassColor: '#ffffff' };
      this.parts.set(name, draft);
    }
    return draft;
  }
}

export interface Instance {
  root: THREE.Group;
  parts: Map<string, THREE.Group>;
  nodes: Map<string, THREE.Object3D>;
}

/** New scene objects around a template's shared geometry. */
export function instantiate(template: Template, kit: Kit): Instance {
  const root = new THREE.Group();
  const parts = new Map<string, THREE.Group>();
  const material = surfaceMaterial(kit.materials);
  for (const part of template.parts) {
    let holder = root;
    if (part.name !== 'body') {
      holder = new THREE.Group();
      holder.name = part.name;
      holder.position.copy(part.pivot);
      root.add(holder);
    }
    if (part.opaque) holder.add(new THREE.Mesh(part.opaque, material));
    if (part.glass) {
      const lens = new THREE.Mesh(part.glass, kit.materials.get(part.glassColor, 'glass'));
      lens.renderOrder = 2;
      holder.add(lens);
    }
    parts.set(part.name, holder);
  }
  const nodes = new Map<string, THREE.Object3D>();
  for (const n of template.nodes) {
    const o = new THREE.Object3D();
    o.name = n.name;
    o.position.copy(n.position);
    o.quaternion.copy(n.quaternion);
    parts.get(n.part)!.add(o);
    nodes.set(n.name, o);
  }
  return { root, parts, nodes };
}
