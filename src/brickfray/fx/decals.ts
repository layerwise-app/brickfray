import * as THREE from 'three';

/** Small dark dents where bullets hit scenery; a fixed ring buffer of instances. */
export class Decals {
  readonly mesh: THREE.InstancedMesh;
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private z = new THREE.Vector3(0, 0, 1);

  constructor(capacity: number) {
    const geometry = new THREE.CircleGeometry(0.5, 10);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(10,10,12,0.95)');
    grad.addColorStop(0.35, 'rgba(25,25,30,0.85)');
    grad.addColorStop(0.55, 'rgba(60,60,70,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
  }

  add(point: THREE.Vector3, normal: THREE.Vector3, size = 0.07) {
    this.q.setFromUnitVectors(this.z, normal);
    const spin = new THREE.Quaternion().setFromAxisAngle(this.z, Math.random() * Math.PI * 2);
    this.q.multiply(spin);
    const s = size * (0.8 + Math.random() * 0.4);
    this.m.compose(point.clone().addScaledVector(normal, 0.004), this.q, this.s.set(s, s, s));
    this.mesh.setMatrixAt(this.next, this.m);
    this.next = (this.next + 1) % this.mesh.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.mesh.count; i++) this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
