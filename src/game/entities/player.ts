// First-person player: movement (sprint/slide/wall-jump/mantle/air dash), swing-grapple, camera feel, health, weapons.
import * as THREE from 'three';
import { makeBody } from '../world/physics';
import type { Body, Collider } from '../world/physics';
import type { GrappleMover } from '../world/level';
import { makeInkMaterial, INK } from '../render/ink-renderer';
import { Rifle, Shotgun, Sniper, Katana } from './weapons';
import type { Weapon, WeaponInput } from './weapons';
import type { DeflectResult, Enemy } from './enemies';
import { clamp, damp, rand, Spring, alignYAxis } from '../core/math';
import { audio } from '../core/audio';
import { t } from '../core/i18n';
import type { SlotAction } from '../core/input';
import type { DamageSource, GameContext } from '../context';

// the dome shell and anything else flagged this way cannot be hooked
const NO_GRAPPLE = (b: Collider): boolean => !!b.data.noGrapple;

// grapple stamina: cost per shot, drain while hanging, regen on the ground / in the air,
// minimum needed to fire, regen pause after use; and how long a fresh guard parries melee
const STAM_FIRE = 0.09;
const STAM_DRAIN = 0.08;
const STAM_GROUND = 0.4;
const STAM_AIR = 0.2;
const STAM_MIN = 0.18;
const STAM_PAUSE = 0.5;
const PARRY_WINDOW = 0.55;

// movement tuning
const G = 26;
const WALK = 6.6;
const SPRINT = 10.6;
const CROUCH = 3.6;
const ACCEL = 140;
const FRICTION = 8;
const AIR_ACCEL = 36;
const AIR_CAP = 7.5;
const JUMP = 9.6;
const STAND_H = 1.75;
const CROUCH_H = 1.05;
const EYE_STAND = 1.6;
const EYE_CROUCH = 0.88;

const SLOT_ACTIONS: readonly SlotAction[] = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'];

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _d = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
// scratch for the grenade arc preview
const _ap = new THREE.Vector3();
const _av = new THREE.Vector3();
const _ad = new THREE.Vector3();
const _aprev = new THREE.Vector3();

/** `idle`: no rope; `fly`: hook travelling to its target; `on`: attached and swinging. */
export type GrappleState = 'idle' | 'fly' | 'on';

export interface Grapple {
  state: GrappleState;
  /** Where the hook is (or is going) attached. */
  anchor: THREE.Vector3;
  /** Where the hook currently is. */
  hook: THREE.Vector3;
  /** Where the hook was fired from. */
  from: THREE.Vector3;
  flyT: number;
  flyDur: number;
  /** Rope length while attached. */
  len: number;
  /** Cooldown before the next shot. */
  cd: number;
  /** An enemy being yanked toward you, if the hook hit one. */
  enemy: Enemy | null;
  /** A moving object the rope is attached to. */
  mover: GrappleMover | null;
  /** How long line of sight to the anchor has been blocked. */
  blockedT: number;
  /** Generic timer for periodic checks. */
  t: number;
  swingT: number;
  hopT: number;
}

interface GrappleTarget {
  point: THREE.Vector3;
  dist: number;
  enemy?: Enemy | null;
  mover?: GrappleMover;
}

interface Grenade {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  fuse: number;
  /** Thrown by the local player (so this client applies its damage). */
  mine: boolean;
  rest: boolean;
  tick: number;
}

/** The network payload describing a grenade throw. */
export interface GrenadeThrow {
  pos: number[];
  vel: number[];
}

interface NadeArc {
  dots: THREE.Mesh[];
  mark: THREE.Mesh;
  shown: boolean;
}

/** Who last hurt the local player and how; set by the orchestrator for the death screen. */
export interface LastHit {
  from: number[] | null;
  crit: boolean;
  amount: number;
  src?: DamageSource;
}

/** The local first-person player. */
export class Player {
  private readonly ctx: GameContext;
  private readonly camera: THREE.PerspectiveCamera;
  readonly body: Body;
  yaw = 0;
  pitch = 0;
  maxHp = 120;
  hp = 120;
  alive = true;
  /** Seconds after taking damage before health regenerates. */
  regenDelay = 4.5;
  /** Health regained per second. */
  regenRate = 11;
  private nadeCharge = 0;
  private _nadeHeld = false;
  /** Grapple stamina, 0..1. */
  grapStam = 1;
  private blockHeld = 0;
  private stamPause = 0;
  readonly eye = new THREE.Vector3();
  readonly center = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, -1);
  readonly right = new THREE.Vector3(1, 0, 0);
  /** Current speed (m/s). */
  speed = 0;
  hurtFx = 0;
  flashFx = 0;
  private lastDamageT = 10;
  private readonly rig = new THREE.Group();
  readonly weapons: readonly [Rifle, Shotgun, Sniper, Katana];
  readonly katanaIndex = 3;
  weaponIndex = 0;
  weapon: Weapon;
  private returnT = 0;
  private prevWeaponIndex = 0;
  private readonly recoilPitch = new Spring(190, 17);
  private readonly recoilYaw = new Spring(190, 17);
  private readonly fovKick = new Spring(220, 14);
  private readonly landDip = new Spring(170, 15);
  private roll = 0;
  private fov = 82;
  private bobPhase = 0;
  private bobAmt = 0;
  private stepDist = 0;
  private eyeH = EYE_STAND;
  crouching = false;
  sliding = false;
  private slideT = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private wallTouch = 9;
  private readonly wallN = new THREE.Vector3();
  private wallJumpCd = 0;
  private mantleCd = 0;
  private dashCd = 0;
  private airJumps = 1;
  private blockCd = 0;
  private landGraceT = 0;
  private sprintToggle = false;
  private lastGround = true;
  private airT = 0;
  private _sprinting = false;
  /** Aiming down sights this frame (read for network snapshots). */
  _aiming = false;
  private _mv: { readonly x: number; readonly y: number } = { x: 0, y: 0 };
  readonly grapple: Grapple = {
    state: 'idle',
    anchor: new THREE.Vector3(),
    hook: new THREE.Vector3(),
    from: new THREE.Vector3(),
    flyT: 0,
    flyDur: 0,
    len: 0,
    cd: 0,
    enemy: null,
    mover: null,
    blockedT: 0,
    t: 0,
    swingT: 0,
    hopT: 0,
  };
  private deathT = 0;
  gravityScale = 1;
  /** While set, the orchestrator drives the body (focus dash); normal movement is suspended. */
  dashLock = false;
  readonly isLocal = true;
  team = 0;
  name = 'you';
  grenades = 3;
  maxGrenades = 5;
  private readonly nades: Grenade[] = [];
  private nadeCd = 0;
  /** Holding the trigger with a gun out this frame. */
  firing = false;
  /** Called when the local player throws a grenade, with the payload peers need to replay it. */
  onThrow: ((d: GrenadeThrow) => void) | null = null;
  /** Called after falling off the map. */
  onFall: (() => void) | null = null;
  // set by the orchestrator: who hurt us last, and respawn protection
  lastHitBy: string | null = null;
  lastHit: LastHit | null = null;
  shieldT = 0;
  private readonly rope: THREE.Mesh;
  private readonly hookMesh = new THREE.Group();
  private _arc: NadeArc | null = null;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.camera = ctx.camera;
    this.camera.rotation.order = 'YXZ';
    this.body = makeBody(ctx.level.playerStart, 0.35, STAND_H, 0.55);
    this.camera.add(this.rig);
    ctx.scene.add(this.camera);
    this.weapons = [new Rifle(ctx), new Shotgun(ctx), new Sniper(ctx), new Katana(ctx)];
    for (const w of this.weapons) this.rig.add(w.root);
    this.weapon = this.weapons[0];
    this.weapon.equip();
    const rm = makeInkMaterial({ ink: INK.BLUE, fill: false, shadeBias: -0.3 });
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), rm);
    this.rope.visible = false;
    ctx.scene.add(this.rope);
    const hm = makeInkMaterial({ ink: INK.BLUE });
    this.hookMesh.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 10), hm));
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), hm);
    hb.position.y = -0.2;
    this.hookMesh.add(hb);
    this.hookMesh.visible = false;
    ctx.scene.add(this.hookMesh);
  }

  /** Respawn at `pos` with full health, ammo and grenades. */
  reset(pos: THREE.Vector3): void {
    this.nadeCharge = 0;
    this._nadeHeld = false;
    if (this._arc) this.updateNadeArc(-1);
    this.grapStam = 1;
    this.blockHeld = 0;
    const b = this.body;
    b.pos.copy(pos);
    b.vel.set(0, 0, 0);
    b.onGround = false;
    b.height = STAND_H;
    this.hp = this.maxHp;
    this.alive = true;
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.hurtFx = 0;
    this.flashFx = 0;
    this.crouching = false;
    this.sliding = false;
    this.deathT = 0;
    this.lastDamageT = 10;
    this.dashCd = 0;
    this.airJumps = 1;
    this.gravityScale = 1;
    this.dashLock = false;
    this.detachGrapple(false);
    for (const w of this.weapons) {
      if (w.isGun) {
        w.mag = w.magSize;
        w.reserve = w.startReserve;
        w.reloading = false;
        w.pumpT = 0;
      }
    }
    this.switchTo(0, true);
    this.rig.visible = true;
    this.eyeH = EYE_STAND;
    this.grenades = 3;
    this.clearNades();
  }

  clearNades(): void {
    for (const n of this.nades) this.ctx.scene.remove(n.mesh);
    this.nades.length = 0;
  }

  /** The katana, if it is out with its guard raised. */
  private get guard(): Katana | null {
    const w = this.weapon;
    return w.kind === 'katana' && w.blocking ? w : null;
  }

  get isBlocking(): boolean {
    return this.guard !== null;
  }

  /** The view direction, randomly spread by up to `spread` on each axis. */
  aimDir(spread = 0): THREE.Vector3 {
    const d = this.forward.clone();
    if (spread > 0) {
      d.addScaledVector(this.right, rand(-spread, spread));
      d.y += rand(-spread, spread);
      d.normalize();
    }
    return d;
  }

  /** Camera recoil: `p` pitch, `y` yaw. */
  recoil(p: number, y: number): void {
    this.pitch = clamp(this.pitch + p * 0.55, -1.5, 1.5);
    this.recoilPitch.kick(p * 22);
    this.recoilYaw.kick(y * 30);
  }

  kickFov(v: number): void {
    this.fovKick.kick(v * 30);
  }

  /** Throw the body forward (katana lunge). */
  lunge(speed: number): void {
    const d = this.forward.clone();
    d.y = clamp(d.y, -0.2, 0.5);
    d.normalize();
    const b = this.body;
    b.vel.addScaledVector(d, speed);
    if (b.onGround) {
      b.vel.y = Math.max(b.vel.y, 2.5);
      b.onGround = false;
    }
    audio.dash();
    this.kickFov(3);
  }

  /** Equip weapon `i`; `silent` skips the sound and allows re-equipping the current one. */
  switchTo(i: number, silent = false): void {
    if (i < 0 || i >= this.weapons.length) return;
    if (i === this.weaponIndex && !silent) return;
    if (this.weapon.kind !== 'katana') this.prevWeaponIndex = this.weaponIndex;
    this.weapon.unequip();
    this.weaponIndex = i;
    this.weapon = this.weapons[i];
    this.weapon.equip();
    if (!silent) audio.switchWeapon();
    this.ctx.hud.setWeapon(this.weapon.name, this.weapon.hint);
    this.ctx.hud.setCrosshairMode(this.weapon.kind === 'katana' ? 'katana' : '');
  }

  /** Give every gun `frac` of its maximum reserve. */
  addAmmoAll(frac = 0.5): void {
    for (const w of this.weapons) if (w.isGun) w.addAmmo(Math.round(w.maxReserve * frac));
  }

  takeDamage(amount: number, fromPos?: THREE.Vector3 | null): void {
    if (!this.alive) return;
    this.hp -= amount;
    this.lastDamageT = 0;
    this.hurtFx = Math.min(1, this.hurtFx + amount / 40);
    this.ctx.effects.shakeAmt += 0.2 + amount / 80;
    audio.hurt();
    this.ctx.input.rumble(0.8, 0.5, 160);
    if (fromPos) {
      _v.subVectors(fromPos, this.eye);
      const x = _v.dot(this.right);
      const f = _v.dot(this.forward);
      this.ctx.hud.damageFrom(Math.atan2(x, f));
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  knockback(dir: THREE.Vector3, amount: number): void {
    const b = this.body;
    b.vel.addScaledVector(dir, amount);
    b.vel.y += amount * 0.5;
    b.onGround = false;
  }

  // The guard only covers what is right in front of the blade: a modest reach and a narrow
  // cone, so shots from your flank still land and holding block is not a free win.
  get blockRadius(): number {
    return this.isBlocking && this.blockCd <= 0 ? 0.95 : 0;
  }

  /** Try to turn a projectile aside with the raised guard. */
  tryDeflect(proj: { readonly pos: THREE.Vector3; readonly vel: THREE.Vector3 }): DeflectResult | false {
    const guard = this.guard;
    if (!this.alive || !guard || this.blockCd > 0) return false;
    // block only what is flying in at you from the front; flank and back shots get through
    _v.copy(proj.vel).normalize().negate();
    if (_v.dot(this.forward) < 0.55) return false;
    const perfect = guard.blockT < 0.26;
    const ctx = this.ctx;
    // only a well timed guard sends it back; otherwise the round is simply knocked out of the air
    const ret = perfect || Math.random() < 0.35;
    this.blockCd = 0.19; // the blade has to come back before the next parry
    guard.onDeflect(perfect);
    if (perfect) audio.perfectParry();
    else audio.parry();
    ctx.effects.sparks(proj.pos, _v2.copy(proj.vel).normalize().negate(), INK.ORANGE, perfect ? 14 : 8, 10);
    ctx.effects.strokeBurst(proj.pos, INK.BLUE, perfect ? 8 : 5, 4.5, { life: 0.2, size: 0.028 });
    ctx.input.rumble(0.4, 0.6, 70);
    ctx.game.hitstop(perfect ? 0.07 : 0.025, 0.18);
    ctx.effects.shakeAmt += 0.06;
    this.flashFx = perfect ? 0.35 : 0.1;
    ctx.game.addScore(perfect ? 60 : 15, perfect ? t('perfectParry') : t('parry'));
    return { perfect, ret };
  }

  /** The guard went up recently enough to parry a melee hit. */
  get parryWindow(): boolean {
    return this.isBlocking && this.blockHeld < PARRY_WINDOW;
  }

  /** Try to parry a melee attack from `e`; true if it was blocked. */
  tryBlockMelee(e: { readonly center: THREE.Vector3 }): boolean {
    const guard = this.guard;
    if (!this.alive || !guard || !this.parryWindow || this.blockCd > 0) return false;
    _v.subVectors(e.center, this.eye).normalize();
    if (_v.dot(this.forward) < 0.35) return false;
    guard.onDeflect(true);
    audio.parry();
    this.ctx.game.hitstop(0.06, 0.15);
    this.ctx.effects.sparks(
      _v2.copy(this.eye).addScaledVector(this.forward, 0.8),
      this.forward.clone().negate(),
      INK.ORANGE,
      12,
      8,
    );
    this.ctx.game.addScore(40, t('blockMelee'));
    this.ctx.input.rumble(0.6, 0.6, 100);
    return true;
  }

  private die(): void {
    this.alive = false;
    this.deathT = 0;
    audio.death();
    this.detachGrapple(false);
    this.ctx.game.onPlayerDeath();
  }

  /** Slow orbit camera for menus. */
  idleCam(time: number): void {
    const c = this.camera;
    c.position.set(Math.sin(time * 0.08) * 70, 30 + Math.sin(time * 0.23) * 4, Math.cos(time * 0.08) * 70);
    c.lookAt(0, 10, 0);
    this.rig.visible = false;
    this.eye.copy(c.position);
    this.center.copy(c.position);
    c.getWorldDirection(this.forward);
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();
    if (Math.abs(c.fov - 70) > 0.01) {
      c.fov = 70;
      c.updateProjectionMatrix();
    }
  }

  update(dt: number): void {
    const ctx = this.ctx;
    const inp = ctx.input;
    const b = this.body;
    this.lastDamageT += dt;
    if (!this.alive) {
      this.deathT += dt;
      this.eyeH = damp(this.eyeH, 0.35, 3, dt);
      this.roll = damp(this.roll, 0.9, 3, dt);
      this.pitch = damp(this.pitch, -0.35, 3, dt);
      b.vel.x = damp(b.vel.x, 0, 4, dt);
      b.vel.z = damp(b.vel.z, 0, 4, dt);
      b.vel.y -= G * dt;
      ctx.world.moveBody(b, dt);
      this.forward.set(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.updateNades(dt);
      this._updateCamera(dt);
      this.weapon.animate(dt, this._weaponState(false, false, 0));
      return;
    }
    this.rig.visible = true;

    // ---- look ----
    const lookMul = this._aiming ? (this.weapon.scope ? 0.38 : 0.62) : 1;
    this.yaw += inp.look.x * lookMul;
    this.pitch = clamp(this.pitch + inp.look.y * lookMul, -1.5, 1.5);
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.right.copy(_right);
    if (this.dashLock) {
      // the focus dash is sprinting the body across the level itself; don't fight it with gravity
      b.vel.set(0, 0, 0);
      b.onGround = false;
      this.coyote = 0.13;
      this._updateCamera(dt);
      this.weapon.animate(dt, this._weaponState(false, false, 0));
      return;
    }

    // ---- movement input ----
    const mv = inp.move;
    this._mv = mv;
    const wish = _v.set(0, 0, 0).addScaledVector(_fwd, mv.y).addScaledVector(_right, mv.x);
    let wishLen = wish.length();
    if (wishLen > 1e-4) wish.divideScalar(wishLen);
    wishLen = Math.min(1, wishLen);
    if (inp.usingGamepad) {
      if (inp.pressed('sprint')) this.sprintToggle = !this.sprintToggle;
      if (mv.y < 0.1) this.sprintToggle = false;
    } else {
      this.sprintToggle = inp.down('sprint');
    }
    const aiming = (this._aiming = inp.down('aim') && this.weapon.isGun);
    const hspeed = Math.hypot(b.vel.x, b.vel.z);
    const crouchDown = inp.down('crouch');
    if (inp.pressed('crouch') && b.onGround && hspeed > 6.3 && !this.sliding) this._startSlide(hspeed);
    if (this.sliding) {
      this.slideT += dt;
      if (!crouchDown || hspeed < 3.5 || this.airT > 0.35) this.sliding = false;
    }
    let wantCrouch = (crouchDown && b.onGround) || this.sliding;
    if (!wantCrouch && this.crouching) {
      b.height = STAND_H;
      if (ctx.world.overlapsBody(b)) wantCrouch = true;
    }
    this.crouching = wantCrouch;
    b.height = this.crouching ? CROUCH_H : STAND_H;
    const sprinting = (this._sprinting = this.sprintToggle && mv.y > 0.1 && !this.crouching && !aiming);
    const maxSpeed = this.crouching && !this.sliding ? CROUCH : sprinting ? SPRINT : WALK;
    this.landGraceT -= dt;
    this.dashCd -= dt;
    this.blockCd -= dt;

    // ---- ground / air accel ----
    if (b.onGround) {
      this.coyote = 0.13;
      this.airT = 0;
      this.airJumps = 1;
      if (this.sliding) {
        const sp = hspeed;
        if (sp > 0) {
          const ns = Math.max(0, sp - 6.5 * dt) / sp;
          b.vel.x *= ns;
          b.vel.z *= ns;
        }
        if (wishLen > 0) {
          b.vel.x += wish.x * 6 * dt;
          b.vel.z += wish.z * 6 * dt;
          const n2 = Math.hypot(b.vel.x, b.vel.z);
          if (n2 > sp && n2 > 0) {
            b.vel.x *= sp / n2;
            b.vel.z *= sp / n2;
          }
        }
      } else {
        const fr = FRICTION * (this.landGraceT > 0 ? 0.25 : 1);
        const sp = hspeed;
        if (sp > 0) {
          const ns = Math.max(0, sp - sp * fr * dt) / sp;
          b.vel.x *= ns;
          b.vel.z *= ns;
        }
        if (wishLen > 0) {
          const cur = b.vel.x * wish.x + b.vel.z * wish.z;
          const add = Math.min(maxSpeed * wishLen - cur, ACCEL * dt);
          if (add > 0) {
            b.vel.x += wish.x * add;
            b.vel.z += wish.z * add;
          }
        }
      }
    } else {
      this.coyote -= dt;
      this.airT += dt;
      if (wishLen > 0) {
        const cur = b.vel.x * wish.x + b.vel.z * wish.z;
        const add = Math.min(AIR_CAP * wishLen - cur, AIR_ACCEL * dt);
        if (add > 0) {
          b.vel.x += wish.x * add;
          b.vel.z += wish.z * add;
        }
      }
    }

    // ---- jumping / wall jump / air dash ----
    if (inp.pressed('jump')) this.jumpBuffer = 0.15;
    else this.jumpBuffer -= dt;
    this.wallJumpCd -= dt;
    this.mantleCd -= dt;
    if (b.hitWall && !b.onGround) {
      this.wallTouch = 0;
      this.wallN.copy(b.wallNormal);
    } else {
      this.wallTouch += dt;
    }
    if (this.jumpBuffer > 0) {
      if (this.grapple.state === 'on') {
        this.jumpBuffer = 0;
        this.detachGrapple(true);
      } else if (b.onGround || this.coyote > 0) {
        this.jumpBuffer = 0;
        this.coyote = 0;
        b.vel.y = JUMP;
        b.onGround = false;
        this.airJumps = 1;
        if (this.sliding) {
          b.vel.x *= 1.06;
          b.vel.z *= 1.06;
          this.sliding = false;
        }
        audio.jump();
        this.landDip.kick(-1.2);
      } else if (this.wallTouch < 0.12 && this.wallJumpCd <= 0 && b.vel.y < 7) {
        this.jumpBuffer = 0;
        this.wallJumpCd = 0.35;
        const n = this.wallN;
        b.vel.x = n.x * 7.5 + b.vel.x * 0.35 + _fwd.x * 2.5;
        b.vel.z = n.z * 7.5 + b.vel.z * 0.35 + _fwd.z * 2.5;
        b.vel.y = 9.2;
        audio.wallJump();
        this.roll += n.dot(_right) > 0 ? -0.1 : 0.1;
        this.kickFov(2);
        this.landDip.kick(-1.5);
        this.airJumps = 1;
      } else if (this.airJumps > 0) {
        // double jump: a second beat of height, and it redirects toward where you are steering
        this.jumpBuffer = 0;
        this.airJumps--;
        b.vel.y = JUMP * 0.92;
        if (wishLen > 0) {
          const cur = b.vel.x * wish.x + b.vel.z * wish.z;
          const add = Math.max(0, 7.5 * wishLen - cur);
          b.vel.x += wish.x * add;
          b.vel.z += wish.z * add;
        }
        audio.jump();
        this.kickFov(1.6);
        this.landDip.kick(-1.4);
        _v2.copy(this.center);
        _v2.y -= 0.7;
        this.ctx.effects.strokeBurst(_v2, INK.BLUE, 9, 4.5, { life: 0.28, size: 0.028, gravity: -2 });
      }
    }
    if (
      (inp.pressed('dash') || (inp.pressed('crouch') && !b.onGround)) &&
      !b.onGround &&
      this.dashCd <= 0 &&
      this.grapple.state !== 'on'
    ) {
      this._dash(wishLen > 0 ? wish : _fwd);
    }

    // ---- gravity, grapple, mantle, integrate ----
    b.vel.y -= G * this.gravityScale * (this.grapple.state === 'on' ? 0.88 : 1) * dt;
    this._updateGrapple(dt);
    if (!b.onGround && this.mantleCd <= 0 && mv.y > 0.3 && b.vel.y < 8 && this.grapple.state !== 'on') {
      this._tryMantle(_fwd);
    }
    b.noSnap = this.grapple.state === 'on' || b.vel.y > 0.5;
    const spd = b.vel.length();
    if (spd > 48) b.vel.multiplyScalar(48 / spd);
    ctx.world.moveBody(b, dt);
    if (ctx.level.fallKills) {
      // off the edge of a map with no walls (the desk): the fall is fatal, and the body stays put below the edge
      if (b.pos.y < -12) {
        b.pos.y = -12;
        b.vel.set(0, 0, 0);
        if (this.alive) {
          this.detachGrapple(false);
          this.takeDamage(this.hp, null);
        }
      }
    } else if (b.pos.y < -12 || Math.abs(b.pos.x) > 95 || Math.abs(b.pos.z) > 95) {
      this.detachGrapple(false);
      b.pos.copy(ctx.level.playerStart);
      b.vel.set(0, 0, 0);
      this.takeDamage(20, null);
      if (this.onFall) this.onFall();
      ctx.hud.message(t('fellOffPaper'), t('redrawn'), 1.8);
    }
    if (b.onGround && !this.lastGround) {
      const impact = clamp(-b.landVel / 14, 0, 1.5);
      this.landDip.kick(-impact * 6 - 0.5);
      audio.land(impact);
      if (impact > 0.8) {
        ctx.effects.shakeAmt += impact * 0.15;
        ctx.input.rumble(impact * 0.4, 0.2, 80);
      }
      if (Math.hypot(b.vel.x, b.vel.z) > 9) this.landGraceT = 0.4;
    }
    this.lastGround = b.onGround;

    // ---- regen, bob, footsteps ----
    if (
      this.lastDamageT > this.regenDelay &&
      this.hp < this.maxHp &&
      !this._sprinting &&
      this.grapple.state === 'idle'
    ) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    }
    this.blockHeld = this.isBlocking ? this.blockHeld + dt : 0;
    // the grapple runs on breath: hanging drains it, feet on the ground bring it back fast
    this.stamPause -= dt;
    if (this.grapple.state !== 'idle') this.grapStam -= STAM_DRAIN * dt;
    else if (this.stamPause <= 0) this.grapStam += (b.onGround ? STAM_GROUND : STAM_AIR) * dt;
    this.grapStam = clamp(this.grapStam, 0, 1);
    if (this.grapple.state === 'on' && this.grapStam <= 0) {
      this.detachGrapple(false);
      ctx.hud.tip(t('outOfBreath'), 1.4);
    }
    const hs2 = Math.hypot(b.vel.x, b.vel.z);
    const moving = b.onGround && hs2 > 0.6 && !this.sliding;
    this.bobAmt = damp(this.bobAmt, moving ? clamp(hs2 / 7, 0.3, 1.4) : 0, 8, dt);
    if (moving) {
      this.bobPhase += dt * (7 + hs2 * 0.5);
      this.stepDist += hs2 * dt;
      if (this.stepDist > (sprinting ? 2.5 : 2.0)) {
        this.stepDist = 0;
        audio.footstep(clamp(hs2 / 8, 0.3, 1));
      }
    }
    this._updateCamera(dt);

    // ---- grenades ----
    this.nadeCd -= dt;
    if (inp.down('grenade') && this.grenades > 0 && this.nadeCd <= 0 && this.alive && !this.dashLock) {
      this.nadeCharge = Math.min(1, this.nadeCharge + dt / 1.1);
      this._nadeHeld = true;
    } else if (this._nadeHeld) {
      this._nadeHeld = false;
      if (this.grenades > 0 && this.nadeCd <= 0 && this.alive) this.throwGrenade(null, this.nadeCharge);
      this.nadeCharge = 0;
    }
    this.updateNadeArc(this._nadeHeld ? this.nadeCharge : -1);
    this.updateNades(dt);

    // ---- weapons ----
    for (let i = 0; i < SLOT_ACTIONS.length; i++) {
      if (inp.pressed(SLOT_ACTIONS[i])) this.switchTo(Math.min(i, this.weapons.length - 1));
    }
    if (inp.pressed('nextWeapon')) this.switchTo((this.weaponIndex + 1) % this.weapons.length);
    if (inp.pressed('prevWeapon')) this.switchTo((this.weaponIndex + this.weapons.length - 1) % this.weapons.length);
    const st = this._weaponState(sprinting, aiming, hs2);
    if (inp.pressed('melee') && this.weapon.kind !== 'katana') {
      this.switchTo(this.katanaIndex);
      this.returnT = 0.85;
      this.weapons[this.katanaIndex].startSlash(st);
      st.meleePressed = false;
    }
    if (this.returnT > 0) {
      if (this.weapon.kind === 'katana' && (st.firePressed || st.aim || st.meleePressed)) {
        this.returnT = 0;
      } else {
        this.returnT -= dt;
        if (this.returnT <= 0) this.switchTo(this.prevWeaponIndex);
      }
    }
    this.firing = st.fire && this.weapon.isGun;
    this.weapon.animate(dt, st);
    ctx.hud.setAds(this.weapon.isGun && this.weapon.aimAmt > 0.55);
    ctx.hud.setScope(!!this.weapon.scope && this.weapon.aimAmt > 0.62);
  }

  // ---- grenades: a lobbed ink bomb with a short fuse and a big orange blast ----
  // where a throw starts and how fast it leaves, for a given charge (0 = flick, 1 = full wind-up)
  private _nadeLaunch(charge: number, pos: THREE.Vector3, vel: THREE.Vector3): void {
    pos.copy(this.eye).addScaledVector(this.right, 0.25).addScaledVector(this.forward, 0.6);
    pos.y -= 0.15;
    vel.copy(this.forward).multiplyScalar(9 + 20 * charge).addScaledVector(this.body.vel, 0.5);
    vel.y += 3.5 + 2.5 * charge;
  }

  /** Throw a grenade: our own (with `charge`), or replay a peer's throw from `remote`. */
  throwGrenade(remote: GrenadeThrow | null = null, charge = 0): void {
    const ctx = this.ctx;
    let pos: THREE.Vector3;
    let vel: THREE.Vector3;
    if (remote) {
      pos = new THREE.Vector3().fromArray(remote.pos);
      vel = new THREE.Vector3().fromArray(remote.vel);
    } else {
      this.grenades--;
      this.nadeCd = 0.55;
      pos = new THREE.Vector3();
      vel = new THREE.Vector3();
      this._nadeLaunch(charge, pos, vel);
      this.weapon.recoil.kick(-0.4, 0.5, 1.2);
      this.weapon.recoilRot.kick(-3, 0, -1.5);
      audio.grappleFire();
      ctx.input.rumble(0.2, 0.4, 50);
      if (this.onThrow) {
        this.onThrow({
          pos: pos.toArray().map((v) => +v.toFixed(2)),
          vel: vel.toArray().map((v) => +v.toFixed(2)),
        });
      }
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), makeInkMaterial({ ink: INK.BLACK })));
    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 4, 8), makeInkMaterial({ ink: INK.ORANGE }));
    pin.position.y = 0.2;
    g.add(pin);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6), makeInkMaterial({ ink: INK.ORANGE }));
    cap.position.y = 0.17;
    g.add(cap);
    g.position.copy(pos);
    ctx.scene.add(g);
    this.nades.push({
      mesh: g,
      pos,
      vel,
      ang: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
      fuse: 1.7,
      mine: !remote,
      rest: false,
      tick: 0,
    });
  }

  /** Show the predicted grenade arc for `charge`, or hide it when `charge < 0`. */
  private updateNadeArc(charge: number): void {
    if (!this._arc) {
      const dots: THREE.Mesh[] = [];
      const mat = makeInkMaterial({ ink: INK.BLACK, fill: true });
      for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat);
        m.visible = false;
        this.ctx.scene.add(m);
        dots.push(m);
      }
      const mark = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 5, 18), makeInkMaterial({ ink: INK.ORANGE }));
      mark.rotation.x = Math.PI / 2;
      mark.visible = false;
      this.ctx.scene.add(mark);
      this._arc = { dots, mark, shown: false };
    }
    const A = this._arc;
    if (charge < 0) {
      if (A.shown) {
        for (const d of A.dots) d.visible = false;
        A.mark.visible = false;
        A.shown = false;
      }
      return;
    }
    A.shown = true;
    const world = this.ctx.world;
    this._nadeLaunch(charge, _ap, _av);
    let n = 0;
    const step = 1 / 30;
    for (let i = 0; i < 52 && n < A.dots.length; i++) {
      _av.y -= 22 * step;
      _aprev.copy(_ap);
      _ap.addScaledVector(_av, step);
      _ad.subVectors(_ap, _aprev);
      const len = _ad.length();
      if (len > 1e-6) {
        _ad.divideScalar(len);
        const hit = world.raycast(_aprev, _ad, len + 0.16);
        if (hit) {
          _ap.copy(hit.point).addScaledVector(hit.normal, 0.16);
          const vn = _av.dot(hit.normal);
          if (vn < 0) {
            _av.addScaledVector(hit.normal, -1.45 * vn);
            _av.multiplyScalar(0.55);
          }
          if (_av.length() < 1.2 && hit.normal.y > 0.5) break;
        }
      }
      if (i % 2 === 0 && i >= 6) {
        const d = A.dots[n++];
        d.position.copy(_ap);
        d.visible = true;
        const k = 0.8 + charge * 0.6;
        d.scale.setScalar(k);
      }
    }
    for (let i = n; i < A.dots.length; i++) A.dots[i].visible = false;
    A.mark.position.copy(_ap);
    A.mark.position.y += 0.02;
    A.mark.visible = true;
    A.mark.scale.setScalar(0.8 + charge * 0.5);
  }

  private updateNades(dt: number): void {
    const ctx = this.ctx;
    const world = ctx.world;
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i];
      n.fuse -= dt;
      n.tick += dt;
      if (!n.rest) {
        n.vel.y -= 22 * dt;
        _v2.copy(n.pos);
        n.pos.addScaledVector(n.vel, dt);
        _d.subVectors(n.pos, _v2);
        const len = _d.length();
        if (len > 1e-6) {
          _d.divideScalar(len);
          const hit = world.raycast(_v2, _d, len + 0.16);
          if (hit) {
            n.pos.copy(hit.point).addScaledVector(hit.normal, 0.16);
            const vn = n.vel.dot(hit.normal);
            if (vn < 0) {
              n.vel.addScaledVector(hit.normal, -1.45 * vn);
              n.vel.multiplyScalar(0.55);
              n.ang.multiplyScalar(0.6);
              audio.shell();
            }
            if (n.vel.length() < 1.2 && hit.normal.y > 0.5) {
              n.rest = true;
              n.vel.set(0, 0, 0);
            }
          }
        }
        n.mesh.rotation.x += n.ang.x * dt;
        n.mesh.rotation.y += n.ang.y * dt;
        n.mesh.rotation.z += n.ang.z * dt;
        n.mesh.position.copy(n.pos);
      }
      // the fuse sparks faster as it runs out
      const rate = n.fuse < 0.8 ? 14 : 5;
      if (Math.floor(n.tick * rate) !== Math.floor((n.tick - dt) * rate)) {
        ctx.effects.strokeBurst(n.pos.clone().add(_v.set(0, 0.22, 0)), INK.ORANGE, 2, 2.5, { life: 0.12, size: 0.02 });
      }
      if (n.fuse <= 0) {
        this.explodeNade(n);
        ctx.scene.remove(n.mesh);
        this.nades.splice(i, 1);
      }
    }
  }

  private explodeNade(n: Grenade): void {
    const ctx = this.ctx;
    const R = 6.4;
    const c = n.pos.clone();
    c.y += 0.25;
    ctx.effects.boom(c, R);
    audio.explosion(c);
    ctx.input.rumble(0.9, 0.9, 220);
    // bots: the thrower's client reports the damage (host applies it; a client's report is forwarded)
    if (n.mine) ctx.enemies.blastEnemies(c, R, 120, null);
    if (n.mine) ctx.blastBreakables(c, R);
    // me: my own grenade, or anyone else's that went off on my screen
    const d = this.center.distanceTo(c);
    if (this.alive && d < R * 0.95) {
      this.takeDamage(10 + 34 * (1 - d / (R * 0.95)), c);
      this.knockback(_v.subVectors(this.center, c).normalize(), 9);
    }
    // other players in a versus match, decided by the thrower only
    if (n.mine) {
      for (const target of ctx.targets()) {
        if (target.isLocal || !target.alive || !ctx.canHurt(target)) continue;
        const dd = target.center.distanceTo(c);
        if (dd < R * 0.95) target.takeDamage(12 + 50 * (1 - dd / (R * 0.95)), c);
      }
    }
  }

  /** Snapshot of this frame's input and movement for the current weapon. */
  _weaponState(sprinting: boolean, aiming: boolean, hs: number): WeaponInput {
    const inp = this.ctx.input;
    const b = this.body;
    return {
      fire: inp.down('fire'),
      firePressed: inp.pressed('fire'),
      aim: aiming || (inp.down('aim') && this.weapon.kind === 'katana'),
      reloadPressed: inp.pressed('reload'),
      meleePressed: inp.pressed('melee') && this.weapon.kind === 'katana',
      sprinting,
      grounded: b.onGround,
      speed: hs,
      sliding: this.sliding,
      lookDelta: inp.look,
      strafe: this._mv.x,
      bobPhase: this.bobPhase,
      bobAmt: this.bobAmt,
      landDip: clamp(-this.landDip.value * 0.08, -0.5, 0.5),
      slideTilt: this.sliding ? 1 : 0,
      blockFire: !this.alive,
    };
  }

  private _startSlide(hs: number): void {
    this.sliding = true;
    this.slideT = 0;
    const b = this.body;
    const boost = clamp(12.8 - hs, 0, 4.5);
    b.vel.x += (b.vel.x / hs) * boost;
    b.vel.z += (b.vel.z / hs) * boost;
    audio.slide();
    this.kickFov(2.5);
    this.landDip.kick(-2.5);
  }

  private _dash(dir: THREE.Vector3): void {
    const b = this.body;
    this.dashCd = 1.3;
    const cur = b.vel.x * dir.x + b.vel.z * dir.z;
    const target = Math.max(cur + 6, 14);
    b.vel.x += dir.x * (target - cur);
    b.vel.z += dir.z * (target - cur);
    b.vel.y = Math.max(b.vel.y, 2);
    audio.dash();
    this.kickFov(4);
    this.ctx.input.rumble(0.3, 0.6, 70);
    this.roll += (dir.x * this.right.x + dir.z * this.right.z) * 0.08;
    _v2.copy(this.center).addScaledVector(dir, -0.6);
    this.ctx.effects.strokeBurst(_v2, INK.BLUE, 10, 5, { life: 0.25, size: 0.03 });
  }

  /** Climb onto a ledge in front of us if there is one in reach and room to stand on it. */
  private _tryMantle(fwd: THREE.Vector3): void {
    const b = this.body;
    const world = this.ctx.world;
    _v2.set(b.pos.x, b.pos.y + 1.0, b.pos.z);
    if (!world.raycast(_v2, fwd, 0.95)) return;
    _v2.set(b.pos.x + fwd.x * 0.95, b.pos.y + 2.75, b.pos.z + fwd.z * 0.95);
    const top = world.raycast(_v2, _down, 2.25);
    if (!top || top.normal.y < 0.5) return;
    const dy = top.point.y - b.pos.y;
    if (dy < 0.5 || dy > 2.4) return;
    const hw = b.halfW;
    if (
      world.overlapsAABB(
        { x: _v2.x - hw, y: top.point.y + 0.08, z: _v2.z - hw },
        { x: _v2.x + hw, y: top.point.y + CROUCH_H, z: _v2.z + hw },
      )
    ) {
      return;
    }
    b.vel.y = Math.min(11, Math.sqrt(2 * G * (dy + 0.45)));
    b.vel.x = fwd.x * 3.2;
    b.vel.z = fwd.z * 3.2;
    this.mantleCd = 0.7;
    audio.mantle();
    this.landDip.kick(-2.5);
    this.kickFov(1.5);
  }

  /** Where the grapple rope leaves from (the off hand, low and to the left). */
  private _handPos(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.eye).addScaledVector(this.right, -0.55).addScaledVector(this.forward, 0.9);
    out.y -= 0.42;
    return out;
  }

  // What the crosshair is on wins. Enemies and rings only get a small amount of assist, and
  // only when they are genuinely near the aim line and not behind whatever you are pointing at,
  // so the hook stops jumping to rings above your head that you never aimed at.
  private _findGrappleTarget(): GrappleTarget | null {
    const ctx = this.ctx;
    const o = this.eye;
    const d = this.forward;
    const maxD = 75;
    const hitW = ctx.world.raycast(o, d, maxD, NO_GRAPPLE);
    const wallDist = hitW ? hitW.dist : maxD;
    // exact hit on an enemy
    const hitE = ctx.enemies.raycast(o, d, Math.min(50, wallDist + 0.5));
    if (hitE) return { point: hitE.point.clone(), enemy: hitE.enemy, dist: hitE.dist };
    // things that move and can be swung from (paper planes): a forgiving sphere test
    let mBest: GrappleTarget | null = null;
    let mLat = Infinity;
    for (const mv of ctx.level.grappleMovers) {
      _v.subVectors(mv.mesh.position, o);
      const along = _v.dot(d);
      if (along < 2 || along > Math.min(maxD, wallDist + 1)) continue;
      const lat = Math.sqrt(Math.max(0, _v.lengthSq() - along * along));
      if (lat < mv.radius + 0.3 + along * 0.012 && lat < mLat) {
        mLat = lat;
        mBest = { point: mv.mesh.position.clone(), mover: mv, dist: along };
      }
    }
    if (mBest) return mBest;
    // near miss on an enemy: forgiving, but it has to be roughly where you are pointing
    let best: GrappleTarget | null = null;
    let bestLat = Infinity;
    for (const e of ctx.enemies.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      _v.subVectors(e.center, o);
      const along = _v.dot(d);
      if (along < 1.5 || along > Math.min(45, wallDist + 1.5)) continue;
      const lat = Math.sqrt(Math.max(0, _v.lengthSq() - along * along));
      const tol = 1.1 + along * 0.06; // a few degrees of help, no more
      if (lat > tol || lat >= bestLat) continue;
      if (!ctx.world.hasLineOfSight(o, e.center)) continue;
      best = { point: e.center.clone(), enemy: e, dist: along };
      bestLat = lat;
    }
    if (best) return best;
    // grapple rings: only a slim amount of magnetism, and never through a wall
    let ring: THREE.Vector3 | null = null;
    let ringT = Infinity;
    let ringLat = Infinity;
    for (const r of ctx.level.rings) {
      _v.subVectors(r, o);
      const along = _v.dot(d);
      if (along < 2 || along > Math.min(maxD, wallDist + 1.5)) continue;
      const lat = Math.sqrt(Math.max(0, _v.lengthSq() - along * along));
      if (lat > 0.8 + along * 0.02) continue;
      if (lat < ringLat) {
        ring = r;
        ringT = along;
        ringLat = lat;
      }
    }
    if (ring) return { point: ring.clone(), enemy: null, dist: ringT };
    if (hitW) return { point: hitW.point.clone().addScaledVector(hitW.normal, 0.12), enemy: null, dist: hitW.dist };
    return null;
  }

  private _fireGrapple(): void {
    if (this.grapStam < STAM_MIN) {
      audio.winded();
      this.ctx.hud.tip(t('grappleCooldown'), 0.9);
      return;
    }
    const target = this._findGrappleTarget();
    if (!target) {
      audio.empty();
      return;
    }
    this.grapStam -= STAM_FIRE;
    this.stamPause = STAM_PAUSE;
    const g = this.grapple;
    g.state = 'fly';
    g.anchor.copy(target.point);
    this._handPos(g.from);
    g.hook.copy(g.from);
    g.flyT = 0;
    g.flyDur = clamp(target.dist / 110, 0.04, 0.6);
    g.enemy = target.enemy || null;
    g.mover = target.mover || null;
    g.t = 0;
    audio.grappleFire();
    this.ctx.input.rumble(0.15, 0.4, 40);
    this.weapon.recoil.kick(-0.3, 0.2, 0.5);
  }

  /** Let go of the rope; `boost` gives the jump-off kick. */
  detachGrapple(boost: boolean): void {
    const g = this.grapple;
    if (g.state === 'idle') return;
    const was = g.state;
    g.state = 'idle';
    g.cd = 0.12;
    g.enemy = null;
    g.mover = null;
    this.stamPause = STAM_PAUSE;
    this.rope.visible = false;
    this.hookMesh.visible = false;
    audio.reelLoop(false);
    this.ctx.hud.grappleTarget(0);
    if (was === 'on') {
      const b = this.body;
      if (boost) {
        b.vel.y = Math.max(b.vel.y, 0) + 8;
        b.vel.x *= 1.12;
        b.vel.z *= 1.12;
        audio.jump();
        this.kickFov(3);
      } else {
        b.vel.y += 2.5;
        audio.grappleRelease();
      }
    }
  }

  private _updateGrapple(dt: number): void {
    const g = this.grapple;
    const ctx = this.ctx;
    const inp = ctx.input;
    const b = this.body;
    g.cd -= dt;
    if (g.state === 'idle') {
      if (inp.pressed('grapple') && g.cd <= 0) this._fireGrapple();
      g.t += dt;
      if (g.t > 0.08) {
        g.t = 0;
        ctx.hud.grappleTarget(this._findGrappleTarget() ? 1 : 0);
      }
    } else if (g.state === 'fly') {
      if (g.mover) g.anchor.copy(g.mover.mesh.position);
      g.flyT += dt;
      const f = Math.min(1, g.flyT / g.flyDur);
      g.hook.lerpVectors(g.from, g.anchor, f);
      if (f >= 1) {
        if (g.enemy) {
          if (g.enemy.alive) {
            ctx.enemies.yank(g.enemy, this.center);
            ctx.game.addScore(30, t('yanked'));
            audio.grappleHit();
            ctx.input.rumble(0.5, 0.5, 90);
          }
          this.detachGrapple(false);
        } else {
          g.state = 'on';
          g.len = Math.max(1.5, this.center.distanceTo(g.anchor) * 0.94);
          g.blockedT = 0;
          g.t = 0;
          g.swingT = 0;
          audio.grappleHit();
          audio.reelLoop(true);
          ctx.hud.grappleTarget(2);
          ctx.input.rumble(0.3, 0.6, 60);
          if (b.onGround) {
            b.vel.y = Math.max(b.vel.y, 5);
            b.onGround = false;
          }
        }
      }
    } else if (g.state === 'on') {
      if (g.mover) g.anchor.copy(g.mover.mesh.position);
      g.hook.copy(g.anchor);
      g.swingT += dt;
      const c = this.center;
      _d.subVectors(g.anchor, c);
      const dist = _d.length();
      if (dist > 0.01) _d.divideScalar(dist);
      const reeling = inp.down('grapple');
      const vAlong = b.vel.dot(_d);
      if (reeling) {
        g.len = Math.max(1.5, g.len - 14 * dt);
        if (vAlong < 22) b.vel.addScaledVector(_d, 42 * dt);
      } else {
        if (vAlong < 6) b.vel.addScaledVector(_d, 3 * dt);
        // swing pump: holding forward adds energy along the view direction (Spider-Man style)
        if (this._mv.y > 0.3 && c.y < g.anchor.y - 1) {
          _v2.copy(this.forward);
          _v2.y = 0;
          if (_v2.lengthSq() > 0.01) {
            _v2.normalize();
            b.vel.addScaledVector(_v2, 10 * dt);
          }
        }
      }
      if (dist > g.len) {
        const vn = b.vel.dot(_d);
        if (vn < 0) b.vel.addScaledVector(_d, -vn);
        const excess = Math.min(dist - g.len, 0.35) * 0.85;
        b.pos.addScaledVector(_d, excess);
        if (ctx.world.overlapsBody(b)) b.pos.addScaledVector(_d, -excess);
      }
      if (b.onGround && reeling && _d.y > 0.2) {
        b.vel.y = Math.max(b.vel.y, 4.5);
        b.onGround = false;
      }
      g.t += dt;
      if (g.t > 0.15) {
        g.t = 0;
        if (!ctx.world.hasLineOfSight(this.eye, g.anchor)) g.blockedT += 0.15;
        else g.blockedT = 0;
      }
      if (
        inp.pressed('grapple') ||
        dist < 1.3 ||
        g.blockedT > 0.3 ||
        dist > 90 ||
        (b.onGround && g.swingT > 0.6 && !reeling)
      ) {
        this.detachGrapple(dist < 1.3);
      }
    }
    if (g.state !== 'idle') {
      this._handPos(_v3);
      alignYAxis(this.rope, _v3, g.hook, 0.008);
      this.rope.visible = true;
      this.hookMesh.visible = true;
      this.hookMesh.position.copy(g.hook);
      this.hookMesh.quaternion.copy(this.rope.quaternion);
    }
  }

  private _updateCamera(dt: number): void {
    const b = this.body;
    const cam = this.camera;
    const mv = this._mv;
    const targetEye = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eyeH = this.alive ? damp(this.eyeH, targetEye, 14, dt) : this.eyeH;
    this.recoilPitch.update(dt);
    this.recoilYaw.update(dt);
    this.fovKick.update(dt);
    this.landDip.update(dt);
    if (this.alive) this.roll = damp(this.roll, -mv.x * 0.022 + (this.sliding ? -0.08 : 0), 9, dt);
    const sh = this.ctx.effects.shakeAmt;
    this.ctx.effects.shakeAmt = damp(sh, 0, 7, dt);
    const shk = Math.min(sh, 1.2);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.03 * this.bobAmt;
    const bobX = Math.cos(this.bobPhase * 0.5) * 0.018 * this.bobAmt;
    this.eye.set(b.pos.x, b.pos.y + this.eyeH + this.landDip.value * 0.07 + bobY, b.pos.z);
    this.center.set(b.pos.x, b.pos.y + b.height * 0.55, b.pos.z);
    cam.position.copy(this.eye).addScaledVector(this.right, bobX + (Math.random() - 0.5) * shk * 0.07);
    cam.position.y += (Math.random() - 0.5) * shk * 0.07;
    cam.rotation.set(
      this.pitch + this.recoilPitch.value + (Math.random() - 0.5) * shk * 0.035,
      this.yaw + this.recoilYaw.value + (Math.random() - 0.5) * shk * 0.035,
      this.roll + Math.sin(this.bobPhase * 0.5) * 0.004 * this.bobAmt,
    );
    const sp3 = b.vel.length();
    let fov =
      82 +
      clamp((sp3 - 7) / 16, 0, 1) * 8 +
      (this._sprinting ? 3 : 0) +
      (this.sliding ? 4 : 0) +
      (this.grapple.state === 'on' ? 3 : 0) +
      this.fovKick.value;
    if (this._aiming) fov = this.weapon.adsFov;
    this.fov = damp(this.fov, fov, this._aiming ? 16 : 8, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    this.hurtFx = damp(this.hurtFx, 0, 3, dt);
    this.flashFx = damp(this.flashFx, 0, 10, dt);
    this.speed = sp3;
  }
}
