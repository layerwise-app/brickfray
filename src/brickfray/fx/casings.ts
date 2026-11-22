import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kit } from '../engine/kit';
import type { CollisionWorld } from '../sim/collision';
import type { WeaponId } from '../weapons/defs';
import { latheZ, stud, tube } from '../weapons/shapes';
import { paint, surfaceMaterial } from '../weapons/surface';

type Kind = 'brass' | 'shell' | 'long';

/** The case each gun throws, and how long after the shot: pump and bolt guns throw theirs as they cycle. */
const EJECT: Partial<Record<WeaponId, { kind: Kind; delay: number }>> = {
  ar: { kind: 'brass', delay: 0 },
  pistol: { kind: 'brass', delay: 0 },
  buzzer: { kind: 'brass', delay: 0 },
  shotgun: { kind: 'shell', delay: 0.3 },
  sniper: { kind: 'long', delay: 0.45 }
};
const MAX = 24;
const LIFE = 1.5;
/** Only guns this near the camera throw cases (m): farther ones would be a pixel at most. */
const REACH = 10;
/** Drawn a little larger than the first-person cases so they read on chunky toy guns at a few metres. */
const SCALE = 1.4;
const GRAVITY = 9.5;

interface Case {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  floor: number;
  resting: boolean;
}

const m = new THREE.Matrix4();
const dq = new THREE.Quaternion();
const e = new THREE.Euler();
const size = new THREE.Vector3();
const at = new THREE.Vector3();

/** Spent cases thrown from other players' guns: one instanced mesh per kind, built at load and empty until used. */
export class Casings {
  readonly group = new THREE.Group();
  private readonly sets: Record<Kind, { mesh: THREE.InstancedMesh; live: Case[] }>;
  private readonly pending: { port: THREE.Object3D; kind: Kind; at: number }[] = [];
  private time = 0;

  constructor(
    kit: Kit,
    private readonly world: CollisionWorld | null
  ) {
    const material = surfaceMaterial(kit.materials);
    const seg = kit.profile.detail >= 1 ? 10 : 6;
    const make = (geometry: THREE.BufferGeometry) => {
      const mesh = new THREE.InstancedMesh(geometry, material, MAX);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
      return { mesh, live: [] as Case[] };
    };
    this.sets = { brass: make(brass(seg)), shell: make(shell(seg)), long: make(long(seg)) };
    this.group.name = 'casings';
  }

  /** A shot from `weapon` whose case leaves from `port`, seen from `eye`. */
  eject(weapon: WeaponId, port: THREE.Object3D, eye: THREE.Vector3) {
    const how = EJECT[weapon];
    if (!how || port.getWorldPosition(at).distanceTo(eye) > REACH) return;
    if (how.delay > 0) this.pending.push({ port, kind: how.kind, at: this.time + how.delay });
    else this.spawn(how.kind, port);
  }

  update(dt: number) {
    this.time += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (p.at > this.time) continue;
      this.pending.splice(i, 1);
      if (shown(p.port)) this.spawn(p.kind, p.port);
    }
    for (const set of Object.values(this.sets)) {
      if (!set.live.length && set.mesh.count === 0) continue;
      set.live = set.live.filter((c) => c.age < LIFE);
      set.live.forEach((c, i) => {
        c.age += dt;
        if (!c.resting) this.fly(c, dt);
        const shrink = Math.min(1, (LIFE - c.age) / 0.25);
        set.mesh.setMatrixAt(i, m.compose(c.p, c.q, size.setScalar(SCALE * shrink)));
      });
      set.mesh.count = set.live.length;
      set.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear() {
    this.pending.length = 0;
    for (const set of Object.values(this.sets)) {
      set.live.length = 0;
      set.mesh.count = 0;
    }
  }

  private spawn(kind: Kind, port: THREE.Object3D) {
    const set = this.sets[kind];
    if (set.live.length >= MAX) set.live.shift();
    const p = port.getWorldPosition(new THREE.Vector3());
    const q = port.getWorldQuaternion(new THREE.Quaternion());
    // Out of the port to the gun's right, up and a little back, as the first-person gun throws them.
    const v = new THREE.Vector3(1.1 + Math.random() * 0.6, 1.5 + Math.random() * 0.5, 0.3 + Math.random() * 0.3).applyQuaternion(q);
    const spin = new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20, 18 + Math.random() * 18);
    const below = this.world?.raycast(p.x, p.y, p.z, 0, -1, 0, 3, false);
    set.live.push({ p, q, v, spin, age: 0, floor: below ? p.y - below.t : p.y - 3, resting: false });
  }

  /** Falls, tumbling, and bounces twice or so on the floor under the port before it lies flat. */
  private fly(c: Case, dt: number) {
    c.v.y -= GRAVITY * dt;
    c.p.addScaledVector(c.v, dt);
    c.q.multiply(dq.setFromEuler(e.set(c.spin.x * dt, c.spin.y * dt, c.spin.z * dt)));
    const ground = c.floor + 0.012 * SCALE;
    if (c.p.y > ground) return;
    c.p.y = ground;
    if (c.v.y < -0.8) {
      c.v.set(c.v.x * 0.5, -c.v.y * 0.32, c.v.z * 0.5);
      c.spin.multiplyScalar(0.5);
      return;
    }
    c.resting = true;
    c.q.setFromEuler(e.set(0, Math.random() * Math.PI * 2, 0));
  }
}

function shown(o: THREE.Object3D | null) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function merged(parts: [THREE.BufferGeometry, string, 'metal' | 'plastic'][]) {
  return mergeGeometries(parts.map(([g, c, s]) => paint(g.clone(), c, s)))!;
}

function brass(seg: number) {
  const body = latheZ([[0, -0.013], [0.0056, -0.013], [0.0056, 0.009], [0.0064, 0.0105], [0.0064, 0.013], [0, 0.013]], seg);
  const cap = stud(0.0032, 0.0022, seg, false).clone().rotateX(-Math.PI / 2).translate(0, 0, -0.013);
  return merged([[body, '#d8a845', 'metal'], [cap, '#c08a2e', 'metal']]);
}

function long(seg: number) {
  return merged([[latheZ([[0, -0.03], [0.0028, -0.03], [0.0032, -0.022], [0.0058, -0.016], [0.0058, 0.026], [0.0064, 0.027], [0.0064, 0.03], [0, 0.03]], seg), '#dcae4a', 'metal']]);
}

function shell(seg: number) {
  const hull = tube(0.0098, 0.05, seg, 0.0015).clone().translate(0, 0, -0.006);
  const head = tube(0.0104, 0.014, seg, 0.001).clone().translate(0, 0, 0.025);
  return merged([[hull, '#d3302a', 'plastic'], [head, '#d4a443', 'metal']]);
}
