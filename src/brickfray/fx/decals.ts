import * as THREE from 'three';
import { drawDecalAtlas, DECAL_CELLS, DECAL_GRID, type DecalKind } from './decal-atlas';

export type { DecalKind } from './decal-atlas';

const VERTEX = /* glsl */ `
attribute vec3 aCell;
varying vec2 vUv;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
  vUv = (aCell.xy + uv) / vec2(${DECAL_GRID[0].toFixed(1)}, ${DECAL_GRID[1].toFixed(1)});
  vAlpha = aCell.z;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  vec4 texel = texture2D(map, vUv);
  gl_FragColor = vec4(texel.rgb, texel.a * vAlpha);
  if (gl_FragColor.a < 0.01) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/**
 * Marks left on scenery: chips, dents, cracks, splinters and scorch, one atlas and one instanced
 * draw. A fixed ring of instances, so the oldest mark makes room for the newest.
 */
export class Decals {
  readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly cell: THREE.InstancedBufferAttribute;
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private spin = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private z = new THREE.Vector3(0, 0, 1);
  private up = new THREE.Vector3();
  private y0 = new THREE.Vector3();

  constructor(capacity: number) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.cell = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    geometry.setAttribute('aCell', this.cell);
    const texture = new THREE.CanvasTexture(drawDecalAtlas());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
      fog: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      // Mirrored marks (negative x scale) turn their back face to the camera.
      side: THREE.DoubleSide
    });
    material.uniforms.map!.value = texture;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'decals';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.clear();
  }

  /**
   * `size` is the width of the mark in meters. Each mark gets its own turn, size (+-20%), slight stretch and
   * mirroring, so a burst never reads as one stamp; a dent's or stone chip's baked shading stays lit from above, so
   * on a wall it only leans.
   */
  add(kind: DecalKind, point: THREE.Vector3, normal: THREE.Vector3, size: number, alpha = 1) {
    const cells = DECAL_CELLS[kind];
    const cell = cells[Math.floor(Math.random() * cells.length)]!;
    this.q.setFromUnitVectors(this.z, normal);
    let turn = Math.random() * Math.PI * 2;
    if ((kind === 'dent' || kind === 'spall') && Math.abs(normal.y) < 0.9) {
      this.y0.set(0, 1, 0).applyQuaternion(this.q);
      this.up.set(0, 1, 0).addScaledVector(normal, -normal.y).normalize();
      turn = Math.atan2(normal.dot(this.y0.clone().cross(this.up)), this.y0.dot(this.up)) + (Math.random() - 0.5) * 0.6;
    }
    this.q.multiply(this.spin.setFromAxisAngle(this.z, turn));
    const s = size * (0.8 + Math.random() * 0.4);
    const stretch = 0.88 + Math.random() * 0.24;
    this.m.compose(this.p.copy(point).addScaledVector(normal, 0.004), this.q, this.s.set(s * stretch * (Math.random() < 0.5 ? -1 : 1), s / stretch, s));
    this.mesh.setMatrixAt(this.next, this.m);
    this.cell.setXYZ(this.next, cell[0], cell[1], alpha);
    this.next = (this.next + 1) % this.mesh.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.cell.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.mesh.count; i++) this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
