import * as THREE from 'three';
import type { Vec3 } from '../audio/bullet-sounds';
import type { Kit } from '../engine/kit';
import type { Effects } from '../fx/effects';
import { GrenadeFx } from '../fx/grenade-fx';
import type { Snapshot } from '../net/codec';
import type { CollisionWorld } from '../sim/collision';
import { INTERP_DELAY, MOVE } from '../sim/constants';
import { eyeHeight } from '../sim/movement';
import { createRiggedModel } from '../weapons/model';
import type { WeaponModel } from '../weapons/types';

/** A grenade the HUD can warn about, refreshed every frame. */
export interface LiveGrenade {
  id: number;
  /** Where it is drawn: 100 ms in the past, like every other player. */
  drawn: THREE.Vector3;
  /** Where the host has it now, which is where the blast will be measured from. */
  now: THREE.Vector3;
  /** Seconds until it bursts. */
  left: number;
  /** Seconds since it was first drawn. */
  age: number;
  /** Who threw it. */
  thrower: number;
  own: boolean;
}

/** In the world the bomb is drawn this much larger than in a hand: then it fills its 0.09 m collision ball. */
const WORLD_SCALE = 2.4;
/** Seconds over which a new grenade grows from hand size, so it doesn't appear big right in front of the thrower. */
const GROW = 0.2;
/** The fuse bulb on top of the cap, in model units. */
const BULB = new THREE.Vector3(0, 0.058, 0);
/** Ball radius in the simulation: the surface is this far from the centre at a bounce. */
const BALL = 0.09;
const SPIN = 14;
const SIGHT_RECHECK = 0.1;

interface Entry {
  model: WeaponModel;
  bounces: number;
  spin: number;
  settle: number;
  rest: THREE.Quaternion;
  landed: boolean;
  /** Whether the local eye saw the fuse bulb at the last check (render time `at`). */
  sight: { at: number; clear: boolean };
  live: LiveGrenade;
}

const flight = new THREE.Quaternion();
const euler = new THREE.Euler();
const bulb = new THREE.Vector3();

/**
 * Live grenades from snapshots, interpolated; each new bounce is reported with the grenade's speed. A grenade is gone
 * the moment the newest snapshot no longer has it (it burst), even though it is drawn 100 ms in the past.
 */
export class GrenadeView {
  readonly group = new THREE.Group();
  /** Grenades drawn this frame, for the HUD's warnings. */
  readonly live: LiveGrenade[] = [];
  /** The local player as of the newest snapshot. */
  self: { alive: boolean; x: number; y: number; z: number } | null = null;
  private models = new Map<number, Entry>();
  private readonly fx = new GrenadeFx();
  /** Hidden in the scene from the start, so the first grenade thrown in a match is not drawn for the first time mid-match. */
  private spare: WeaponModel | null = null;
  /** Never shown: a grenade flying, landing and lying still, drawn only by the match's warm-up frame. */
  private readonly primer = new GrenadeFx();
  private lastTime: number | null = null;
  private world: CollisionWorld | null | undefined;

  constructor(
    private readonly kit: Kit,
    /** The local player's id: their own grenades warn differently. */
    private readonly you: number,
    private readonly bounce: (at: Vec3, speed: number) => void
  ) {
    this.group.name = 'grenades';
    this.group.userData.view = this;
    this.group.add(this.fx.group);
    this.spare = this.build();
    this.spare.root.visible = false;
    this.group.add(this.spare.root);
    const at = new THREE.Vector3();
    for (let i = 0; i < 2; i++) {
      this.primer.begin(0.05);
      this.primer.grenade(0, at.set(0, 1 + i, 0), at, 2, true, true);
      this.primer.grenade(1, at.set(1, 0, 0), at, 1, false, false);
    }
    this.primer.land(0, at, new THREE.Vector3(0, 1, 0), 1);
    this.primer.end();
    this.primer.group.visible = false;
    this.group.add(this.primer.group);
  }

  update(snapshots: readonly Snapshot[], renderTime: number) {
    const dt = this.lastTime === null ? 0 : THREE.MathUtils.clamp(renderTime - this.lastTime, 0, 0.1);
    this.lastTime = renderTime;
    let a: Snapshot | undefined;
    let b: Snapshot | undefined;
    let ai = 0;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i]!.time <= renderTime) {
        a = snapshots[i];
        b = snapshots[i + 1];
        ai = i;
        break;
      }
    }
    a ??= snapshots[0];
    const latest = snapshots[snapshots.length - 1];
    const me = latest?.self;
    this.self = me ? { alive: me.alive, x: me.move.x, y: me.move.y, z: me.move.z } : null;
    const eye = me?.alive ? { x: me.move.x, y: me.move.y + eyeHeight(me.move), z: me.move.z } : null;
    // The match keeps its effects (which hold the collision world) in a scene group of this name, beside this one.
    this.world ??= (this.group.parent?.children.find((o) => o.name === 'effects')?.userData.effects as Effects | undefined)?.world;
    this.fx.begin(dt);
    this.live.length = 0;
    const seen = new Set<number>();
    if (a && latest) {
      const span = b ? Math.max(1e-4, b.time - a.time) : 1;
      const k = b ? THREE.MathUtils.clamp((renderTime - a.time) / span, 0, 1) : 0;
      for (const g of a.grenades) {
        const current = latest.grenades.find((x) => x.id === g.id);
        if (!current) continue;
        const n = b?.grenades.find((x) => x.id === g.id) ?? g;
        seen.add(g.id);
        const entry = this.models.get(g.id) ?? this.add(g.id, g.owner);
        const root = entry.model.root;
        root.position.set(g.x + (n.x - g.x) * k, g.y + (n.y - g.y) * k, g.z + (n.z - g.z) * k);
        const moving = Math.hypot(n.x - g.x, n.y - g.y, n.z - g.z) > 0.01;
        if (moving) entry.spin += SPIN * dt;
        entry.settle = moving ? 0 : Math.min(1, entry.settle + dt * 5);
        flight.setFromEuler(euler.set(entry.spin, entry.spin * 0.7, 0));
        root.quaternion.slerpQuaternions(flight, entry.rest, entry.settle * entry.settle * (3 - 2 * entry.settle));
        const live = entry.live;
        live.age += dt;
        root.scale.setScalar(1 + (WORLD_SCALE - 1) * THREE.MathUtils.smoothstep(live.age, 0, GROW));
        if (g.bounces > entry.bounces) {
          entry.bounces = g.bounces;
          this.bounce(root.position, Math.hypot(n.x - g.x, n.y - g.y, n.z - g.z) / span);
          const normal = impulse(snapshots, ai, g.id);
          if (normal) {
            this.fx.land(g.id, new THREE.Vector3(g.x, g.y, g.z).addScaledVector(normal, -BALL), normal, entry.landed ? 0.6 : 1);
            entry.landed = true;
          }
        }
        root.updateMatrix();
        live.drawn.copy(root.position);
        live.now.set(current.x, current.y, current.z);
        live.left = Math.max(0, current.fuse - (renderTime + INTERP_DELAY - latest.time));
        bulb.copy(BULB).applyMatrix4(root.matrix);
        if (Math.abs(renderTime - entry.sight.at) > SIGHT_RECHECK) {
          entry.sight.at = renderTime;
          entry.sight.clear = !!eye && !!this.world && this.world.clearLine(eye.x, eye.y, eye.z, bulb.x, bulb.y + 0.05, bulb.z);
        }
        this.fx.grenade(g.id, root.position, bulb, live.left, moving, entry.sight.clear);
        this.live.push(live);
      }
    }
    this.fx.end();
    for (const [id, entry] of this.models) {
      if (seen.has(id)) continue;
      this.models.delete(id);
      if (this.spare) entry.model.dispose();
      else {
        entry.model.root.visible = false;
        this.spare = entry.model;
      }
    }
  }

  private build(): WeaponModel {
    const rigged = createRiggedModel('grenade', this.kit, 'third');
    // The pin came out during the cook.
    const pin = rigged.parts.get('pin');
    if (pin) pin.visible = false;
    rigged.model.root.matrixAutoUpdate = false;
    return rigged.model;
  }

  private add(id: number, owner: number): Entry {
    const model = this.spare ?? this.build();
    this.spare = null;
    model.root.visible = true;
    this.group.add(model.root);
    const rest = new THREE.Quaternion().setFromEuler(euler.set((Math.random() - 0.5) * 0.6, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.6));
    const live: LiveGrenade = { id, drawn: new THREE.Vector3(), now: new THREE.Vector3(), left: 0, age: 0, thrower: owner, own: owner === this.you };
    const entry: Entry = { model, bounces: 0, spin: Math.random() * 6, settle: 0, rest, landed: false, sight: { at: -Infinity, clear: false }, live };
    this.models.set(id, entry);
    return entry;
  }

  dispose() {
    for (const entry of this.models.values()) entry.model.dispose();
    this.models.clear();
    this.spare?.dispose();
    this.spare = null;
    this.fx.dispose();
    this.primer.dispose();
    this.group.clear();
    this.live.length = 0;
  }
}

/**
 * The surface normal at a bounce between snapshots `i - 1` and `i`, from the change in velocity across it (the push
 * off a surface is along its normal; gravity over the gap is taken back out). Null for a graze.
 */
function impulse(snapshots: readonly Snapshot[], i: number, id: number): THREE.Vector3 | null {
  const at = (j: number) => {
    const s = snapshots[j];
    const g = s?.grenades.find((x) => x.id === id);
    return s && g ? { t: s.time, x: g.x, y: g.y, z: g.z } : null;
  };
  const p0 = at(i - 2);
  const p1 = at(i - 1);
  const p2 = at(i);
  const p3 = at(i + 1);
  // Thrown straight into something, or no later snapshot yet: take it as the floor.
  if (!p0 || !p1 || !p2 || !p3) return new THREE.Vector3(0, 1, 0);
  const before = Math.max(1e-3, p1.t - p0.t);
  const after = Math.max(1e-3, p3.t - p2.t);
  const gap = (p3.t + p2.t) / 2 - (p1.t + p0.t) / 2;
  const n = new THREE.Vector3(
    (p3.x - p2.x) / after - (p1.x - p0.x) / before,
    (p3.y - p2.y) / after - (p1.y - p0.y) / before + MOVE.gravity * gap,
    (p3.z - p2.z) / after - (p1.z - p0.z) / before
  );
  if (n.length() < 1.2) return null;
  return n.normalize();
}
