import * as THREE from 'three';
import type { PlanCollider } from './util';

const MARGIN = 0.45;
const STRENGTH = 0.5;
const LIFT = 0.012;

/**
 * Soft dark footprints under everything that stands on a surface, nudged away from the sun and clipped to the
 * surface's top: the shadow-map-free tier's stand-in for contact shadows and ambient occlusion. One multiply-blended
 * mesh per map.
 */
export function contactShadows(colliders: PlanCollider[], sun: THREE.Vector3) {
  const flat = Math.hypot(sun.x, sun.z) || 1;
  const [dx, dz] = [-sun.x / flat, -sun.z / flat];
  const pos: number[] = [];
  const shade: number[] = [];
  const index: number[] = [];
  for (const c of colliders) {
    const h = c.max[1] - c.min[1];
    const area = (c.max[0] - c.min[0]) * (c.max[2] - c.min[2]);
    if (h < 0.3 || area > 2000) continue;
    const support = supportOf(c, colliders);
    if (!support) continue;
    const off = Math.min(1.2, h * 0.5);
    const x0 = Math.min(c.min[0], c.min[0] + dx * off);
    const x1 = Math.max(c.max[0], c.max[0] + dx * off);
    const z0 = Math.min(c.min[2], c.min[2] + dz * off);
    const z1 = Math.max(c.max[2], c.max[2] + dz * off);
    const clampX = (x: number) => Math.min(support.max[0], Math.max(support.min[0], x));
    const clampZ = (z: number) => Math.min(support.max[2], Math.max(support.min[2], z));
    const xs = [x0 - MARGIN, x0, x1, x1 + MARGIN].map(clampX);
    const zs = [z0 - MARGIN, z0, z1, z1 + MARGIN].map(clampZ);
    const y = support.max[1] + LIFT;
    const base = pos.length / 3;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        pos.push(xs[i]!, y, zs[j]!);
        const k = i > 0 && i < 3 && j > 0 && j < 3 ? STRENGTH : 0;
        shade.push(1 - k, 1 - k, 1 - k);
      }
    }
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        const a = base + j * 4 + i;
        index.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
      }
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  // The output multiplies the framebuffer as is: no colour-space encode, and fog fades it to "no change".
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', '').replace(
      '#include <fog_fragment>',
      `#ifdef USE_FOG
  gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( 1.0 ), smoothstep( fogNear, fogFar, vFogDepth ) );
#endif`
    );
  };
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'contact-shadows';
  mesh.renderOrder = 1;
  return mesh;
}

/** The widest collider whose top the box stands on. */
function supportOf(c: PlanCollider, all: PlanCollider[]) {
  let best: PlanCollider | null = null;
  let bestArea = 0;
  for (const s of all) {
    if (s === c || Math.abs(s.max[1] - c.min[1]) > 0.08) continue;
    if (s.min[0] >= c.max[0] || s.max[0] <= c.min[0] || s.min[2] >= c.max[2] || s.max[2] <= c.min[2]) continue;
    const area = (s.max[0] - s.min[0]) * (s.max[2] - s.min[2]);
    if (area > bestArea) {
      best = s;
      bestArea = area;
    }
  }
  return best;
}
