import * as THREE from 'three';
import { BrickBuilder, type PlaceOptions } from '../engine/bricks';
import { buildGround, type GroundTile } from '../engine/ground';
import type { Kit } from '../engine/kit';
import type { Finish } from '../engine/materials';
import type { Atmosphere } from '../engine/renderer';
import { Anim } from './anim';
import { detailLod } from './lod';
import { buildNav } from './nav';
import { aimSpawns } from './spawn-aim';
import type { Collider, MapDefinition, MapId, MapLayout, MapVisual, SpawnPoint } from './types';
import { Frame, Rng, type PlanCollider, type Vec3 } from './util';

/**
 * One kind of map element. Colliders and visuals come from the same params,
 * so what players bump into is what they see.
 */
export interface Element<P> {
  colliders?(p: P): PlanCollider[];
  draw(d: Drawer, p: P): void;
  /** Extra bot waypoints (stairs, doorways) as standing positions. */
  nav?(p: P): Vec3[];
}

interface Placed {
  el: Element<unknown>;
  p: unknown;
}

/** Plain-data description of a map: what goes where, before any geometry exists. */
export class Plan {
  readonly items: Placed[] = [];
  readonly spawns: SpawnPoint[] = [];
  readonly navSeeds: Vec3[] = [];

  add<P>(el: Element<P>, p: P) {
    this.items.push({ el: el as Element<unknown>, p });
    return this;
  }

  spawn(x: number, y: number, z: number, yaw: number, team?: 0 | 1) {
    this.spawns.push(team === undefined ? { position: [x, y, z], yaw } : { position: [x, y, z], yaw, team });
  }
}

export interface PutOptions {
  color: string;
  finish?: Finish;
  /** Extra yaw in radians on top of the frame's. */
  yaw?: number;
  tilt?: THREE.Euler;
  scale?: THREE.Vector3 | [number, number, number];
}

/** Everything element draw functions need for one build. */
export class Drawer {
  readonly b: BrickBuilder;
  /** Small parts and brick reliefs: drawn and shadowed, but never cast shadows. */
  private readonly minor: BrickBuilder;
  readonly ground: GroundTile[] = [];
  readonly anim: Anim;
  readonly rng: Rng;
  readonly detail: 0 | 1 | 2;
  private next = 0;

  /** Triangles per geometry family, for budget checks in the lab. */
  readonly stats = new Map<string, { parts: number; tris: number }>();

  constructor(readonly kit: Kit, seed: number) {
    this.b = new BrickBuilder(kit.profile, kit.materials);
    this.minor = new BrickBuilder(kit.profile, kit.materials);
    const custom = this.b.custom.bind(this.b);
    const size = new THREE.Vector3();
    this.b.custom = (key, geometry, x, y, z, options) => {
      const g = geometry();
      if (!g.boundingBox) g.computeBoundingBox();
      g.boundingBox!.getSize(size);
      if (options.scale) size.multiply(options.scale);
      const small = Math.min(size.x, size.y, size.z) < 0.15 || Math.max(size.x, size.y, size.z) < 0.9;
      const family = key.split(/[:#]/)[0]! + (family0(key) === 'face' || small ? '' : '*');
      const entry = this.stats.get(family) ?? { parts: 0, tris: 0 };
      entry.parts++;
      entry.tris += g.getAttribute('position').count / 3;
      this.stats.set(family, entry);
      if (family0(key) === 'face' || small) this.minor.custom(key, geometry, x, y, z, options);
      else custom(key, geometry, x, y, z, options);
    };
    this.anim = new Anim(kit);
    this.rng = new Rng(seed);
    this.detail = kit.profile.detail;
  }

  get profile() {
    return this.kit.profile;
  }

  /** Bake every collected part into batched meshes (major ones cast shadows). */
  bake() {
    const group = this.b.build();
    const minor = this.minor.build();
    const range = this.detail === 2 ? 46 : 34;
    for (const child of [...minor.children]) {
      child.castShadow = false;
      if (this.detail > 0) detailLod(child as THREE.BatchedMesh, range);
      group.add(child);
    }
    return group;
  }

  uid(prefix: string) {
    return `${prefix}#${this.next++}`;
  }

  /** Place cached geometry with its origin at the frame's local point. */
  put(f: Frame, key: string, g: () => THREE.BufferGeometry, lx: number, ly: number, lz: number, o: PutOptions) {
    const [x, y, z] = f.p(lx, ly, lz);
    const options: PlaceOptions = { color: o.color, finish: o.finish, yaw: f.yaw + (o.yaw ?? 0), tilt: o.tilt };
    if (o.scale) options.scale = Array.isArray(o.scale) ? new THREE.Vector3(...o.scale) : o.scale;
    this.b.custom(key, g, x, y, z, options);
  }
}

const family0 = (key: string) => key.split(/[:#]/)[0]!;

export let lastBuildStats: Record<string, { parts: number; tris: number }> = {};
export let lastElementStats: Record<string, number> = {};

export interface MapSpec {
  id: MapId;
  name: string;
  atmosphere: Atmosphere;
  bounds: { min: Vec3; max: Vec3 };
  killY: number;
  seed: number;
  plan(): Plan;
  /** Purely visual surroundings without colliders. */
  backdrop?(d: Drawer): void;
}

function stripCollider(c: PlanCollider): Collider {
  const out: Collider = { min: c.min, max: c.max, surface: c.surface };
  if (c.bulletsPass) out.bulletsPass = true;
  return out;
}

export function collectColliders(plan: Plan) {
  const out: PlanCollider[] = [];
  for (const item of plan.items) if (item.el.colliders) out.push(...item.el.colliders(item.p));
  return out;
}

export function defineMap(spec: MapSpec): MapDefinition {
  let memo: MapLayout | null = null;
  return {
    id: spec.id,
    name: spec.name,
    atmosphere: spec.atmosphere,
    layout() {
      if (memo) return memo;
      const plan = spec.plan();
      const colliders = collectColliders(plan);
      const seeds = [...plan.navSeeds];
      for (const item of plan.items) if (item.el.nav) seeds.push(...item.el.nav(item.p));
      for (const s of plan.spawns) seeds.push(s.position);
      const waypoints = buildNav(colliders, seeds, spec.bounds, spec.killY);
      const stripped = colliders.map(stripCollider);
      const { min, max } = spec.bounds;
      memo = {
        id: spec.id,
        bounds: spec.bounds,
        colliders: stripped,
        spawns: aimSpawns(plan.spawns, stripped, [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2]),
        waypoints,
        killY: spec.killY
      };
      return memo;
    },
    build(kit: Kit): MapVisual {
      const plan = spec.plan();
      const d = new Drawer(kit, spec.seed);
      const byElement = new Map<string, number>();
      for (const item of plan.items) {
        const before = [...d.stats.values()].reduce((a, e) => a + e.tris, 0);
        item.el.draw(d, item.p);
        const after = [...d.stats.values()].reduce((a, e) => a + e.tris, 0);
        const sig = typeof item.p === 'object' && item.p ? Object.keys(item.p).slice(0, 4).join(',') : 'fn';
        byElement.set(sig, (byElement.get(sig) ?? 0) + after - before);
      }
      lastElementStats = Object.fromEntries([...byElement].sort((a, b) => b[1] - a[1]).slice(0, 25));
      spec.backdrop?.(d);
      lastBuildStats = Object.fromEntries([...d.stats].sort((a, b) => b[1].tris - a[1].tris));
      const root = new THREE.Group();
      root.name = `map:${spec.id}`;
      const ground = buildGround(d.ground, kit.profile);
      root.add(ground);
      const scenery = d.bake();
      for (const child of scenery.children) {
        const mesh = child as THREE.BatchedMesh;
        if (mesh.material !== kit.materials.batch.glass) mesh.sortObjects = false;
      }
      root.add(scenery);
      const anim = d.anim.build();
      root.add(anim.root);
      return {
        root,
        update: anim.update,
        dispose() {
          ground.geometry.dispose();
          (ground.material as THREE.Material).dispose();
          for (const child of scenery.children) (child as THREE.BatchedMesh).dispose();
          anim.dispose();
        }
      };
    }
  };
}
