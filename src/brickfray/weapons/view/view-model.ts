import * as THREE from 'three';
import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import type { Kit } from '../../engine/kit';
import type { Atmosphere } from '../../engine/renderer';
import type { WeaponId } from '../defs';
import { createRiggedModel, type RiggedModel } from '../model';
import type { ViewAction, ViewCue, ViewInput, ViewModel } from '../types';
import { Arms } from './arms';
import { ClipPlayer, Frame, type Clip, type ClipCtx, type ClipEvent } from './clip';
import { arReload, pistolReload, shotgunLoadIn, shotgunLoadOut, shotgunPump, shotgunShell, sniperCycle, sniperReload, SLIDE_LOCK } from './clips-guns';
import { cookClip, drawClip, extraGoals, holsterClip, meleeClip, restClip, throwClip } from './clips-extra';
import { ViewFx } from './fx';
import { blendGoals, blendMatrices, goal, holdQuat } from './goals';
import { ViewLighting } from './lighting';
import { Motion } from './motion';
import { buildGunRig, type GunRig } from './rig';
import { smooth01 } from './springs';
import { surfaceMaterial } from '../surface';

export function createViewModel(kit: Kit): ViewModel {
  return new FirstPersonView(kit);
}

const FADE = 0.12;
const ONE = new THREE.Vector3(1, 1, 1);
const IDLE: ViewInput = { speed: 0, sprint: false, grounded: true, crouch: 0, ads: 0, look: { yaw: 0, pitch: 0 }, time: 0 };

class FirstPersonView implements ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(54, 16 / 10, 0.01, 30);
  onCue: ((cue: ViewCue) => void) | null = null;
  private readonly lighting: ViewLighting;
  private readonly arms: Arms;
  private readonly fx: ViewFx;
  private readonly guns = new Map<WeaponId, GunRig>();
  private gun!: GunRig;
  private readonly motion = new Motion();
  private readonly player = new ClipPlayer();
  private readonly frame = new Frame();
  private readonly mallet: RiggedModel;
  private readonly grenade: RiggedModel;
  private readonly shell: THREE.Mesh;
  private readonly extra: ReturnType<typeof extraGoals>;
  private readonly ctx: ClipCtx;
  private readonly pinRest: THREE.Vector3;
  private pendingDraw = 0;
  private pendingWeapon: WeaponId | null = null;
  private loading = false;
  private slideLocked = false;
  private slideKick = 1;
  private sprintCue = false;
  private adsCue = false;
  private fade = 0;
  private readonly fadeGunPos = new THREE.Vector3();
  private readonly fadeGunRot = new THREE.Vector3();
  private readonly fadeLeft = new THREE.Matrix4();
  private readonly fadeRight = new THREE.Matrix4();
  private readonly lastGunPos = new THREE.Vector3();
  private readonly lastGunRot = new THREE.Vector3();
  private readonly leftMat = new THREE.Matrix4();
  private readonly rightMat = new THREE.Matrix4();

  constructor(private readonly kit: Kit) {
    this.camera.updateMatrixWorld();
    this.lighting = new ViewLighting(this.scene, kit);
    this.arms = new Arms(kit);
    this.scene.add(this.arms.root);
    this.fx = new ViewFx(this.scene, kit);
    this.mallet = createRiggedModel('mallet', kit, 'first');
    this.grenade = createRiggedModel('grenade', kit, 'first');
    this.arms.left.hand.add(this.mallet.model.root, this.grenade.model.root);
    this.grenade.model.root.position.set(-0.004, 0.034, -0.004);
    this.shell = new THREE.Mesh(this.fx.shellGeometry, surfaceMaterial(kit.materials));
    this.shell.position.set(-0.012, 0.05, -0.03);
    this.shell.quaternion.setFromEuler(new THREE.Euler(-0.4, 0, 0));
    this.arms.left.hand.add(this.shell);
    this.pinRest = this.grenade.parts.get('pin')?.position.clone() ?? new THREE.Vector3();
    this.extra = extraGoals(this.scene);
    this.ctx = { id: 'ar', tuning: null!, view: this.scene, goals: {}, flags: { empty: false } };
    this.setCharacter('rivet');
    this.equip('ar');
  }

  setCharacter(id: CharacterId) {
    this.arms.setColors(ROSTER[id]);
  }

  equip(id: WeaponId) {
    this.player.stop();
    this.loading = false;
    this.slideLocked = false;
    this.fade = 0;
    this.pendingWeapon = null;
    this.setGun(id);
    this.motion.reset();
  }

  private setGun(id: WeaponId) {
    if (this.gun) this.gun.rigged.model.root.removeFromParent();
    let rig = this.guns.get(id);
    if (!rig) {
      rig = buildGunRig(id, this.kit);
      this.guns.set(id, rig);
    }
    this.gun = rig;
    this.scene.add(rig.rigged.model.root);
    this.motion.setTuning(rig.tuning);
    this.ctx.id = id;
    this.ctx.tuning = rig.tuning;
    this.ctx.goals = { ...rig.goals, ...this.extra, ring: goal(this.grenade.nodes.get('ring')!, [0.004, -0.028, 0.03], holdQuat([-1, 0.25, 0], [0.2, 0.3, -1])) };
  }

  act(action: ViewAction) {
    const g = this.gun;
    switch (action.type) {
      case 'fire': {
        this.motion.kick(this.lastAds);
        this.fx.fire(g.rigged.model.muzzle, g.flash);
        if (g.casing && g.rigged.model.ejectPort) this.fx.eject(g.casing, g.rigged.model.ejectPort);
        if (g.id === 'pistol') {
          this.slideKick = 0;
          if (action.empty) this.slideLocked = true;
        }
        return;
      }
      case 'reload':
        this.ctx.flags.empty = action.empty;
        if (g.id === 'shotgun') {
          this.loading = true;
          return this.play(shotgunLoadIn(action.duration < 0.6 ? action.duration : 0.28));
        }
        if (g.id === 'ar') return this.play(arReload(action.empty, action.duration));
        if (g.id === 'sniper') return this.play(sniperReload(action.empty, action.duration));
        return this.play(pistolReload(action.empty, action.duration));
      case 'reloadShell':
        if (g.id !== 'shotgun') return;
        this.loading = true;
        return this.play(shotgunShell(action.duration));
      case 'reloadEnd':
      case 'cancelReload':
        if (g.id === 'shotgun' && this.loading) {
          this.loading = false;
          const rack = this.ctx.flags.empty;
          return this.play(shotgunLoadOut(rack ? 0.75 : 0.32, rack));
        }
        if (action.type === 'cancelReload' && this.player.clip) this.play(restClip(0.25));
        return;
      case 'cycle':
        if (g.id === 'shotgun') return this.play(shotgunPump(action.duration, true));
        if (g.id === 'sniper') return this.play(sniperCycle(action.duration));
        return;
      case 'melee':
        return this.play(meleeClip());
      case 'grenadeCook':
        return this.play(cookClip());
      case 'grenadeThrow':
        // The host throws on release, so a quick tap skips the rest of the cook and blends straight into the throw.
        return this.play(throwClip(action.low));
      case 'switch':
        this.pendingWeapon = action.to;
        this.pendingDraw = action.draw;
        this.loading = false;
        return this.play(holsterClip(Math.max(0.05, action.holster)));
      case 'land':
        return this.motion.landImpulse(action.impact);
      case 'hurt':
        return this.motion.hurt(action.strength);
    }
  }

  private play(clip: Clip) {
    this.fade = 1;
    this.fadeGunPos.copy(this.lastGunPos);
    this.fadeGunRot.copy(this.lastGunRot);
    this.fadeLeft.copy(this.leftMat);
    this.fadeRight.copy(this.rightMat);
    this.player.play(clip);
  }

  private onEvent = (e: ClipEvent) => {
    const g = this.gun;
    switch (e) {
      case 'eject':
        if (g.rigged.model.ejectPort) this.fx.eject(g.id === 'sniper' ? 'long' : 'brass', g.rigged.model.ejectPort, 0.8);
        return;
      case 'shellEject':
        if (g.rigged.model.ejectPort) this.fx.eject('shell', g.rigged.model.ejectPort, 0.9);
        return;
      case 'swap':
        if (this.pendingWeapon) {
          const draw = this.pendingDraw;
          this.setGun(this.pendingWeapon);
          this.pendingWeapon = null;
          this.slideLocked = false;
          this.play(drawClip(Math.max(0.05, draw)));
          this.fade = 0;
        }
        return;
      case 'slideForward':
        this.slideLocked = false;
        break;
      case 'shellLoaded':
      case 'release':
      case 'boltRelease':
        return;
    }
    this.onCue?.(e as ViewCue);
  };

  private lastAds = 0;

  update(dt: number, input: ViewInput = IDLE) {
    const f = this.frame;
    f.reset();
    this.player.update(dt, this.onEvent);
    this.player.clip?.sample(this.player.u, f, this.ctx);
    this.slideKick = Math.min(1, this.slideKick + dt / 0.1);
    this.fade = Math.max(0, this.fade - dt / FADE);
    const k = smooth01(1 - this.fade);

    const ads = smooth01(input.ads * (1 - f.busy));
    this.lastAds = ads;
    if (input.ads > 0.05 && !this.adsCue) this.onCue?.('cloth');
    this.adsCue = input.ads > 0.05;
    this.motion.update(dt, input, ads, f.busy);
    const sprinting = this.motion.sprint > 0.5;
    if (sprinting && !this.sprintCue) this.onCue?.('cloth');
    this.sprintCue = sprinting;

    this.poseGun(ads, k);
    this.poseHands(k);
    this.fx.update(dt);
    this.camera.updateMatrixWorld();
  }

  private readonly basePos = new THREE.Vector3();
  private readonly baseQuat = new THREE.Quaternion();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpE = new THREE.Euler();

  private poseGun(ads: number, k: number) {
    const t = this.gun.tuning;
    const f = this.frame;
    const s = this.gun.sight;
    this.basePos.set(...t.hip);
    this.baseQuat.setFromEuler(this.tmpE.set(...t.hipRot));
    this.tmpV.set(-s.x, -s.y, -s.z - t.eye);
    this.basePos.lerp(this.tmpV, ads);
    this.basePos.x += -0.012 * Math.sin(Math.PI * ads);
    this.basePos.y += -0.016 * Math.sin(Math.PI * ads);
    this.basePos.z += 0.02 * Math.sin(Math.PI * ads);
    this.baseQuat.slerp(this.tmpQ.identity(), ads);
    const sprint = this.motion.sprint * (1 - ads);
    if (sprint > 1e-3) {
      this.basePos.lerp(this.tmpV.set(...t.sprint), sprint);
      this.baseQuat.slerp(this.tmpQ.setFromEuler(this.tmpE.set(...t.sprintRot)), sprint);
    }
    // Clip offsets cross-fade from the last pose when a clip starts.
    this.lastGunPos.copy(this.fadeGunPos).lerp(f.gunPos, k);
    this.lastGunRot.copy(this.fadeGunRot).lerp(f.gunRot, k);
    const root = this.gun.rigged.model.root;
    root.position.copy(this.basePos).add(this.lastGunPos).add(this.motion.pos);
    this.tmpV.copy(this.lastGunRot).add(this.motion.rot);
    root.quaternion.copy(this.baseQuat).multiply(this.tmpQ.setFromEuler(this.tmpE.set(this.tmpV.x, this.tmpV.y, this.tmpV.z)));

    // Moving parts: rest pose plus clip offsets; the pistol slide also kicks per shot.
    for (const [name, rest] of this.gun.rest) {
      const part = this.gun.rigged.parts.get(name)!;
      const o = f.parts.get(name);
      part.position.copy(rest.pos);
      part.quaternion.copy(rest.quat);
      if (o) {
        part.position.x += o[0] ?? 0;
        part.position.y += o[1] ?? 0;
        part.position.z += o[2] ?? 0;
        part.quaternion.multiply(this.tmpQ.setFromEuler(this.tmpE.set(o[3] ?? 0, o[4] ?? 0, o[5] ?? 0)));
      } else if (name === 'slide') {
        part.position.z += this.slideLocked ? SLIDE_LOCK : this.slideOffset();
      }
    }
    root.updateMatrixWorld(true);
    // Shots leave from the screen center, so an aimed sight must stay on it; sway, bob and recoil swing the gun around the dot.
    const dot = this.gun.rigged.model.sight;
    if (ads > 0 && dot) {
      dot.getWorldPosition(this.tmpV);
      root.position.x -= this.tmpV.x * ads;
      root.position.y -= this.tmpV.y * ads;
      root.updateMatrixWorld(true);
    }
  }

  private slideOffset() {
    const t = this.slideKick;
    if (t >= 1) return 0;
    return SLIDE_LOCK * (t < 0.25 ? t / 0.25 : 1 - smooth01((t - 0.25) / 0.75));
  }

  private poseHands(k: number) {
    const f = this.frame;
    const g = this.ctx.goals;
    const left = f.left[0] ? blendGoals(f.left[0], f.left[1], f.left[2], this.tmpM) : blendGoals(g.leftRest!, null, 0, this.tmpM);
    if (this.fade > 0) blendMatrices(this.fadeLeft, left, k, this.leftMat);
    else this.leftMat.copy(left);
    this.leftMat.decompose(this.arms.left.hand.position, this.arms.left.hand.quaternion, this.tmpV);
    this.arms.left.hand.scale.copy(ONE);
    this.mallet.model.root.visible = f.show.mallet;
    this.grenade.model.root.visible = f.show.grenade;
    const pin = this.grenade.parts.get('pin');
    const pinOffset = f.parts.get('pin');
    if (pin) {
      pin.visible = f.show.pin;
      pin.position.set(this.pinRest.x + (pinOffset?.[0] ?? 0), this.pinRest.y + (pinOffset?.[1] ?? 0), this.pinRest.z + (pinOffset?.[2] ?? 0));
    }
    this.shell.visible = f.show.shell;
    this.arms.left.hand.updateMatrixWorld(true);
    const right = f.right[0] ? blendGoals(f.right[0], f.right[1], f.right[2], this.tmpM) : blendGoals(g.rightRest!, null, 0, this.tmpM);
    if (this.fade > 0) blendMatrices(this.fadeRight, right, k, this.rightMat);
    else this.rightMat.copy(right);
    this.tmpV.copy(this.motion.pos).multiplyScalar(0.4);
    this.arms.pose(this.rightMat, this.leftMat, this.tmpV);
  }

  private readonly tmpM = new THREE.Matrix4();

  muzzleViewPosition(out: THREE.Vector3) {
    return this.gun.rigged.model.muzzle.getWorldPosition(out);
  }

  setHidden(hidden: boolean) {
    this.gun.rigged.model.root.visible = !hidden;
    this.arms.root.visible = !hidden;
  }

  orient(worldCameraQuaternion: THREE.Quaternion) {
    this.lighting.orient(worldCameraQuaternion);
  }

  setAtmosphere(atmosphere: Atmosphere) {
    this.lighting.setAtmosphere(atmosphere);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.lighting.dispose();
    this.fx.dispose();
    this.arms.mesh.geometry.dispose();
    for (const rig of this.guns.values()) rig.rigged.model.dispose();
    this.scene.clear();
  }
}
