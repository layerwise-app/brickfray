import * as THREE from 'three';
import type { CollisionWorld } from '../sim/collision';
import { ANKLE_H } from '../characters/skeleton';

const FIGURES = 24;
/** Per figure: a contact blob, the cast shadow and a core under each foot. */
const CAPACITY = FIGURES * 4;
/** How far below the feet a floor still catches the shadow, in meters. */
const REACH = 9;
const FADE_FROM = 70;
const FADE_TO = 110;
const FIGURE_HEIGHT = 1.75;
/** Longest cast shadow drawn: past this a low sun's blob would read as a stain rather than a shadow. */
const LONGEST = 1.8;
const FALLBACK_SUN = new THREE.Vector3(0.45, 0.8, 0.4).normalize();

const VERTEX = /* glsl */ `
attribute vec3 aLook;
varying vec2 vUv;
varying vec3 vLook;
void main() {
  vUv = uv;
  vLook = aLook;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
// aLook: strength, edge hardness (0 soft cast shadow, 1 foot core), fade toward the far (sun-away) end.
const FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec3 vLook;
void main() {
  vec2 d = vUv * 2.0 - 1.0;
  float r = length(d);
  float shape = mix(smoothstep(1.0, 0.3, r), smoothstep(1.0, 0.68, r), vLook.y);
  float tail = 1.0 - vLook.z * smoothstep(-0.5, 1.0, d.y);
  float a = shape * tail * vLook.x;
  if (a < 0.004) discard;
  gl_FragColor = vec4(0.03, 0.04, 0.08, a);
}`;

const scratch: number[] = [];
const m = new THREE.Matrix4();
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const q = new THREE.Quaternion();
const eye = new THREE.Vector3();
const sun = new THREE.Vector3();
const ankle = new THREE.Vector3();
const ball = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const qView = new THREE.Quaternion();

/**
 * Shadows on the floor under figures, for tiers without shadow maps: one instanced draw, no render targets. Each
 * figure casts a soft blob stretched away from the sun, and each planted foot presses a dark, hard-edged core into
 * the floor. They sit on the highest box top below the figure, so they stay on the ground through jumps and falls;
 * an airborne figure's shadow slides away from the sun and lightens, its foot cores lift off first.
 */
export class BlobShadows {
  readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly feet = new WeakMap<THREE.Object3D, (THREE.Object3D | undefined)[]>();
  private sunLight: THREE.DirectionalLight | null = null;
  private count = 0;

  constructor(private readonly world: CollisionWorld | null) {
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.rotateX(-Math.PI / 2);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
    geometry.setAttribute('aLook', this.look);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
    this.mesh.name = 'blob-shadows';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
  }

  /** `figures` are character roots: origin between the feet, first child scaled to the figure's size. */
  update(figures: readonly THREE.Object3D[], camera: THREE.Camera) {
    camera.getWorldPosition(eye);
    this.sunDirection();
    const flat = Math.hypot(sun.x, sun.z);
    // Ground direction of the shadow (away from the sun) and how far it runs per meter of height.
    const run = flat / Math.max(sun.y, 0.2);
    const dx = flat > 1e-3 ? -sun.x / flat : 0;
    const dz = flat > 1e-3 ? -sun.z / flat : 1;
    const heading = Math.atan2(-dx, -dz);
    this.count = 0;
    for (const figure of figures) {
      if (!figure.visible || this.count + 4 > CAPACITY) continue;
      const at = figure.position;
      const floor = this.floorBelow(at.x, at.y, at.z);
      if (floor === null) continue;
      const height = Math.max(0, at.y - floor);
      const far = 1 - THREE.MathUtils.smoothstep(eye.distanceTo(at), FADE_FROM, FADE_TO);
      const lift = THREE.MathUtils.smoothstep(height, 0.05, 2.5);
      const strength = 0.8 * (1 - 0.4 * lift) * (1 - THREE.MathUtils.smoothstep(height, 3, REACH)) * far;
      if (strength <= 0.01) continue;
      const scale = figure.children[0]?.scale.x ?? 1;
      const length = Math.min(FIGURE_HEIGHT * scale * run, LONGEST);
      const slide = Math.min(height * run, 2.5);
      const centre = length * 0.5 - 0.04 + slide;
      // A soft round blob right under the figure, whatever the sun does, so it stands on the floor at any range. Far
      // away the floor is seen edge-on and would flatten it to a line: it grows and stretches along the view.
      const range = eye.distanceTo(at);
      const k = THREE.MathUtils.smoothstep(range, 6, 26);
      const r = 0.42 * scale * (1 + 0.5 * k) * (1 + 0.3 * lift);
      qView.setFromAxisAngle(up, Math.atan2(at.x - eye.x, at.z - eye.z));
      q.copy(qView);
      this.put(p.set(at.x, floor + 0.014, at.z), r, r * (1 + 2 * k), Math.min(0.9, 0.58 + 0.32 * k) * (1 - 0.5 * lift) * far, 0.45, 0);
      q.setFromAxisAngle(up, heading);
      this.put(p.set(at.x + dx * centre, floor + 0.015, at.z + dz * centre), 0.3 * scale * (1 - 0.15 * lift), length * 0.5 + 0.26 * scale, strength, 0, 0.7);
      this.feetCores(figure, floor, scale, far * (1 - lift), dx, dz);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.look.needsUpdate = true;
  }

  private feetCores(figure: THREE.Object3D, floor: number, scale: number, strength: number, dx: number, dz: number) {
    let bones = this.feet.get(figure);
    if (!bones) {
      bones = ['footL', 'toeL', 'footR', 'toeR'].map((name) => figure.getObjectByName(name));
      this.feet.set(figure, bones);
    }
    for (let i = 0; i < 4; i += 2) {
      const foot = bones[i];
      const toe = bones[i + 1];
      if (!foot || !toe || strength <= 0.01) continue;
      foot.getWorldPosition(ankle);
      toe.getWorldPosition(ball);
      const sole = Math.min(ankle.y - ANKLE_H * scale, ball.y - 0.03 * scale) - floor;
      const planted = 1 - THREE.MathUtils.smoothstep(sole, 0.02, 0.2);
      if (planted <= 0.01) continue;
      q.setFromAxisAngle(up, Math.atan2(ankle.x - ball.x, ankle.z - ball.z));
      // A little larger than the sole and pushed off it away from the sun, so the dark rim shows around the shoe.
      p.lerpVectors(ankle, ball, 0.45).setY(floor + 0.016);
      p.x += dx * 0.03 * scale;
      p.z += dz * 0.03 * scale;
      this.put(p, 0.115 * scale, 0.2 * scale, 0.97 * planted * strength, 1, 0);
    }
  }

  private put(at: THREE.Vector3, halfWidth: number, halfLength: number, strength: number, hard: number, tail: number) {
    m.compose(at, q, s.set(halfWidth, 1, halfLength));
    this.mesh.setMatrixAt(this.count, m);
    this.look.setXYZ(this.count, strength, hard, tail);
    this.count++;
  }

  /** Into `sun`: toward the scene's sun, which the renderer keeps placed along it above the player. */
  private sunDirection() {
    if (!this.sunLight) {
      let top: THREE.Object3D = this.mesh;
      while (top.parent) top = top.parent;
      top.traverse((o) => {
        if (!this.sunLight && o instanceof THREE.DirectionalLight) this.sunLight = o;
      });
    }
    const light = this.sunLight;
    if (light) sun.subVectors(light.position, light.target.position);
    if (!light || sun.lengthSq() < 1e-6) sun.copy(FALLBACK_SUN);
    sun.normalize();
  }

  private floorBelow(x: number, y: number, z: number): number | null {
    if (!this.world) return 0;
    const b = this.world.boxes;
    let top: number | null = null;
    for (const i of this.world.overlaps(x - 0.12, y - REACH, z - 0.12, x + 0.12, y + 0.3, z + 0.12, scratch)) {
      const t = b[i * 6 + 4]!;
      if (t <= y + 0.3 && (top === null || t > top)) top = t;
    }
    return top;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
