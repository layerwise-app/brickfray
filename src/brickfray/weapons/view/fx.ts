import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kit } from '../../engine/kit';
import { latheZ, stud, tube } from '../shapes';
import { paint, surfaceMaterial } from '../surface';
import { MuzzleFlash, type FlashStyle } from './flash';

export type CasingKind = 'brass' | 'shell' | 'long';

const MAX_CASINGS = 10;
/** An aimed shot's case: thrown in view space (right, a little up, away from the eye), and drawn this much smaller so it never looms in front of the sight. */
const AIMED_THROW = new THREE.Vector3(2.8, 0.3, -0.35);
const AIMED_SMALLER = 0.5;
/** A fired spear is seen leaving: carried on down the line of fire at this speed (m/s) for this long (s). */
const SPEAR_SPEED = 10;
const SPEAR_LIFE = 0.1;

/** Muzzle flash and spent casings that tumble out of the ejection port and fall out of view. */
export class ViewFx {
  private readonly flash: MuzzleFlash;
  private flight: { body: THREE.Object3D; velocity: THREE.Vector3; age: number } | null = null;
  private readonly casings: Record<CasingKind, { mesh: THREE.InstancedMesh; live: Casing[] }>;
  readonly shellGeometry: THREE.BufferGeometry;
  /** A shell in the other hull colour the side carrier holds every second one of. */
  readonly blueShell: THREE.BufferGeometry;

  constructor(
    private readonly scene: THREE.Scene,
    kit: Kit
  ) {
    this.flash = new MuzzleFlash(scene);

    const material = surfaceMaterial(kit.materials);
    // Casings tumble close to the eye: round on every tier (a few dozen instanced triangles more), never visible prisms.
    const seg = 12;
    const make = (geo: THREE.BufferGeometry) => {
      const mesh = new THREE.InstancedMesh(geo, material, MAX_CASINGS);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, live: [] as Casing[] };
    };
    this.shellGeometry = shellGeometry(seg);
    this.blueShell = shellGeometry(seg, '#2f6fd0');
    this.casings = { brass: make(brassGeometry(seg)), shell: make(this.shellGeometry), long: make(longGeometry(seg)) };
  }

  /** Lay out a fresh flash on the muzzle node; `aim` 0…1 is how far the gun is aimed. */
  fire(muzzle: THREE.Object3D, style: FlashStyle, aim = 0) {
    this.flash.fire(muzzle, style, aim);
  }

  /** A copy of the seated spear `part` takes over from it and flies off down the muzzle's line of fire. */
  launch(part: THREE.Object3D, muzzle: THREE.Object3D) {
    this.flight?.body.removeFromParent();
    const body = part.clone(true);
    body.visible = true;
    part.updateWorldMatrix(true, false);
    part.matrixWorld.decompose(body.position, body.quaternion, body.scale);
    this.scene.add(body);
    this.flight = { body, velocity: new THREE.Vector3(0, 0, -SPEAR_SPEED).transformDirection(muzzle.matrixWorld).multiplyScalar(SPEAR_SPEED), age: 0 };
  }

  /** Spawn a casing at the port, thrown along the port's +X and up; `aim` 0…1 is how far the gun is aimed. */
  eject(kind: CasingKind, port: THREE.Object3D, power = 1, aim = 0) {
    const set = this.casings[kind];
    if (set.live.length >= MAX_CASINGS) set.live.shift();
    const p = port.getWorldPosition(new THREE.Vector3());
    const q = port.getWorldQuaternion(new THREE.Quaternion());
    const v = new THREE.Vector3(0.55 + Math.random() * 0.35, 1.5 + Math.random() * 0.45, 0.35 + Math.random() * 0.3).applyQuaternion(q);
    // Aimed, the port sits a hand's width under the eye: the case is flung straight out to the right, flat and fast, and is out of the picture in a few frames instead of crossing the sight.
    v.lerp(AIMED_THROW.clone().multiplyScalar(0.9 + Math.random() * 0.25), aim).multiplyScalar(power);
    const spin = new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20, 18 + Math.random() * 18);
    set.live.push({ p, q: q.clone(), v, spin, age: 0, size: 1 - AIMED_SMALLER * aim });
  }

  update(dt: number) {
    this.flash.update(dt);
    const f = this.flight;
    if (f) {
      f.age += dt;
      f.body.position.addScaledVector(f.velocity, dt);
      if (f.age >= SPEAR_LIFE) {
        f.body.removeFromParent();
        this.flight = null;
      }
    }
    const m = new THREE.Matrix4();
    const dq = new THREE.Quaternion();
    const e = new THREE.Euler();
    const size = new THREE.Vector3();
    for (const set of Object.values(this.casings)) {
      set.live = set.live.filter((c) => c.age < 1.2 && c.p.y > -1.2);
      set.live.forEach((c, i) => {
        c.age += dt;
        c.v.y -= 9.5 * dt;
        c.p.addScaledVector(c.v, dt);
        e.set(c.spin.x * dt, c.spin.y * dt, c.spin.z * dt);
        c.q.multiply(dq.setFromEuler(e));
        set.mesh.setMatrixAt(i, m.compose(c.p, c.q, size.setScalar(c.size)));
      });
      set.mesh.count = set.live.length;
      set.mesh.visible = set.live.length > 0;
      set.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.flash.dispose();
    this.flight?.body.removeFromParent();
    for (const set of Object.values(this.casings)) {
      set.mesh.removeFromParent();
      set.mesh.geometry.dispose();
      set.mesh.dispose();
    }
    this.blueShell.dispose();
  }
}

interface Casing {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  size: number;
}

function merged(parts: [THREE.BufferGeometry, string, 'metal' | 'plastic' | 'dark'][]) {
  return mergeGeometries(parts.map(([g, c, s]) => paint(g.clone(), c, s)))!;
}

/** Stud-like brass casing along Z. */
function brassGeometry(seg: number) {
  const body = latheZ([[0, -0.013], [0.0056, -0.013], [0.0056, 0.009], [0.0064, 0.0105], [0.0064, 0.013], [0, 0.013]], seg);
  const cap = stud(0.0032, 0.0022, seg, false).clone().rotateX(-Math.PI / 2).translate(0, 0, -0.013);
  return merged([[body, '#d8a845', 'metal'], [cap, '#c08a2e', 'metal']]);
}

function longGeometry(seg: number) {
  const body = latheZ([[0, -0.03], [0.0028, -0.03], [0.0032, -0.022], [0.0058, -0.016], [0.0058, 0.026], [0.0064, 0.027], [0.0064, 0.03], [0, 0.03]], seg);
  return merged([[body, '#dcae4a', 'metal']]);
}

/** Shotgun shell: colored hull, brass head. */
function shellGeometry(seg: number, color = '#d3302a') {
  const hull = tube(0.0098, 0.05, seg, 0.0015).clone().translate(0, 0, -0.006);
  const head = tube(0.0104, 0.014, seg, 0.001).clone().translate(0, 0, 0.025);
  return merged([[hull, color, 'plastic'], [head, '#d4a443', 'metal']]);
}
