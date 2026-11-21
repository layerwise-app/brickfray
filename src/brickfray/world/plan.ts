import * as THREE from 'three';
import { BrickBuilder, type PlaceOptions } from '../engine/bricks';
import { buildGround, type GroundTile } from '../engine/ground';
import type { Kit } from '../engine/kit';
import type { Finish } from '../engine/materials';
import type { Atmosphere } from '../engine/renderer';
import { Anim } from './anim';
import { contactShadows } from './contact-shadows';
import { detailLod, type LodMode } from './lod';
import { buildNav } from './nav';
import { Siding } from './siding';
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
  /** Small parts that dissolve with distance (medium and high). */
  private readonly fine: BrickBuilder;
  /** Cheap stand-ins drawn only where the fine parts have dissolved. */
  private readonly far: BrickBuilder;
  private scope: 'lasting' | 'distant' | null = null;
  readonly ground: GroundTile[] = [];
  readonly siding = new Siding();
  readonly anim: Anim;
  readonly rng: Rng;
  readonly detail: 0 | 1 | 2;
  private next = 0;

  /** Triangles per geometry family, for budget checks in the lab. */
  readonly stats = new Map<string, { parts: number; tris: number }>();

  constructor(readonly kit: Kit, seed: number) {
    this.b = new BrickBuilder(kit.profile, kit.materials);
    this.minor = new BrickBuilder(kit.profile, kit.materials);
    this.fine = new BrickBuilder(kit.profile, kit.materials);
    this.far = new BrickBuilder(kit.profile, kit.materials);
    const custom = this.b.custom.bind(this.b);
    const size = new THREE.Vector3();
    this.b.custom = (key, geometry, x, y, z, options) => {
      const g = geometry();
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingSphere) g.computeBoundingSphere();
      g.boundingBox!.getSize(size);
      const stretch = options.scale ? Math.max(options.scale.x, options.scale.y, options.scale.z) : 1;
      if (options.scale) size.multiply(options.scale);
      const small = Math.min(size.x, size.y, size.z) < 0.15 || Math.max(size.x, size.y, size.z) < 0.9;
      const family = key.split(/[:#]/)[0]! + (family0(key) === 'face' || small ? '' : '*');
      const entry = this.stats.get(family) ?? { parts: 0, tris: 0 };
      entry.parts++;
      entry.tris += g.getAttribute('position').count / 3;
      this.stats.set(family, entry);
      if (this.scope === 'distant') this.far.custom(key, geometry, x, y, z, options);
      else if (family0(key) === 'face' || small || this.scope === 'lasting') {
        const fades = this.scope !== 'lasting' && this.detail > 0 && g.boundingSphere!.radius * stretch < FINE_RADIUS;
        (fades ? this.fine : this.minor).custom(key, geometry, x, y, z, options);
      } else custom(key, geometry, x, y, z, options);
    };
    this.anim = new Anim(kit);
    this.rng = new Rng(seed);
    this.detail = kit.profile.detail;
  }

  get profile() {
    return this.kit.profile;
  }

  /** Parts drawn inside `fn` stay at every distance (small parts that carry a building's outline from afar). */
  lasting(fn: () => void) {
    this.scope = 'lasting';
    fn();
    this.scope = null;
  }

  /** Parts drawn inside `fn` stand in, beyond the fade range, for detail that dissolves there; nothing on low. */
  distant(fn: () => void) {
    if (this.detail === 0) return;
    this.scope = 'distant';
    fn();
    this.scope = null;
  }

  /** Bake every collected part into batched meshes (major ones cast shadows). */
  bake() {
    const group = this.b.build();
    const range = this.detail === 2 ? 46 : 34;
    const add = (built: THREE.Group, mode?: LodMode) => {
      for (const child of [...built.children]) {
        child.castShadow = false;
        group.add(child);
        if (mode) group.add(...detailLod(child as THREE.BatchedMesh, range, mode));
      }
    };
    add(this.minor.build());
    add(this.fine.build(), 'near');
    add(this.far.build(), 'far');
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
/** Bounding radius under which a small part dissolves with distance. */
const FINE_RADIUS = 1.6;

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
      d.anim.sky = { zenith: spec.atmosphere.zenith, horizon: spec.atmosphere.horizon };
      const byElement = new Map<string, number>();
      for (const item of plan.items) {
        const before = [...d.stats.values()].reduce((a, e) => a + e.tris, 0);
        item.el.draw(d, item.p);
        const after = [...d.stats.values()].reduce((a, e) => a + e.tris, 0);
        const sig = typeof item.p === 'object' && item.p ? Object.keys(item.p).slice(0, 4).join(',') : 'fn';
        byElement.set(sig, (byElement.get(sig) ?? 0) + after - before);
      }
      lastElementStats = Object.fromEntries([...byElement].sort((a, b) => b[1] - a[1]).slice(0, 25));
      d.lasting(() => spec.backdrop?.(d));
      lastBuildStats = Object.fromEntries([...d.stats].sort((a, b) => b[1].tris - a[1].tris));
      const root = new THREE.Group();
      root.name = `map:${spec.id}`;
      const ground = buildGround(d.ground, kit.profile);
      root.add(ground);
      const scenery = d.bake();
      for (const child of scenery.children) {
        const mesh = child as THREE.BatchedMesh;
        if (mesh.name !== 'scenery:glass') mesh.sortObjects = false;
      }
      root.add(scenery);
      const siding = d.siding.build(kit);
      if (siding) root.add(siding);
      const anim = d.anim.build();
      root.add(anim.root);
      const contact = kit.profile.shadows ? null : contactShadows(collectColliders(plan), spec.atmosphere.sunDirection);
      if (contact) root.add(contact);
      return {
        root,
        update: anim.update,
        dispose() {
          ground.geometry.dispose();
          (ground.material as THREE.Material).dispose();
          siding?.geometry.dispose();
          (siding?.material as THREE.Material | undefined)?.dispose();
          for (const child of scenery.children) {
            const mesh = child as THREE.BatchedMesh;
            mesh.dispose();
            if ((mesh.material as THREE.Material).userData.lodClone) (mesh.material as THREE.Material).dispose();
          }
          anim.dispose();
          contact?.geometry.dispose();
          (contact?.material as THREE.Material | undefined)?.dispose();
        }
      };
    }
  };
}
