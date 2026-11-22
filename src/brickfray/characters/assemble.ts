import * as THREE from 'three';
import type { Kit } from '../engine/kit';
import { pieceMaterial } from './material';
import type { BakedCharacter } from './parts';

/** Seconds from the first piece leaving to the last one clicking home. */
export const ASSEMBLE_TIME = 0.55;
/** Each piece's own flight; the rest of the time staggers them from the feet up. */
const FLIGHT = 0.26;

interface Piece {
  mesh: THREE.Mesh;
  bone: number;
  center: THREE.Vector3;
  /** Where it starts from its seat, in root space, and how it starts turned. */
  from: THREE.Vector3;
  spin: THREE.Quaternion;
  delay: number;
}

const m = new THREE.Matrix4();
const inv = new THREE.Matrix4();
const at = new THREE.Matrix4();
const p = new THREE.Vector3();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();
const axis = new THREE.Vector3();
const turn = new THREE.Quaternion();

/**
 * A respawn as the figure snapping together: its own shatter pieces fly in from around it, from the feet up,
 * turning into place and growing to size, each landing with a little overshoot; then the figure takes over. The
 * pieces share the shatter material and geometry, so nothing new compiles.
 */
export class Assembly {
  private pieces: Piece[] | null = null;
  private t = -1;
  private seed = 7;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly bones: readonly THREE.Bone[],
    private readonly baked: BakedCharacter,
    private readonly kit: Kit
  ) {}

  get active() {
    return this.t >= 0;
  }

  start(seed: number) {
    this.seed = 1 + (Math.abs(Math.floor(seed * 7919)) % 2147483646);
    this.pieces ??= this.baked.pieces.map((b) => {
      const mesh = new THREE.Mesh(b.geometry, b.glass ? this.kit.materials.vertexColored('glass') : pieceMaterial(this.kit.materials));
      mesh.name = 'assemble';
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      return { mesh, bone: b.bone, center: b.center, from: new THREE.Vector3(), spin: new THREE.Quaternion(), delay: 0 };
    });
    this.root.updateMatrixWorld(true);
    inv.copy(this.root.matrixWorld).invert();
    for (const piece of this.pieces) {
      this.seat(piece, at);
      p.setFromMatrixPosition(at);
      // Out from the body's axis and up, a little more for the parts high on the figure.
      const out = Math.hypot(p.x, p.z) > 1e-3 ? Math.atan2(p.x, p.z) : this.rand() * Math.PI * 2;
      const heading = out + (this.rand() - 0.5) * 1.6;
      const reach = 0.45 + this.rand() * 0.45;
      piece.from.set(Math.sin(heading) * reach, 0.25 + this.rand() * 0.55 + p.y * 0.2, Math.cos(heading) * reach);
      piece.spin.setFromAxisAngle(axis.set(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5).normalize(), 1 + this.rand() * 2);
      piece.delay = THREE.MathUtils.clamp(p.y / 2, 0, 1) * (ASSEMBLE_TIME - FLIGHT) * (0.8 + 0.2 * this.rand());
      piece.mesh.visible = false;
      this.root.add(piece.mesh);
    }
    this.t = 0;
  }

  /** Moves the pieces along; false once the figure is whole again. */
  update(dt: number) {
    if (this.t < 0 || !this.pieces) return false;
    this.t += dt;
    if (this.t >= ASSEMBLE_TIME) {
      this.stop();
      return false;
    }
    inv.copy(this.root.matrixWorld).invert();
    for (const piece of this.pieces) {
      const k = THREE.MathUtils.clamp((this.t - piece.delay) / FLIGHT, 0, 1);
      piece.mesh.visible = k > 0;
      if (k <= 0) continue;
      // Ease out with a small overshoot past the seat, so each piece lands with a click.
      const e = 1 - (1 - k) ** 3;
      const snap = 1 + 0.1 * Math.sin(Math.PI * THREE.MathUtils.smoothstep(k, 0.7, 1));
      this.seat(piece, at);
      at.decompose(p, q, s);
      p.addScaledVector(piece.from, 1 - e);
      q.multiply(turn.identity().slerp(piece.spin, 1 - e));
      s.multiplyScalar((0.35 + 0.65 * e) * snap);
      piece.mesh.matrix.compose(p, q, s);
    }
    return true;
  }

  stop() {
    this.t = -1;
    for (const piece of this.pieces ?? []) this.root.remove(piece.mesh);
  }

  /** The piece's seat on its bone, in root space. */
  private seat(piece: Piece, out: THREE.Matrix4) {
    return out.multiplyMatrices(inv, this.bones[piece.bone]!.matrixWorld).multiply(m.makeTranslation(piece.center));
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}
