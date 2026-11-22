import * as THREE from 'three';
import type { AoMask } from './ao-mask';
import { noiseTexture } from './noise';

export type SpriteShape = 'soft' | 'star' | 'ring' | 'spark' | 'smoke' | 'fire' | 'flare' | 'tongue';
/**
 * Additive light, alpha-blended haze, or `billow`: premultiplied and sorted back to front, so fire can glow
 * and cover at once and smoke hides what is behind it.
 */
export type SpriteMode = 'additive' | 'alpha' | 'billow';

interface Sprite {
  slot: number;
  p: THREE.Vector3;
  v: THREE.Vector3;
  size: number;
  grow: number;
  rot: number;
  spin: number;
  color: THREE.Color;
  alpha: number;
  life: number;
  maxLife: number;
  drag: number;
  gravity: number;
  shape: number;
  delay: number;
  seed: number;
  depth: number;
}

const lin = (hex: string) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

const VERTEX = /* glsl */ `
attribute vec4 aPosSize;
attribute vec4 aColor;
attribute vec4 aMisc;
varying vec2 vLocal;
varying vec2 vScreen;
varying vec4 vColor;
varying vec3 vMisc;
void main() {
  float c = cos(aMisc.x), s = sin(aMisc.x);
  vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  vec4 center = viewMatrix * vec4(aPosSize.xyz, 1.0);
  float dist = max(-center.z, 1e-3);
  // Slide the sprite toward the camera (shrunk to keep its size on screen) so a big one doesn't slice into floors and walls.
  float pull = min(aPosSize.w * 0.45, max(dist - 0.3, 0.0) * 0.5);
  float k = (dist - pull) / dist;
  vec4 view = vec4(center.xyz * k + vec3(q * aPosSize.w * k, 0.0), 1.0);
  vLocal = position.xy * 2.0;
  vScreen = q * 2.0;
  vColor = aColor;
  vMisc = aMisc.yzw;
  // Smoke thins out as it reaches the camera, so a blast next to the player doesn't wall off the screen.
  if (aMisc.y > 3.5 && aMisc.y < 4.5) vColor.a *= mix(0.25, 1.0, smoothstep(0.3, 2.6, dist - aPosSize.w * 0.5));
  gl_Position = projectionMatrix * view;
}`;

const FRAGMENT = /* glsl */ `
uniform float uMode;
uniform sampler2D uNoise;
varying vec2 vLocal;
varying vec2 vScreen;
varying vec4 vColor;
varying vec3 vMisc;
void main() {
  float shape = vMisc.x;
  float age = vMisc.y;
  vec2 d = vLocal;
  float r = length(d);
  vec3 col = vColor.rgb;
  float a;
  float cover = 1.0;
  if (shape < 0.5) {
    a = smoothstep(1.0, 0.0, r);
    a *= a;
  } else if (shape < 1.5) {
    float ang = atan(d.y, d.x);
    float petals = 0.55 + 0.45 * cos(ang * 5.0);
    a = smoothstep(petals, 0.0, r) + smoothstep(0.35, 0.0, r);
  } else if (shape < 2.5) {
    a = smoothstep(0.12, 0.0, abs(r - 0.8));
  } else if (shape < 3.5) {
    a = smoothstep(1.0, 0.0, abs(d.x)) * smoothstep(0.25, 0.0, abs(d.y));
  } else if (shape > 5.5) {
    if (shape < 6.5) {
      // Muzzle star: four long thin spikes on the local axes, four short ones between, a hot core; crisp edges.
      float ang = atan(d.y, d.x);
      float c4 = abs(cos(ang * 2.0));
      float reach = max(pow(c4, 14.0), 0.42 * pow(1.0 - c4, 8.0)) * 0.92 + 0.16;
      // The spike pointing back along the barrel (local -x) stays short so it never crosses the shooter's face.
      reach *= 1.0 - 0.72 * smoothstep(0.2, -0.6, cos(ang));
      // The spikes across the barrel stay shorter too: over a face they read as a scratch.
      reach *= 1.0 - 0.35 * pow(abs(sin(ang)), 10.0);
      a = smoothstep(reach, reach * 0.72, r);
      col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.34, 0.08, r));
    } else {
      // Flame tongue along local +x: wide and white at the muzzle end (-x), tapering to a point.
      float u = d.x * 0.5 + 0.5;
      float w = 0.34 * pow(max(1.0 - u, 0.0), 0.65) * smoothstep(0.0, 0.1, u) + 0.002;
      a = smoothstep(w, w * 0.45, abs(d.y)) * smoothstep(1.0, 0.9, u);
      col = mix(col, vec3(1.0, 0.96, 0.86), smoothstep(0.5, 0.05, u) * 0.85);
    }
  } else {
    // Billows: a ragged soft silhouette from two scrolling noise layers; the noise turns with the sprite, the light doesn't.
    vec2 nuv = d * 0.3 + vMisc.z * vec2(7.13, 3.71);
    float n = texture2D(uNoise, nuv + vec2(0.0, age * 0.16)).r * 0.6 + texture2D(uNoise, nuv * 2.3 + vec2(age * 0.1, 0.37)).g * 0.4;
    vec2 sd = vScreen;
    float sr = length(sd);
    float edge = sr + (n - 0.5) * 0.75;
    if (shape < 4.5) {
      a = smoothstep(1.0, 0.4, edge);
      // As it ages it tears into holes where the noise is thin, and clears from the inside out.
      float thin = smoothstep(0.2, 1.0, age) * 0.8;
      float n2 = texture2D(uNoise, nuv * 1.7 + vec2(0.53, age * 0.05)).b;
      a *= smoothstep(thin - 0.14, thin + 0.14, n2 * 0.7 + n * 0.3 + (1.0 - sr) * 0.12);
      float body = sqrt(max(0.0, 1.0 - sr * sr));
      // Sun-lit tops and a darker core where it is thick; no lighter rim, which outlines every puff as a disc.
      float light = 0.64 + 0.55 * sd.y + 0.18 * body + (n - 0.5) * 0.7 - 0.14 * body * smoothstep(0.2, -0.5, sd.y);
      col *= clamp(light, 0.3, 1.45);
      // Lit from below by the fire for its first moments.
      float ember = (1.0 - smoothstep(0.0, 0.12, age)) * smoothstep(0.3, -0.9, sd.y);
      col = mix(col, ${lin('#ff8a3a')}, ember * 0.4);
    } else {
      // Fire: each billow is shaded as a lump lit from above, in flat toon bands (white-hot, yellow, orange, deep
      // red, then soot as it cools), so the cluster reads as one solid fireball that hides what is behind it.
      // Crisp while it burns; as it cools to soot the edge softens and it tears apart on the noise instead of fading
      // as a whole, which would leave see-through discs stacked in the smoke.
      float cool = smoothstep(0.35, 0.8, age);
      a = smoothstep(1.0, mix(0.9, 0.45, cool), edge);
      float tear = smoothstep(0.55, 1.0, age) * 1.05;
      a *= smoothstep(tear - 0.12, tear + 0.12, n * 0.75 + (1.0 - sr) * 0.3);
      float body = sqrt(max(0.0, 1.0 - sr * sr));
      float lit = dot(vec3(sd * 0.9, body), vec3(-0.36, 0.74, 0.57));
      float n1 = texture2D(uNoise, nuv + vec2(0.0, age * 0.16)).r;
      float heat = 1.22 - sr * 0.7 - age * 1.3 + (n1 - 0.5) * 0.7 + 0.3 * lit;
      col = mix(${lin('#4d4642')}, ${lin('#6f6761')}, step(0.5, lit));
      col = mix(col, ${lin('#a8240c')}, smoothstep(0.1, 0.13, heat));
      col = mix(col, ${lin('#ff6a12')}, smoothstep(0.3, 0.33, heat));
      col = mix(col, ${lin('#ffbf2e')}, smoothstep(0.52, 0.55, heat));
      col = mix(col, ${lin('#fff7e2')}, smoothstep(0.76, 0.79, heat));
      // A darker lip where one lump turns away, so lumps in front stand off the ones behind.
      col *= 1.0 - 0.2 * smoothstep(0.72, 0.92, edge);
      col *= vColor.rgb;
    }
  }
  a *= vColor.a;
  if (a < 0.004) discard;
  if (uMode < 0.5) {
    gl_FragColor = vec4(col * a, 1.0);
    #include <colorspace_fragment>
  } else if (uMode < 1.5) {
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  } else {
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb * a, a * cover);
  }
}`;

const SHAPES: Record<SpriteShape, number> = { soft: 0, star: 1, ring: 2, spark: 3, smoke: 4, fire: 5, flare: 6, tongue: 7 };
const MODES: Record<SpriteMode, number> = { additive: 0, alpha: 1, billow: 2 };
const eye = new THREE.Vector3();
const ahead = new THREE.Vector3();
const byDepth = (a: Sprite, b: Sprite) => b.depth - a.depth;

/** Camera-facing particles in one instanced draw: flashes and sparks, haze, or fire and smoke billows. */
export class SpritePool {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private sprites: Sprite[] = [];
  private free: number[] = [];
  private posSize: THREE.InstancedBufferAttribute;
  private color: THREE.InstancedBufferAttribute;
  private misc: THREE.InstancedBufferAttribute;
  private readonly sorted: boolean;
  /** Where thick smoke and fire are written for the ambient-occlusion pass (billows on tiers that have it). */
  mask: AoMask | null = null;

  constructor(mode: SpriteMode, private readonly capacity = 256) {
    const geometry = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geometry.index = base.index;
    geometry.setAttribute('position', base.getAttribute('position'));
    this.posSize = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.misc = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    geometry.setAttribute('aPosSize', this.posSize);
    geometry.setAttribute('aColor', this.color);
    geometry.setAttribute('aMisc', this.misc);
    this.sorted = mode === 'billow';
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uMode: { value: MODES[mode] }, uNoise: { value: noiseTexture() } },
      transparent: true,
      depthWrite: false,
      blending: mode === 'additive' ? THREE.AdditiveBlending : mode === 'alpha' ? THREE.NormalBlending : THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      toneMapped: false
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = mode === 'additive' ? 6 : mode === 'billow' ? 3 : 4;
    // A pass that swaps every material (the occlusion pass) can't place the instances: it would draw them all as
    // one square at the origin, so it draws none.
    this.mesh.onBeforeRender = (_r, scene, _c, g) => g.setDrawRange(0, scene.overrideMaterial ? 0 : Infinity);
    geometry.instanceCount = 0;
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
  }

  emit(options: {
    position: THREE.Vector3;
    velocity?: THREE.Vector3;
    size: number;
    grow?: number;
    color: THREE.ColorRepresentation;
    alpha?: number;
    life: number;
    shape?: SpriteShape;
    spin?: number;
    drag?: number;
    gravity?: number;
    /** Fixed rotation in radians instead of a random one. */
    rotation?: number;
    /** Seconds before it appears. */
    delay?: number;
  }) {
    let slot = this.free.pop();
    if (slot === undefined) slot = this.sprites.shift()!.slot;
    this.sprites.push({
      slot,
      p: options.position.clone(),
      v: options.velocity?.clone() ?? new THREE.Vector3(),
      size: options.size,
      grow: options.grow ?? 0,
      rot: options.rotation ?? Math.random() * Math.PI * 2,
      spin: options.spin ?? 0,
      color: new THREE.Color(options.color),
      alpha: options.alpha ?? 1,
      life: options.life,
      maxLife: options.life,
      drag: options.drag ?? 0,
      gravity: options.gravity ?? 0,
      shape: SHAPES[options.shape ?? 'soft'],
      delay: options.delay ?? 0,
      seed: Math.random(),
      depth: 0
    });
  }

  update(dt: number, camera: THREE.Camera) {
    camera.getWorldPosition(eye);
    camera.getWorldDirection(ahead);
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i]!;
      if (s.delay > 0) {
        s.delay -= dt;
        continue;
      }
      s.life -= dt;
      if (s.life <= 0) {
        this.free.push(s.slot);
        this.sprites.splice(i, 1);
        continue;
      }
      s.v.y -= s.gravity * dt;
      s.v.multiplyScalar(Math.exp(-s.drag * dt));
      s.p.addScaledVector(s.v, dt);
      s.size += s.grow * dt;
      s.rot += s.spin * dt;
      s.depth = (s.p.x - eye.x) * ahead.x + (s.p.y - eye.y) * ahead.y + (s.p.z - eye.z) * ahead.z;
    }
    const list = this.sorted ? [...this.sprites].sort(byDepth) : this.sprites;
    let n = 0;
    this.mask?.begin(camera);
    for (const s of list) {
      if (s.delay > 0) continue;
      const age = 1 - s.life / s.maxLife;
      const alpha = s.alpha * envelope(s.shape, age);
      this.mask?.add(s.p, s.size, alpha);
      this.posSize.setXYZW(n, s.p.x, s.p.y, s.p.z, s.size);
      this.color.setXYZW(n, s.color.r, s.color.g, s.color.b, alpha);
      this.misc.setXYZW(n, s.rot, s.shape, age, s.seed);
      n++;
    }
    this.mesh.geometry.instanceCount = n;
    this.mask?.end();
    this.posSize.needsUpdate = true;
    this.color.needsUpdate = true;
    this.misc.needsUpdate = true;
  }

  clear() {
    for (const s of this.sprites) this.free.push(s.slot);
    this.sprites = [];
    this.mesh.geometry.instanceCount = 0;
  }
}

/** Opacity over a sprite's life: smoke swells in and thins away, fire burns down to soot (and tears apart in the shader), the rest fade at the end. */
function envelope(shape: number, age: number) {
  if (shape === SHAPES.smoke) return THREE.MathUtils.smoothstep(age, 0, 0.08) * (1 - THREE.MathUtils.smoothstep(age, 0.3, 1));
  if (shape === SHAPES.fire) return 1 - THREE.MathUtils.smoothstep(age, 0.88, 1);
  return Math.min(1, (1 - age) * 2.2);
}
