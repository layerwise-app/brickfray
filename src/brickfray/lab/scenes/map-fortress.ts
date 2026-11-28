import * as THREE from 'three';
import { CollisionWorld } from '../../sim/collision';
import { mapLab } from '../../world/lab-map';
import { FORTRESS, FORTRESS_VIEWS } from '../../world/map-fortress';
import { ColliderIndex } from '../../world/nav';
import type { LabContext } from '../types';

export default function setup(ctx: LabContext) {
  const lab = mapLab(ctx, FORTRESS, FORTRESS_VIEWS);
  return { ...lab, api: { ...lab.api, ghost: (step?: unknown, from?: unknown, to?: unknown) => ghostScan(ctx, Number(step ?? 3.2), Number(from ?? -Infinity), Number(to ?? Infinity)) } };
}

/**
 * Ghost scan: from standing spots on a grid, level rays at eye and chest height in 8 directions, once through the
 * colliders (as a bullet sees them) and once through the drawn scene. `air` = the collider stops the ray more than
 * 0.3 m before anything drawn (an invisible wall); `through` = something drawn stops it more than 0.5 m before any
 * collider (a shot passes what looks solid). `from`..`to` limits the scan to a band of x (one call stays short).
 */
function ghostScan(ctx: LabContext, step: number, from: number, to: number) {
  const layout = FORTRESS.layout();
  const world = new CollisionWorld(layout.colliders);
  const index = new ColliderIndex(layout.colliders);
  const meshes: THREE.Object3D[] = [];
  ctx.scene.traverse((o) => {
    // Map parts answer rays through their undrawn batched proxy (engine/bricks.ts); the drawn chunks do not.
    if ((o as THREE.BatchedMesh).isBatchedMesh || ((o as THREE.Mesh).isMesh && o.visible)) meshes.push(o);
  });
  const ray = new THREE.Raycaster();
  ray.far = 30;
  const { min, max } = layout.bounds;
  const air: string[] = [];
  const through: string[] = [];
  let rays = 0;
  const dirs = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)] as const);
  for (let x = min[0] + 1.137; x < max[0] - 1; x += step) {
    if (x < from || x >= to) continue;
    for (let z = min[2] + 1.091; z < max[2] - 1; z += step) {
      const y = index.support(x, z, 6);
      if (!Number.isFinite(y) || y < layout.killY || !index.clear(x, z, y)) continue;
      for (const h of [1.62, 1.2]) {
        for (const [dx, dz] of dirs) {
          rays++;
          const c = world.raycast(x, y + h, z, dx, 0, dz, 30, true);
          ray.set(new THREE.Vector3(x, y + h, z), new THREE.Vector3(dx, 0, dz));
          const hit = ray.intersectObjects(meshes, false).find((i) => i.distance > 0.05);
          const tc = c ? c.t : Infinity;
          const tt = hit ? hit.distance : Infinity;
          const at = `(${x.toFixed(1)},${(y + h).toFixed(2)},${z.toFixed(1)}) dir ${dx.toFixed(2)},${dz.toFixed(2)}: collider ${tc.toFixed(2)} drawn ${tt.toFixed(2)}`;
          if (tc + 0.3 < tt) air.push(at);
          else if (tt + 0.5 < tc) through.push(`${at} ${hit?.object.name ?? ''}`);
        }
      }
    }
  }
  return { rays, air: air.length, through: through.length, airList: air.slice(0, 200), throughList: through.slice(0, 200) };
}
