import * as THREE from 'three';
import type { WeaponId } from '../weapons/defs';
import { TRACER } from './muzzle';

interface Tracer {
  start: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  traveled: number;
  speed: number;
  streak: number;
  width: number;
  color: THREE.Color;
  /** Seconds the trail has left to fade once the bullet has landed. */
  linger: number;
  maxLinger: number;
  /** How bright the trail behind the head stays (tracer rounds keep a solid line). */
  trail: number;
}

const MAX = 96;
/** The trail hangs in the air this long after the hit, so a shot across a room is still seen. */
const LINGER = 0.11;
/** Every third rifle round is a tracer round: wider, longer, a solid line that holds a beat after the hit. */
const TRACER_EVERY = 3;
const TRACER_LINGER = 0.2;
/** On-screen width limits in radians (halo included; the hot core is the middle third): thick enough to read on a bright facade far away, never a slab next to the muzzle. */
const WIDEST = 0.026;
const THINNEST = 0.015;
/** View-space depth the ribbon is clipped at, so a shot passing beside the camera never smears across the screen. */
const NEAR = 0.15;

const VERTEX = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec4 aShape;
attribute vec3 aTint;
varying vec2 vUv;
varying vec3 vTint;
varying vec3 vHead;
varying float vNear;
void main() {
  vUv = uv;
  vTint = aTint;
  vHead = aShape.yzw;
  vec4 a = viewMatrix * vec4(aStart, 1.0);
  vec4 b = viewMatrix * vec4(aEnd, 1.0);
  if (a.z > -${NEAR} && b.z > -${NEAR}) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  if (a.z > -${NEAR}) a = mix(a, b, (a.z + ${NEAR}) / (a.z - b.z));
  if (b.z > -${NEAR}) b = mix(b, a, (b.z + ${NEAR}) / (b.z - a.z));
  vec4 p = mix(a, b, position.x);
  vec2 along = b.xy / -b.z - a.xy / -a.z;
  vec2 side = normalize(vec2(-along.y, along.x) + vec2(1e-6, 0.0));
  float dist = -p.z;
  float width = clamp(aShape.x, dist * ${THINNEST}, dist * ${WIDEST});
  p.xy += side * position.y * width;
  // The stretch right next to the camera fades out instead of filling the screen.
  vNear = smoothstep(0.3, 1.3, length(p.xyz));
  gl_Position = projectionMatrix * p;
}`;
const FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
varying vec3 vHead;
varying float vNear;
void main() {
  float across = abs(vUv.y - 0.5) * 2.0;
  float core = smoothstep(0.42, 0.12, across);
  float rim = smoothstep(0.64, 0.4, across);
  float halo = pow(max(1.0 - across, 0.0), 1.6);
  // The bullet itself is the bright last stretch; behind it a fainter trail back to the muzzle.
  float head = pow(smoothstep(1.0 - vHead.x, 1.0, vUv.x), 1.3);
  float trail = vHead.z * smoothstep(0.0, 0.12, vUv.x);
  float k = max(head, trail) * vHead.y * vNear;
  // A white-hot core inside a deep-coloured rim that covers what is behind (it reads on white walls and sky, where
  // light alone vanishes), wrapped in a soft glow of the gun's colour that also dims what is behind it a little, so
  // the glow still shows on a bright wall; written premultiplied.
  gl_FragColor = vec4(vTint, 1.0);
  #include <colorspace_fragment>
  vec3 glow = gl_FragColor.rgb;
  vec3 col = mix(pow(vTint, vec3(2.4)) * 0.6, vec3(1.0, 0.97, 0.88), core * (0.4 + 0.6 * head));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  float cover = rim * k;
  gl_FragColor = vec4(gl_FragColor.rgb * cover * 1.25 + glow * halo * k * 0.5, min(1.0, cover * 0.95 + halo * k * 0.22));
}`;

/**
 * Bullet tracers as screen-facing ribbons: a bright streak races from the muzzle to the hit point
 * and leaves a thin trail that fades a moment later. One instanced additive draw.
 */
export class Tracers {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly start: THREE.InstancedBufferAttribute;
  private readonly end: THREE.InstancedBufferAttribute;
  private readonly shape: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  private list: Tracer[] = [];
  private rounds = 0;
  /** Which gun fired from a muzzle position, when the caller does not say. */
  weaponAt: ((from: THREE.Vector3) => WeaponId | null) | null = null;
  /** Every shot as it is added (`small`: a pellet), for what it passes through on the way. */
  onAdd: ((from: THREE.Vector3, to: THREE.Vector3, small: boolean) => void) | null = null;

  constructor() {
    const base = new THREE.PlaneGeometry(1, 1);
    base.translate(0.5, 0, 0);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.setAttribute('uv', base.getAttribute('uv'));
    const attribute = (name: string, size = 3) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(MAX * size), size);
      geometry.setAttribute(name, a);
      return a;
    };
    this.start = attribute('aStart');
    this.end = attribute('aEnd');
    this.shape = attribute('aShape', 4);
    this.tint = attribute('aTint');
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'tracers';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    // The occlusion pass's swapped-in material can't place the ribbons; it would draw them at the origin.
    this.mesh.onBeforeRender = (_r, scene, _c, g) => g.setDrawRange(0, scene.overrideMaterial ? 0 : Infinity);
  }

  /** From the on-screen muzzle to the impact; `streak` is the length of the bright head in meters. A known gun sets colour, width and streak. */
  add(from: THREE.Vector3, to: THREE.Vector3, options: { weapon?: WeaponId; color?: THREE.ColorRepresentation; speed?: number; streak?: number; width?: number } = {}) {
    const dir = to.clone().sub(from);
    const length = dir.length();
    if (length < 0.5) return;
    if (this.list.length >= MAX) this.list.shift();
    const id = options.weapon ?? this.weaponAt?.(from) ?? null;
    const style = id ? TRACER[id] : null;
    // Pellets keep the caller's shorter streak.
    const streak = style && (options.streak ?? 9) > 2.5 ? style.streak : options.streak;
    const width = style?.width ?? options.width ?? 0.035;
    this.onAdd?.(from, to, width < 0.03);
    // Pellets are too many and too short to carry tracer rounds.
    const tracer = width >= 0.03 && this.rounds++ % TRACER_EVERY === 0;
    this.list.push({
      start: from.clone(),
      dir: dir.divideScalar(length),
      length,
      traveled: 0,
      speed: options.speed ?? 320,
      streak: (streak ?? 4.5) * (tracer ? 1.6 : 1),
      width: width * (tracer ? 5 : 3.4),
      color: new THREE.Color(style?.color ?? options.color ?? '#ffd27a'),
      linger: tracer ? TRACER_LINGER : LINGER,
      maxLinger: tracer ? TRACER_LINGER : LINGER,
      trail: tracer ? 0.85 : 0.45
    });
  }

  update(dt: number) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i]!;
      if (t.traveled >= t.length) t.linger -= dt;
      else t.traveled = Math.min(t.length, t.traveled + t.speed * dt);
      if (t.linger <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const s = t.start;
      this.start.setXYZ(n, s.x, s.y, s.z);
      this.end.setXYZ(n, s.x + t.dir.x * t.traveled, s.y + t.dir.y * t.traveled, s.z + t.dir.z * t.traveled);
      // A tracer round holds full strength a moment after landing, then fades.
      const fade = Math.min(1, (t.linger / t.maxLinger) * (t.trail > 0.5 ? 1.6 : 1));
      this.shape.setXYZW(n, t.width, Math.min(1, t.streak / Math.max(t.traveled, 0.01)), fade * fade, t.trail);
      this.tint.setXYZ(n, t.color.r, t.color.g, t.color.b);
      n++;
    }
    this.mesh.geometry.instanceCount = n;
    this.start.needsUpdate = true;
    this.end.needsUpdate = true;
    this.shape.needsUpdate = true;
    this.tint.needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.mesh.geometry.instanceCount = 0;
  }
}
