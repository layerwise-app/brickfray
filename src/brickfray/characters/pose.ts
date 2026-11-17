import * as THREE from 'three';
import { BONE, BONES, PARENT, type BoneName, type V3 } from './skeleton';

const PARENT_INDEX = BONES.map((name) => {
  const p = PARENT[name];
  return p ? BONE[p] : -1;
});

const tmpQ = new THREE.Quaternion();

/**
 * Local bone transforms plus their model-space (body-group) results. The
 * animator writes locals top-down and asks for model transforms as it goes,
 * so IK can work in one space without touching three.js world matrices.
 */
export class Pose {
  readonly q: THREE.Quaternion[] = BONES.map(() => new THREE.Quaternion());
  readonly p: THREE.Vector3[];
  readonly s: number[] = BONES.map(() => 1);
  readonly mq: THREE.Quaternion[] = BONES.map(() => new THREE.Quaternion());
  readonly mp: THREE.Vector3[] = BONES.map(() => new THREE.Vector3());

  constructor(readonly rest: V3[]) {
    this.p = rest.map((o) => new THREE.Vector3(o[0], o[1], o[2]));
  }

  reset() {
    BONES.forEach((_, i) => {
      this.q[i]!.identity();
      const o = this.rest[i]!;
      this.p[i]!.set(o[0], o[1], o[2]);
      this.s[i] = 1;
    });
  }

  /** Model transform of bone i from its parent's (which must be current). */
  solve(i: number) {
    const parent = PARENT_INDEX[i]!;
    if (parent < 0) {
      this.mq[i]!.copy(this.q[i]!);
      this.mp[i]!.copy(this.p[i]!);
      return;
    }
    const pq = this.mq[parent]!;
    this.mq[i]!.multiplyQuaternions(pq, this.q[i]!);
    this.mp[i]!.copy(this.p[i]!).multiplyScalar(this.s[parent]!).applyQuaternion(pq).add(this.mp[parent]!);
  }

  solveChain(...names: BoneName[]) {
    for (const n of names) this.solve(BONE[n]);
  }

  /** Set bone i's local rotation so its model rotation becomes `target` (parent must be solved). */
  setModelRotation(i: number, target: THREE.Quaternion) {
    const parent = PARENT_INDEX[i]!;
    if (parent < 0) this.q[i]!.copy(target);
    else this.q[i]!.copy(tmpQ.copy(this.mq[parent]!).invert().multiply(target));
    this.solve(i);
  }

  /** Model point from a point in bone i's local space. */
  toModel(i: number, local: THREE.Vector3, out: THREE.Vector3) {
    return out.copy(local).applyQuaternion(this.mq[i]!).add(this.mp[i]!);
  }

  apply(bones: THREE.Bone[]) {
    BONES.forEach((_, i) => {
      const b = bones[i]!;
      b.quaternion.copy(this.q[i]!);
      b.position.copy(this.p[i]!);
      b.scale.setScalar(this.s[i]!);
    });
  }
}
