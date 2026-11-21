import * as THREE from 'three';
import { ballGeo, coneGeo, mergeAll } from './geo';
import type { Vec3 } from './util';

export interface Flame {
  pos: Vec3;
  /** The wall behind the flame (its face looks along local +z turned by `yaw`), washed with warm light. */
  wall?: { at: Vec3; yaw: number };
}

type Own = <T extends { dispose(): void }>(x: T) => T;

let glowTexture: THREE.Texture | null = null;
function glow() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

const flicker = (t: number, i: number) => 0.78 + 0.13 * Math.sin(t * 9.3 + i * 2.1) + 0.09 * Math.sin(t * 23.7 + i * 5.3);

/**
 * Torch fire: an orange tongue with a white-hot core that sways and flickers, a halo around it and a pool of warm
 * light on the wall behind, all pulsing together. Three to four instanced draws for every torch on the map.
 */
export function buildFlames(flames: Flame[], root: THREE.Group, own: Own): (dt: number, t: number) => void {
  const n = flames.length;
  const shape = own(mergeAll([coneGeo(0.09, 0, 0.34, 8).clone().translate(0, 0.02, 0), ballGeo(0.085, 0).clone().translate(0, 0.07, 0)]));
  // Additive fire washes out to white over the pale castle stone, so the tongue is painted and only the core adds light.
  const outer = new THREE.InstancedMesh(shape, own(new THREE.MeshBasicMaterial({ color: '#ff6414', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })), n);
  const core = new THREE.InstancedMesh(shape, own(new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })), n);
  outer.frustumCulled = core.frustumCulled = false;
  core.renderOrder = 1;
  root.add(outer, core);

  const halo = own(new THREE.BufferGeometry());
  const haloPos = new Float32Array(n * 3);
  const haloCol = new Float32Array(n * 3);
  flames.forEach((f, i) => haloPos.set([f.pos[0], f.pos[1] + 0.14, f.pos[2]], i * 3));
  halo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  halo.setAttribute('color', new THREE.BufferAttribute(haloCol, 3));
  const haloMat = own(new THREE.PointsMaterial({ size: 1.5, map: glow(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const points = new THREE.Points(halo, haloMat);
  points.frustumCulled = false;
  root.add(points);

  const walls = flames.filter((f) => f.wall);
  const wash = walls.length
    ? new THREE.InstancedMesh(own(new THREE.PlaneGeometry(1.7, 2.1)), own(new THREE.MeshBasicMaterial({ map: glow(), color: '#ff8c3a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 })), walls.length)
    : null;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  if (wash) {
    wash.frustumCulled = false;
    walls.forEach((f, i) => wash.setMatrixAt(i, m.compose(v.set(...f.wall!.at), q.setFromEuler(e.set(0, f.wall!.yaw, 0)), s.set(1, 1, 1))));
    root.add(wash);
  }

  return (_dt, t) => {
    let w = 0;
    flames.forEach((f, i) => {
      const k = flicker(t, i);
      q.setFromEuler(e.set(Math.sin(t * 6.1 + i * 1.3) * 0.13, 0, Math.sin(t * 7.7 + i * 2.9) * 0.13));
      outer.setMatrixAt(i, m.compose(v.set(...f.pos), q, s.set(1 / k, k * 1.12, 1 / k)));
      core.setMatrixAt(i, m.compose(v.set(f.pos[0], f.pos[1] - 0.03, f.pos[2]), q, s.set(0.55 / k, k * 0.7, 0.55 / k)));
      c.setRGB(1, 0.55, 0.22).multiplyScalar(0.55 * k);
      haloCol.set([c.r, c.g, c.b], i * 3);
      if (f.wall) wash!.setColorAt(w++, c.setScalar(0.4 + 0.4 * k));
    });
    outer.instanceMatrix.needsUpdate = core.instanceMatrix.needsUpdate = true;
    halo.getAttribute('color').needsUpdate = true;
    if (wash?.instanceColor) wash.instanceColor.needsUpdate = true;
  };
}
