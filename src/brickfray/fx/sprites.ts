import * as THREE from 'three';

export type SpriteShape = 'soft' | 'star' | 'ring' | 'spark';

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
}

const VERTEX = /* glsl */ `
attribute vec4 aPosSize;
attribute vec4 aColor;
attribute vec2 aRotShape;
uniform vec3 uRight;
uniform vec3 uUp;
varying vec2 vUv;
varying vec4 vColor;
varying float vShape;
void main() {
  float c = cos(aRotShape.x), s = sin(aRotShape.x);
  vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  vec3 world = aPosSize.xyz + (uRight * q.x + uUp * q.y) * aPosSize.w;
  vUv = uv;
  vColor = aColor;
  vShape = aRotShape.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const FRAGMENT = /* glsl */ `
uniform float uAdditive;
varying vec2 vUv;
varying vec4 vColor;
varying float vShape;
void main() {
  vec2 d = vUv * 2.0 - 1.0;
  float r = length(d);
  float a;
  if (vShape < 0.5) {
    a = smoothstep(1.0, 0.0, r);
    a *= a;
  } else if (vShape < 1.5) {
    float ang = atan(d.y, d.x);
    float petals = 0.55 + 0.45 * cos(ang * 5.0);
    a = smoothstep(petals, 0.0, r) + smoothstep(0.35, 0.0, r);
  } else if (vShape < 2.5) {
    a = smoothstep(0.12, 0.0, abs(r - 0.8)) ;
  } else {
    a = smoothstep(1.0, 0.0, abs(d.x)) * smoothstep(0.25, 0.0, abs(d.y));
  }
  a *= vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = uAdditive > 0.5 ? vec4(vColor.rgb * a, 1.0) : vec4(vColor.rgb, a);
}`;

const SHAPES: Record<SpriteShape, number> = { soft: 0, star: 1, ring: 2, spark: 3 };

/**
 * Camera-facing particles in one instanced draw: muzzle flashes, sparks and
 * fire (additive) or smoke and dust (alpha) depending on the pool.
 */
export class SpritePool {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private sprites: Sprite[] = [];
  private free: number[] = [];
  private posSize: THREE.InstancedBufferAttribute;
  private color: THREE.InstancedBufferAttribute;
  private rotShape: THREE.InstancedBufferAttribute;
  private material: THREE.ShaderMaterial;

  constructor(additive: boolean, private readonly capacity = 256) {
    const geometry = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geometry.index = base.index;
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.setAttribute('uv', base.getAttribute('uv'));
    this.posSize = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.rotShape = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    geometry.setAttribute('aPosSize', this.posSize);
    geometry.setAttribute('aColor', this.color);
    geometry.setAttribute('aRotShape', this.rotShape);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uAdditive: { value: additive ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 4;
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
  }) {
    let slot = this.free.pop();
    if (slot === undefined) slot = this.sprites.shift()!.slot;
    this.sprites.push({
      slot,
      p: options.position.clone(),
      v: options.velocity?.clone() ?? new THREE.Vector3(),
      size: options.size,
      grow: options.grow ?? 0,
      rot: Math.random() * Math.PI * 2,
      spin: options.spin ?? 0,
      color: new THREE.Color(options.color),
      alpha: options.alpha ?? 1,
      life: options.life,
      maxLife: options.life,
      drag: options.drag ?? 0,
      gravity: options.gravity ?? 0,
      shape: SHAPES[options.shape ?? 'soft']
    });
  }

  update(dt: number, camera: THREE.Camera) {
    const e = camera.matrixWorld.elements;
    (this.material.uniforms.uRight!.value as THREE.Vector3).set(e[0]!, e[1]!, e[2]!);
    (this.material.uniforms.uUp!.value as THREE.Vector3).set(e[4]!, e[5]!, e[6]!);
    let n = 0;
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i]!;
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
      const t = s.life / s.maxLife;
      // Sprites are written densely (order doesn't matter for additive; smoke is soft enough).
      this.posSize.setXYZW(n, s.p.x, s.p.y, s.p.z, s.size);
      this.color.setXYZW(n, s.color.r, s.color.g, s.color.b, s.alpha * Math.min(1, t * 2.2));
      this.rotShape.setXY(n, s.rot, s.shape);
      n++;
    }
    this.mesh.geometry.instanceCount = n;
    this.posSize.needsUpdate = true;
    this.color.needsUpdate = true;
    this.rotShape.needsUpdate = true;
  }

  clear() {
    for (const s of this.sprites) this.free.push(s.slot);
    this.sprites = [];
    this.mesh.geometry.instanceCount = 0;
  }
}
