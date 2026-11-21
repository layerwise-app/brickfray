import * as THREE from 'three';

const CAPACITY = 8;

const VERTEX = /* glsl */ `
attribute vec4 aLook;
varying vec2 vUv;
varying vec4 vLook;
void main() {
  vUv = uv;
  vLook = aLook;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec4 vLook;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  // vLook.w picks the shape: a thin ring racing outward, or a pool of light on the floor.
  float ring = smoothstep(0.62, 0.9, r) * smoothstep(1.0, 0.94, r);
  float pool = smoothstep(1.0, 0.0, r);
  float a = mix(ring, pool * pool * pool, vLook.w);
  gl_FragColor = vec4(vLook.rgb * a, 1.0);
  #include <colorspace_fragment>
}`;

interface Wave {
  position: THREE.Vector3;
  from: number;
  to: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
  pool: boolean;
}

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();

/** Blast marks that lie on the floor: the shockwave ring and the flash of light around an explosion. */
export class Shockwaves {
  readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly look: THREE.InstancedBufferAttribute;
  private waves: Wave[] = [];

  constructor() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.rotateX(-Math.PI / 2);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
    geometry.setAttribute('aLook', this.look);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
    this.mesh.name = 'shockwaves';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.count = 0;
  }

  /** A flat disc at `position` growing from radius `from` to `to` over `life` seconds while it fades. */
  add(position: THREE.Vector3, from: number, to: number, life: number, color: THREE.ColorRepresentation, pool = false) {
    if (this.waves.length >= CAPACITY) this.waves.shift();
    this.waves.push({ position: position.clone(), from, to, life, maxLife: life, color: new THREE.Color(color), pool });
  }

  update(dt: number) {
    let n = 0;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      w.life -= dt;
      if (w.life <= 0) {
        this.waves.splice(i, 1);
        continue;
      }
      const t = 1 - w.life / w.maxLife;
      const radius = w.from + (w.to - w.from) * (1 - (1 - t) * (1 - t));
      const fade = (1 - t) * (1 - t);
      m.compose(w.position, q, s.set(radius, 1, radius));
      this.mesh.setMatrixAt(n, m);
      this.look.setXYZW(n, w.color.r * fade, w.color.g * fade, w.color.b * fade, w.pool ? 1 : 0);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.look.needsUpdate = true;
  }

  clear() {
    this.waves = [];
    this.mesh.count = 0;
  }
}
