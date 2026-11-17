import * as THREE from 'three';

interface Tracer {
  start: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  traveled: number;
  speed: number;
  streak: number;
  width: number;
  color: THREE.Color;
}

const MAX = 96;

const VERTEX = /* glsl */ `
attribute vec3 instanceTint;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vUv = uv;
  vTint = instanceTint;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float along = vUv.x;             // 0 tail … 1 head
  float across = abs(vUv.y - 0.5) * 2.0;
  float core = smoothstep(1.0, 0.0, across);
  float fade = pow(along, 1.6);
  vec3 col = mix(vTint, vec3(1.0), core * core * 0.7) * (0.6 + core * 1.8);
  gl_FragColor = vec4(col * fade * core, 1.0);
}`;

/**
 * Bullet tracers as camera-facing ribbons that race from the muzzle to the hit
 * point. Drawn additively in one instanced call.
 */
export class Tracers {
  readonly mesh: THREE.InstancedMesh;
  private readonly tint: THREE.InstancedBufferAttribute;
  private list: Tracer[] = [];
  private m = new THREE.Matrix4();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private mid = new THREE.Vector3();
  private side = new THREE.Vector3();
  private view = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private normal = new THREE.Vector3();

  constructor() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.translate(0.5, 0, 0);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    geometry.setAttribute('instanceTint', this.tint);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 5;
  }

  /** From the on-screen muzzle to the impact; `streak` is the visible length in meters. */
  add(from: THREE.Vector3, to: THREE.Vector3, options: { color?: THREE.ColorRepresentation; speed?: number; streak?: number; width?: number } = {}) {
    const dir = to.clone().sub(from);
    const length = dir.length();
    if (length < 0.5) return;
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      start: from.clone(),
      dir: dir.divideScalar(length),
      length,
      traveled: 0,
      speed: options.speed ?? 320,
      streak: options.streak ?? 4.5,
      width: options.width ?? 0.035,
      color: new THREE.Color(options.color ?? '#ffd27a')
    });
  }

  update(dt: number, camera: THREE.Camera) {
    let n = 0;
    camera.getWorldPosition(this.view);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i]!;
      t.traveled += t.speed * dt;
      if (t.traveled - t.streak > t.length) {
        this.list.splice(i, 1);
        continue;
      }
      const head = Math.min(t.traveled, t.length);
      const tail = Math.max(0, t.traveled - t.streak);
      this.a.copy(t.start).addScaledVector(t.dir, tail);
      this.b.copy(t.start).addScaledVector(t.dir, head);
      const len = head - tail;
      if (len <= 0.01) continue;
      this.mid.copy(this.a);
      this.normal.subVectors(this.view, this.mid).normalize();
      this.side.crossVectors(t.dir, this.normal).normalize();
      // Width grows with distance a bit so far tracers stay visible.
      const dist = this.view.distanceTo(this.mid);
      const width = t.width * (1 + dist * 0.02);
      this.axis.crossVectors(this.side, t.dir).normalize();
      this.m.makeBasis(this.a.set(t.dir.x * len, t.dir.y * len, t.dir.z * len), this.side.multiplyScalar(width), this.axis);
      this.m.setPosition(this.mid);
      this.mesh.setMatrixAt(n, this.m);
      this.tint.setXYZ(n, t.color.r, t.color.g, t.color.b);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tint.needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.mesh.count = 0;
  }
}
