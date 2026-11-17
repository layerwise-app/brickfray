import * as THREE from 'three';
import { partGeometry, partKey, PITCH, PLATE, type PartSpec } from './geometry';
import type { Finish, Materials } from './materials';
import type { QualityProfile } from './quality';

interface Placement {
  key: string;
  geometry: () => THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  color: THREE.Color;
  finish: Finish;
}

export interface PlaceOptions {
  color: THREE.ColorRepresentation;
  finish?: Finish;
  /** Quarter turns around Y. */
  turns?: number;
  /** Free rotation in radians around Y; overrides turns. */
  yaw?: number;
  /** Extra rotation applied before the yaw, e.g. to lay a part on its side. */
  tilt?: THREE.Euler;
  scale?: THREE.Vector3;
}

const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Collects every scenery part of a map, then bakes them into one BatchedMesh
 * per finish: a whole city draws in a handful of calls with per-part culling.
 */
export class BrickBuilder {
  private placements: Placement[] = [];

  constructor(
    readonly profile: QualityProfile,
    readonly materials: Materials
  ) {}

  get count() {
    return this.placements.length;
  }

  /** Place a part with its bottom center at (x, y, z) in meters. */
  part(spec: PartSpec, x: number, y: number, z: number, options: PlaceOptions) {
    const key = partKey(spec);
    this.push(key, () => partGeometry(spec, this.profile), x, y, z, options);
  }

  /**
   * Place a part on the stud grid. (gx, gz) is the cell of its minimum corner,
   * `layer` counts plates from the ground. Quarter turns swap its footprint.
   */
  grid(spec: PartSpec, gx: number, layer: number, gz: number, options: PlaceOptions) {
    const turns = (((options.turns ?? 0) % 4) + 4) % 4;
    const fw = turns % 2 === 0 ? spec.w : spec.d;
    const fd = turns % 2 === 0 ? spec.d : spec.w;
    this.part(spec, (gx + fw / 2) * PITCH, layer * PLATE, (gz + fd / 2) * PITCH, options);
  }

  /** Any cached geometry (bottom-origin convention) placed like a part. */
  custom(key: string, geometry: () => THREE.BufferGeometry, x: number, y: number, z: number, options: PlaceOptions) {
    this.push(`custom:${key}`, geometry, x, y, z, options);
  }

  private push(key: string, geometry: () => THREE.BufferGeometry, x: number, y: number, z: number, options: PlaceOptions) {
    const yaw = options.yaw ?? ((options.turns ?? 0) * Math.PI) / 2;
    tmpQ.setFromAxisAngle(UP, yaw);
    if (options.tilt) tmpQ.multiply(tmpQ2.setFromEuler(options.tilt));
    tmpS.copy(options.scale ?? new THREE.Vector3(1, 1, 1));
    tmpP.set(x, y, z);
    const matrix = new THREE.Matrix4().compose(tmpP, tmpQ, tmpS);
    this.placements.push({ key, geometry, matrix, color: new THREE.Color(options.color), finish: options.finish ?? 'plastic' });
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'scenery';
    const byFinish = new Map<Finish, Placement[]>();
    for (const p of this.placements) {
      const list = byFinish.get(p.finish) ?? [];
      list.push(p);
      byFinish.set(p.finish, list);
    }
    for (const [finish, list] of byFinish) {
      const geometries = new Map<string, THREE.BufferGeometry>();
      for (const p of list) if (!geometries.has(p.key)) geometries.set(p.key, p.geometry());
      let vertices = 0;
      for (const g of geometries.values()) vertices += g.getAttribute('position').count;
      const mesh = new THREE.BatchedMesh(list.length, vertices, vertices * 2, this.materials.batch[finish]);
      mesh.name = `scenery:${finish}`;
      const ids = new Map<string, number>();
      for (const [key, g] of geometries) ids.set(key, mesh.addGeometry(g));
      for (const p of list) {
        const id = mesh.addInstance(ids.get(p.key)!);
        mesh.setMatrixAt(id, p.matrix);
        mesh.setColorAt(id, p.color);
      }
      const shadows = this.profile.shadows && finish !== 'glass' && finish !== 'glow';
      mesh.castShadow = shadows;
      mesh.receiveShadow = this.profile.shadows && finish !== 'glow';
      if (finish === 'glass') mesh.renderOrder = 2;
      group.add(mesh);
    }
    this.placements = [];
    return group;
  }
}
