// Other people in the match. Each is drawn as a doodle figure in a team colour and eased between
// the snapshots its owner sends; it also exposes the same surface enemies and weapons expect of a
// target (body, center, eye, hit spheres, takeDamage) so the rest of the game does not care
// whether it is shooting at a bot or a friend.
import * as THREE from 'three';
import type { GameContext } from '../context';
import { makeInkMaterial, setFill, INK } from '../render/ink-renderer';
import type { InkId, InkMaterial } from '../render/ink-renderer';
import { buildHumanoid, buildWeaponProp } from './enemies';
import type { Face, HumanoidJoints, HumanoidPart, HumanoidParts, HumanoidSpec } from './enemies';
import { clamp, damp, angleLerp } from '../core/math';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Weapon prop drawn for each weapon index in a snapshot; the last one is the blade. */
const WEAPON_KINDS = ['rifle', 'shotgun', 'sniper', 'blade'] as const;

/** Body parts that carry a hit sphere, with each sphere's radius. */
const HIT: ReadonlyArray<readonly [part: HumanoidPart, radius: number]> = [
  ['head', 0.3],
  ['torso', 0.33],
  ['hips', 0.2],
  ['armL', 0.11],
  ['armR', 0.11],
  ['foreL', 0.1],
  ['foreR', 0.1],
  ['legL', 0.13],
  ['legR', 0.13],
  ['shinL', 0.11],
  ['shinR', 0.11],
];

/** Bits of the snapshot's state-flags field. */
const FLAG = {
  crouching: 1,
  sliding: 2,
  blocking: 4,
  aiming: 8,
  onGround: 16,
  firing: 32,
  alive: 64,
  grappling: 128,
  parryWindow: 256,
  idle: 512,
  untouched: 1024,
  away: 2048,
} as const;

/**
 * What a player broadcasts about itself, ~20 times a second: position, look, weapon index, state
 * flags (see FLAG), hp, velocity and, only while grappling, where the hook is. Positions are
 * rounded to 2 decimals, velocity and hook to 1, to keep the packet small.
 */
export type PlayerSnapshot = PoseSnapshot | [...PoseSnapshot, hookX: number, hookY: number, hookZ: number];

/** The part of a PlayerSnapshot that is always present. */
export type PoseSnapshot = [
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  weaponIndex: number,
  flags: number,
  hp: number,
  vx: number,
  vy: number,
  vz: number,
];

/** The parts of the local player that go into a snapshot. */
export interface SnapshotSource {
  body: { pos: THREE.Vector3; vel: THREE.Vector3; onGround: boolean };
  grapple: { state: string; hook: THREE.Vector3 } | null | undefined;
  yaw: number;
  pitch: number;
  crouching: boolean;
  sliding: boolean;
  readonly isBlocking: boolean;
  _aiming: boolean;
  alive: boolean;
  readonly parryWindow: boolean;
  hp: number;
}

/** Extra per-send state the player object does not carry itself. */
export interface SnapshotExtra {
  firing?: boolean;
  idle?: boolean;
  untouched?: boolean;
  away?: boolean;
}

/** Encodes the local player into the snapshot sent to peers (see PlayerSnapshot). */
export function encodeLocal(P: SnapshotSource, weaponIndex: number, extra: SnapshotExtra = {}): PlayerSnapshot {
  const b = P.body;
  const g = P.grapple;
  const grappling = g && g.state !== 'idle';
  const flags =
    (P.crouching ? FLAG.crouching : 0) |
    (P.sliding ? FLAG.sliding : 0) |
    (P.isBlocking ? FLAG.blocking : 0) |
    (P._aiming ? FLAG.aiming : 0) |
    (b.onGround ? FLAG.onGround : 0) |
    (extra.firing ? FLAG.firing : 0) |
    (P.alive ? FLAG.alive : 0) |
    (grappling ? FLAG.grappling : 0) |
    (P.parryWindow ? FLAG.parryWindow : 0) |
    (extra.idle ? FLAG.idle : 0) |
    (extra.untouched ? FLAG.untouched : 0) |
    (extra.away ? FLAG.away : 0);
  const pose: PoseSnapshot = [
    +b.pos.x.toFixed(2),
    +b.pos.y.toFixed(2),
    +b.pos.z.toFixed(2),
    +P.yaw.toFixed(2),
    +P.pitch.toFixed(2),
    weaponIndex,
    flags,
    Math.round(P.hp),
    +b.vel.x.toFixed(1),
    +b.vel.y.toFixed(1),
    +b.vel.z.toFixed(1),
  ];
  if (g && grappling) return [...pose, +g.hook.x.toFixed(1), +g.hook.y.toFixed(1), +g.hook.z.toFixed(1)];
  return pose;
}

/** One received pose, timestamped in seconds on the local clock. */
interface PoseSample {
  p: THREE.Vector3;
  yaw: number;
  pitch: number;
  t: number;
}

/** Called when something local damages this player; the game forwards it to the owner. */
export type RemoteDamageHandler = (target: RemotePlayer, amount: number, fromPos: THREE.Vector3 | null | undefined) => void;

/** Another player in an online match, drawn from the snapshots its owner sends. */
export class RemotePlayer {
  readonly isLocal = false;
  alive = true;
  parryWindow = false;
  idle = false;
  /** Local time (s) when this player last went idle; 0 if never. */
  idleSince = 0;
  untouched = false;
  away = false;
  hp = 100;
  readonly maxHp = 100;
  speed = 0;
  weaponIndex = 0;
  readonly body = {
    pos: new THREE.Vector3(0, -50, 0),
    vel: new THREE.Vector3(),
    halfW: 0.35,
    height: 1.75,
    onGround: true,
  };
  readonly center = new THREE.Vector3();
  readonly eye = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, -1);
  readonly right = new THREE.Vector3(1, 0, 0);
  yaw = 0;
  pitch = 0;
  crouching = false;
  sliding = false;
  blocking = false;
  aiming = false;
  firing = false;
  deadT = 0;
  kills = 0;
  deaths = 0;
  score = 0;
  /** Hit spheres as [part, radius]; positions are in hitSpheres at the same index. */
  readonly hit = HIT;
  readonly hitSpheres: THREE.Vector3[] = HIT.map(() => new THREE.Vector3());
  readonly vel = new THREE.Vector3();
  grappling = false;
  /** Where this player's grapple hook is, while grappling. */
  readonly gPoint = new THREE.Vector3();
  /** performance.now() of the last snapshot; set by the game. */
  lastSeen = 0;
  onDamage: RemoteDamageHandler | null = null;

  /** The drawn figure; null once it has been knocked off as a ragdoll until the player respawns. */
  root: THREE.Group | null = null;
  // the model fields below are assigned by buildModel(), which the constructor always calls
  parts!: HumanoidParts;
  J!: HumanoidJoints;
  face!: Face;
  private tagG!: THREE.Group;
  private corpse = false;

  private snapA: PoseSample | null = null;
  private snapB: PoseSample | null = null;
  private phase = 0;
  private walk = 0;
  private flashT = 0;
  private readonly mat: InkMaterial;
  private readonly solid: InkMaterial;
  private readonly T: HumanoidSpec;
  private readonly rope: THREE.Mesh;
  private readonly hook: THREE.Mesh;

  constructor(
    private readonly ctx: GameContext,
    readonly id: string,
    public name: string,
    public team: number,
    readonly ink: InkId,
  ) {
    this.name = name || 'doodle';
    this.mat = makeInkMaterial({ ink, shadeScale: 0, shadeBias: 1 });
    this.solid = makeInkMaterial({ ink: INK.BLACK, fill: true, side: THREE.DoubleSide });
    this.T = { weapon: 'rifle', scale: 1.0, hat: 'cap', build: { bodyW: 1, headS: 1, limbR: 0.033 } };
    this.buildModel();
    // the grapple rope: a thin line from the hand to wherever the hook is
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5), makeInkMaterial({ ink: INK.BLACK }));
    this.rope.visible = false;
    ctx.scene.add(this.rope);
    this.hook = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), makeInkMaterial({ ink: INK.BLACK, fill: true }));
    this.hook.visible = false;
    ctx.scene.add(this.hook);
  }

  private buildModel(): void {
    const model = buildHumanoid(this.mat, this.solid, this.T);
    this.root = model.root;
    this.parts = model.parts;
    this.J = model.J;
    this.face = model.face;
    this.root.visible = false;
    this.ctx.scene.add(this.root);
    this.weaponIndex = -1;
    // a name tag: a little flag above the head so you know who is who
    this.tagG = new THREE.Group();
    this.root.add(this.tagG);
    this.tagG.position.y = 2.25;
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.28, 0.02),
      makeInkMaterial({ ink: this.ink, fill: true, side: THREE.DoubleSide }),
    );
    this.tagG.add(flag);
    this.corpse = false;
  }

  /**
   * Knocked flat with some physics: the whole figure tumbles away as debris (bits come off on a
   * big hit, `over`), and a fresh figure is drawn when the player comes back.
   */
  ragdoll(dir: THREE.Vector3 | null, over: boolean): void {
    if (this.corpse || !this.root) return;
    this.corpse = true;
    const eff = this.ctx.effects;
    const scene = this.ctx.scene;
    const J = this.J;
    this.tagG.visible = false;
    this.rope.visible = false;
    this.hook.visible = false;
    const d = (dir && dir.lengthSq() > 0.01 ? dir.clone() : new THREE.Vector3(0, 0.4, -1)).normalize();
    const detach = (obj: THREE.Object3D | null | undefined, extraVel: THREE.Vector3, radius: number) => {
      if (!obj || !obj.parent) return;
      obj.updateWorldMatrix(true, false);
      scene.attach(obj);
      _v.copy(d).multiplyScalar(4 + Math.random() * 4).add(extraVel);
      _v.y += 2 + Math.random() * 3;
      eff.debris(
        obj,
        obj.position,
        _v,
        new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16),
        { radius, blood: true, life: 7 + Math.random() * 3 },
      );
    };
    if (over) {
      detach(J.headG, _v2.set((Math.random() - 0.5) * 4, 3, (Math.random() - 0.5) * 4), 0.25);
      if (Math.random() < 0.5) {
        detach(Math.random() < 0.5 ? J.armL : J.armR, _v2.set((Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 6), 0.12);
      }
    }
    // limp joints, then the body flies as one piece
    for (const k of ['armL', 'armR', 'legL', 'legR', 'foreL', 'foreR', 'shinL', 'shinR'] as const) {
      const joint = J[k];
      if (joint) {
        joint.rotation.x = (Math.random() - 0.5) * 2.4;
        joint.rotation.z = (Math.random() - 0.5) * 1.2;
      }
    }
    if (this.face) {
      this.face.eyes.visible = false;
      this.face.xeyes.visible = true;
    }
    this.root.updateWorldMatrix(true, false);
    scene.attach(this.root);
    _v.copy(d).multiplyScalar(5 + Math.random() * 3);
    _v.y += 3.5 + Math.random() * 2;
    _v.addScaledVector(this.vel, 0.4);
    eff.debris(
      this.root,
      this.root.position,
      _v,
      new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9),
      { radius: 0.55, blood: true, life: 8 },
    );
    eff.blood(this.center, d, 1.3);
    eff.bloodPool(this.body.pos, 1.2 + Math.random() * 0.6, INK.RED);
    this.root = null;
  }

  get isBlocking(): boolean {
    return this.blocking;
  }

  get blockRadius(): number {
    return 0;
  }

  /** Shows the prop for weapon index `i` (see WEAPON_KINDS); a no-op if it is already shown. */
  setWeapon(i: number): void {
    if (i === this.weaponIndex && this.J.gun.children.length) return;
    this.weaponIndex = i;
    const gun = this.J.gun;
    while (gun.children.length) gun.remove(gun.children[0]);
    buildWeaponProp(gun, this.mat, this.solid, { weapon: WEAPON_KINDS[i] || 'rifle' });
  }

  /** Takes in a snapshot received at local time `t` (seconds). */
  push(packet: PlayerSnapshot | null | undefined, t: number): void {
    if (!packet) return;
    // read it as a plain array: it came over the network, so its length is checked, not trusted
    const snap: readonly number[] = packet;
    this.snapA = this.snapB || { p: new THREE.Vector3(snap[0], snap[1], snap[2]), yaw: snap[3], pitch: snap[4], t: t - 0.07 };
    const snapB: PoseSample = { p: new THREE.Vector3(snap[0], snap[1], snap[2]), yaw: snap[3], pitch: snap[4], t };
    this.snapB = snapB;
    this.setWeapon(snap[5]);
    const f = snap[6];
    this.crouching = !!(f & FLAG.crouching);
    this.sliding = !!(f & FLAG.sliding);
    this.blocking = !!(f & FLAG.blocking);
    this.aiming = !!(f & FLAG.aiming);
    this.body.onGround = !!(f & FLAG.onGround);
    this.firing = !!(f & FLAG.firing);
    const wasAlive = this.alive;
    this.alive = !!(f & FLAG.alive);
    this.hp = snap[7];
    if (snap.length > 10) this.vel.set(snap[8], snap[9], snap[10]);
    else this.vel.set(0, 0, 0);
    this.grappling = !!(f & FLAG.grappling) && snap.length > 13;
    if (this.grappling) this.gPoint.set(snap[11], snap[12], snap[13]);
    this.parryWindow = !!(f & FLAG.parryWindow);
    const idle = !!(f & FLAG.idle);
    if (idle && !this.idle) this.idleSince = t;
    this.idle = idle;
    this.untouched = !!(f & FLAG.untouched);
    this.away = !!(f & FLAG.away);
    if (wasAlive && !this.alive) this.deadT = 0;
    if (this.alive && this.corpse) {
      this.buildModel();
      this.snapA = null;
      this.body.pos.copy(snapB.p);
    }
    if (this.root && !this.root.visible && !this.away) {
      this.body.pos.copy(snapB.p);
      this.root.visible = true;
    }
    if (this.root && this.away) this.root.visible = false;
  }

  /** Damage dealt to this player by the host's bots or by another player's shot goes to its owner. */
  takeDamage(amount: number, fromPos?: THREE.Vector3 | null): void {
    if (this.onDamage) this.onDamage(this, amount, fromPos);
  }

  knockback(_dir?: THREE.Vector3, _amount?: number): void {
    /* the owner's client applies its own physics */
  }

  tryBlockMelee(e: { center: THREE.Vector3 }): boolean {
    if (!this.alive || !this.blocking) return false;
    _v.subVectors(e.center, this.eye).normalize();
    return _v.dot(this.forward) > 0.35;
  }

  tryDeflect(_proj?: unknown): false {
    return false;
  }

  /** Briefly fills the figure in, as feedback for a hit or a shot. */
  flash(): void {
    this.flashT = 0.08;
    setFill(this.mat, true);
  }

  /** Eases toward the latest snapshots (rendered 80 ms behind `now`) and poses the figure. */
  update(dt: number, now: number): void {
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) setFill(this.mat, false);
    }
    const B = this.snapB;
    if (B) {
      const A = this.snapA || B;
      const span = Math.max(0.02, B.t - A.t);
      const tt = now - 0.08;
      const k = clamp((tt - A.t) / span, 0, 1);
      _v.lerpVectors(A.p, B.p, k);
      const late = tt - B.t;
      if (late > 0) _v.addScaledVector(this.vel, Math.min(late, 0.35));
      if (_v.distanceToSquared(this.body.pos) > 36) this.body.pos.copy(_v);
      else this.body.pos.lerp(_v, 1 - Math.exp(-dt * 22));
      this.body.vel.copy(this.vel);
      this.yaw = angleLerp(A.yaw, B.yaw, k);
      this.pitch = A.pitch + (B.pitch - A.pitch) * k;
    }
    this.speed = this.body.vel.length();
    this.body.height = this.crouching ? 1.05 : 1.75;
    this.eye.set(this.body.pos.x, this.body.pos.y + (this.crouching ? 0.88 : 1.6), this.body.pos.z);
    this.center.set(this.body.pos.x, this.body.pos.y + this.body.height * 0.55, this.body.pos.z);
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (!this.alive) this.deadT += dt;
    const root = this.root;
    if (!root) {
      for (const hs of this.hitSpheres) hs.set(0, -100, 0);
      this.rope.visible = false;
      this.hook.visible = false;
      return;
    }
    root.position.copy(this.body.pos);
    root.rotation.y = this.yaw + Math.PI;
    this.animate(dt, root);
    root.updateMatrixWorld(true);
    for (let i = 0; i < HIT.length; i++) {
      this.hitSpheres[i].setFromMatrixPosition(this.parts[HIT[i][0]].matrixWorld);
    }
    this.updateRope();
  }

  private updateRope(): void {
    const on = this.grappling && this.alive && !this.away;
    this.rope.visible = on;
    this.hook.visible = on;
    if (!on) return;
    _v.set(this.body.pos.x + this.right.x * 0.35, this.body.pos.y + 1.25, this.body.pos.z + this.right.z * 0.35);
    _v2.subVectors(this.gPoint, _v);
    const len = _v2.length();
    if (len < 0.05) {
      this.rope.visible = false;
      return;
    }
    this.rope.position.copy(_v).addScaledVector(_v2, 0.5);
    this.rope.scale.set(1, len, 1);
    this.rope.quaternion.setFromUnitVectors(_up, _v2.divideScalar(len));
    this.hook.position.copy(this.gPoint);
  }

  private animate(dt: number, root: THREE.Group): void {
    const J = this.J;
    const b = this.body;
    const sp = Math.hypot(b.vel.x, b.vel.z);
    this.walk = damp(this.walk, clamp(sp / 4, 0, 1), 10, dt);
    const w = this.walk;
    this.phase += dt * (sp * 2.2 + (sp > 0.4 ? 3 : 0));
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const pelvis = J.hips.parent;
    if (!this.alive) {
      // slumped on the page until they respawn
      if (pelvis) pelvis.rotation.x = damp(pelvis.rotation.x, Math.PI / 2, 5, dt);
      if (this.face) {
        this.face.eyes.visible = false;
        this.face.xeyes.visible = true;
      }
      return;
    }
    if (pelvis) pelvis.rotation.x = damp(pelvis.rotation.x, 0, 8, dt);
    if (this.face) {
      this.face.eyes.visible = true;
      this.face.xeyes.visible = false;
    }
    J.legL.rotation.x = s * 0.9 * w;
    J.legR.rotation.x = -s * 0.9 * w;
    J.shinL.rotation.x = Math.max(0, c) * 1.1 * w;
    J.shinR.rotation.x = Math.max(0, -c) * 1.1 * w;
    if (!b.onGround) {
      J.legL.rotation.x = -0.5;
      J.legR.rotation.x = 0.6;
      J.shinL.rotation.x = 1.0;
      J.shinR.rotation.x = 0.5;
    }
    // guns are carried up and forward, two hands on them, tilting with where they look; the
    // blade hangs at the side until it is raised to guard
    const blade = this.weaponIndex === WEAPON_KINDS.length - 1;
    const aim = blade ? 0 : this.aiming ? 1 : sp > 6.5 ? 0.8 : 0.95;
    const look = clamp(this.pitch, -1.1, 1.1);
    if (blade) {
      const g = this.blocking ? 1 : 0;
      J.armR.rotation.x = -0.9 - g * 0.9 - s * 0.6 * w * (1 - g);
      J.armR.rotation.z = -0.3 - g * 0.5;
      J.foreR.rotation.x = -1.0 - g * 0.6;
      J.armL.rotation.x = s * 0.8 * w * (1 - g) - g * 1.4;
      J.foreL.rotation.x = -0.5;
    } else {
      J.armR.rotation.x = (-1.35 - look * 0.85) * aim - s * 0.6 * w * (1 - aim);
      J.armR.rotation.z = -0.2 * (1 - aim);
      J.foreR.rotation.x = -0.2;
      J.armL.rotation.x = (-1.25 - look * 0.85) * aim + s * 0.6 * w * (1 - aim);
      J.armL.rotation.y = 0.55 * aim;
      J.foreL.rotation.x = -0.45;
    }
    J.torso.rotation.x = -0.2 * w + (this.sliding ? 0.5 : 0) + (this.crouching ? 0.25 : 0);
    J.torso.rotation.y = -0.3 * aim;
    J.hips.position.y = (this.crouching ? 0.55 : 0.86) + Math.abs(c) * 0.07 * w;
    J.headG.rotation.x = clamp(-this.pitch, -0.7, 0.7) * 0.7;
    const player = this.ctx.player;
    this.tagG.rotation.y =
      -root.rotation.y +
      (player ? Math.atan2(player.eye.x - this.body.pos.x, player.eye.z - this.body.pos.z) : 0);
  }

  /** Removes everything this player added to the scene. */
  dispose(): void {
    if (this.root) this.ctx.scene.remove(this.root);
    this.ctx.scene.remove(this.rope);
    this.ctx.scene.remove(this.hook);
  }
}
