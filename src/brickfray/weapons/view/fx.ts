import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kit } from '../../engine/kit';
import { latheZ, stud, tube } from '../shapes';
import { paint, surfaceMaterial } from '../surface';

export type CasingKind = 'brass' | 'shell' | 'long';

/** Flash size per weapon: star radius, petal length, petal width, side blasts. */
export interface FlashStyle {
  star: number;
  petal: number;
  width: number;
  side: number;
}

const QUADS = 6;
const MAX_CASINGS = 10;

/**
 * Muzzle flash (star + petals + core, one additive draw call, 1–2 frames) and
 * spent casings that tumble out of the ejection port and fall out of view.
 */
export class ViewFx {
  readonly flash: THREE.Mesh;
  private readonly flashGeo: THREE.BufferGeometry;
  private readonly texture: THREE.CanvasTexture;
  private flashAge = 1;
  private readonly casings: Record<CasingKind, { mesh: THREE.InstancedMesh; live: Casing[] }>;
  readonly shellGeometry: THREE.BufferGeometry;

  constructor(
    private readonly scene: THREE.Scene,
    kit: Kit
  ) {
    this.texture = flashAtlas();
    this.flashGeo = new THREE.BufferGeometry();
    this.flashGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(QUADS * 4 * 3), 3));
    this.flashGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(QUADS * 4 * 2), 2));
    const index: number[] = [];
    for (let q = 0; q < QUADS; q++) index.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
    this.flashGeo.setIndex(index);
    this.flash = new THREE.Mesh(
      this.flashGeo,
      new THREE.MeshBasicMaterial({
        map: this.texture,
        color: new THREE.Color(1.6, 1.35, 1.1),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    this.flash.frustumCulled = false;
    this.flash.renderOrder = 10;
    this.flash.visible = false;

    const material = surfaceMaterial(kit.materials);
    const seg = kit.profile.detail >= 1 ? 12 : 8;
    const make = (geo: THREE.BufferGeometry) => {
      const mesh = new THREE.InstancedMesh(geo, material, MAX_CASINGS);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, live: [] as Casing[] };
    };
    this.shellGeometry = shellGeometry(seg);
    this.casings = { brass: make(brassGeometry(seg)), shell: make(this.shellGeometry), long: make(longGeometry(seg)) };
  }

  /** Re-roll the flash cards and show them; `parent` is the muzzle node. */
  fire(parent: THREE.Object3D, style: FlashStyle) {
    parent.add(this.flash);
    const pos = this.flashGeo.getAttribute('position') as THREE.BufferAttribute;
    const uv = this.flashGeo.getAttribute('uv') as THREE.BufferAttribute;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    let q = 0;
    const quad = (cell: number, corners: THREE.Vector3[]) => {
      corners.forEach((c, i) => pos.setXYZ(q * 4 + i, c.x, c.y, c.z));
      const u0 = cell / 3;
      uv.setXY(q * 4, u0, 0);
      uv.setXY(q * 4 + 1, u0 + 1 / 3, 0);
      uv.setXY(q * 4 + 2, u0 + 1 / 3, 1);
      uv.setXY(q * 4 + 3, u0, 1);
      q++;
    };
    // Front star facing back along the barrel, random spin and size.
    const s = style.star * rnd(0.8, 1.2);
    const spin = Math.random() * Math.PI;
    const ca = Math.cos(spin) * s;
    const sa = Math.sin(spin) * s;
    quad(0, [new THREE.Vector3(-ca + sa, -sa - ca, -0.01), new THREE.Vector3(ca + sa, sa - ca, -0.01), new THREE.Vector3(ca - sa, sa + ca, -0.01), new THREE.Vector3(-ca - sa, -sa + ca, -0.01)]);
    // Petals: cards containing the barrel axis, flaring forward.
    const petals = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < 3; i++) {
      const len = i < petals ? style.petal * rnd(0.7, 1.25) : 0;
      const w = style.width * rnd(0.8, 1.2) * 0.5;
      const a = (i / petals) * Math.PI + rnd(-0.4, 0.4);
      const ax = Math.cos(a) * w;
      const ay = Math.sin(a) * w;
      quad(1, [new THREE.Vector3(-ax, -ay, 0.004), new THREE.Vector3(ax, ay, 0.004), new THREE.Vector3(ax, ay, -len), new THREE.Vector3(-ax, -ay, -len)]);
    }
    // Side blasts out of a muzzle brake (sniper), else unused.
    const side = style.side * rnd(0.8, 1.2);
    quad(1, [new THREE.Vector3(0, -side * 0.3, -0.004), new THREE.Vector3(0, side * 0.3, -0.004), new THREE.Vector3(side * 2, side * 0.3, -0.004), new THREE.Vector3(side * 2, -side * 0.3, -0.004)]);
    // Hot core.
    const c = style.star * 0.42;
    quad(2, [new THREE.Vector3(-c, -c, -0.02), new THREE.Vector3(c, -c, -0.02), new THREE.Vector3(c, c, -0.02), new THREE.Vector3(-c, c, -0.02)]);
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    this.flash.visible = true;
    this.flashAge = -1;
  }

  /** Spawn a casing at the port, thrown along the port's +X and up. */
  eject(kind: CasingKind, port: THREE.Object3D, power = 1) {
    const set = this.casings[kind];
    if (set.live.length >= MAX_CASINGS) set.live.shift();
    const p = port.getWorldPosition(new THREE.Vector3());
    const q = port.getWorldQuaternion(new THREE.Quaternion());
    const v = new THREE.Vector3(0.55 + Math.random() * 0.35, 1.5 + Math.random() * 0.45, 0.35 + Math.random() * 0.3).multiplyScalar(power).applyQuaternion(q);
    const spin = new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20, 18 + Math.random() * 18);
    set.live.push({ p, q: q.clone(), v, spin, age: 0 });
  }

  update(dt: number) {
    if (this.flashAge < 0) this.flashAge = 0;
    else this.flashAge += dt;
    this.flash.visible = this.flashAge < 0.03;
    const m = new THREE.Matrix4();
    const dq = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    for (const set of Object.values(this.casings)) {
      set.live = set.live.filter((c) => c.age < 1.2 && c.p.y > -1.2);
      set.live.forEach((c, i) => {
        c.age += dt;
        c.v.y -= 9.5 * dt;
        c.p.addScaledVector(c.v, dt);
        e.set(c.spin.x * dt, c.spin.y * dt, c.spin.z * dt);
        c.q.multiply(dq.setFromEuler(e));
        set.mesh.setMatrixAt(i, m.compose(c.p, c.q, one));
      });
      set.mesh.count = set.live.length;
      set.mesh.visible = set.live.length > 0;
      set.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.flash.removeFromParent();
    this.flashGeo.dispose();
    this.texture.dispose();
    (this.flash.material as THREE.Material).dispose();
    for (const set of Object.values(this.casings)) {
      set.mesh.removeFromParent();
      set.mesh.geometry.dispose();
      set.mesh.dispose();
    }
  }
}

interface Casing {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
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
function shellGeometry(seg: number) {
  const hull = tube(0.0098, 0.05, seg, 0.0015).clone().translate(0, 0, -0.006);
  const head = tube(0.0104, 0.014, seg, 0.001).clone().translate(0, 0, 0.025);
  return merged([[hull, '#d3302a', 'plastic'], [head, '#d4a443', 'metal']]);
}

/** 3-cell atlas: spiky star, flame petal, soft core. */
function flashAtlas(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S * 3;
  canvas.height = S;
  const g = canvas.getContext('2d')!;
  const glow = (cx: number, cy: number, r: number) => {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,240,1)');
    grad.addColorStop(0.25, 'rgba(255,226,140,0.95)');
    grad.addColorStop(0.6, 'rgba(255,140,40,0.55)');
    grad.addColorStop(1, 'rgba(255,90,20,0)');
    return grad;
  };
  // Star: 7 uneven spikes.
  g.save();
  g.translate(S / 2, S / 2);
  g.beginPath();
  const spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? S * (0.38 + 0.1 * Math.sin(i * 2.3)) : S * 0.13;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = glow(0, 0, S * 0.48);
  g.fill();
  g.restore();
  // Petal: teardrop pointing up (v = 1 is the far end).
  g.save();
  g.translate(S * 1.5, 0);
  g.beginPath();
  g.moveTo(0, S * 0.98);
  g.bezierCurveTo(S * 0.42, S * 0.7, S * 0.3, S * 0.2, 0, S * 0.02);
  g.bezierCurveTo(-S * 0.3, S * 0.2, -S * 0.42, S * 0.7, 0, S * 0.98);
  const pg = g.createLinearGradient(0, S, 0, 0);
  pg.addColorStop(0, 'rgba(255,250,225,1)');
  pg.addColorStop(0.35, 'rgba(255,205,110,0.9)');
  pg.addColorStop(0.75, 'rgba(255,120,40,0.45)');
  pg.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = pg;
  g.fill();
  g.restore();
  // Core.
  g.fillStyle = glow(S * 2.5, S / 2, S * 0.5);
  g.fillRect(S * 2, 0, S, S);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
