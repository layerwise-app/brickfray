import * as THREE from 'three';
import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import type { Kit } from '../../engine/kit';
import type { Atmosphere } from '../../engine/renderer';
import { MELEES, type MeleeId, type WeaponId } from '../defs';
import { LOADOUTS } from '../loadouts';
import { createRiggedModel, type RiggedModel } from '../model';
import type { ViewAction, ViewCue, ViewInput, ViewModel } from '../types';
import { Arms } from './arms';
import { ClipPlayer, Frame, type Clip, type ClipCtx, type ClipEvent } from './clip';
import { FINGERS, type FingerPose } from './fingers';
import { arReload, pistolReload, shotgunLoadIn, shotgunLoadOut, shotgunPump, shotgunShell, sniperCycle, sniperReload, SLIDE_LOCK } from './clips-guns';
import { drawClip, extraGoals, holsterClip, restClip } from './clips-extra';
import { cookClip, grenadeGoals, throwClip } from './clips-grenade';
import { meleeClip, meleeGoals } from './clips-melee';
import { harpoonReload } from './clips-harpoon';
import { REVOLVER_CYCLE, revolverAction, revolverReload } from './clips-revolver';
import { ViewFx } from './fx';
import { blendMatrices, followPath, goal, goalMatrix } from './goals';
import { ViewLighting } from './lighting';
import { Motion } from './motion';
import { buildGunRig, type GunRig } from './rig';
import { smooth01 } from './springs';
import { surfaceMaterial } from '../surface';

export function createViewModel(kit: Kit): ViewModel {
  return new FirstPersonView(kit);
}

const FADE = 0.12;
/** Seconds the trigger finger takes to relax after a shot. */
const TRIGGER_RESET = 0.14;
/** Where a tool handle's axis sits in the left hand's frame once the fingers close on it. */
const HANDLE_IN_FIST = new THREE.Vector3(-0.001, 0, -0.0075);

/** Which reload and cycling animations each gun uses. */
const RELOAD: Record<WeaponId, 'rifle' | 'pistol' | 'pump' | 'bolt' | 'revolver' | 'harpoon'> = {
  ar: 'rifle',
  nailer: 'rifle',
  pulse: 'rifle',
  shotgun: 'pump',
  sniper: 'bolt',
  harpoon: 'harpoon',
  pistol: 'pistol',
  cannon: 'revolver',
  buzzer: 'pistol'
};
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
  private melee: RiggedModel;
  private readonly grenade: RiggedModel;
  private readonly shell: THREE.Mesh;
  private readonly extra: ReturnType<typeof extraGoals>;
  private readonly ctx: ClipCtx;
  private readonly pinRest: THREE.Vector3;
  private pendingDraw = 0;
  private pendingWeapon: WeaponId | null = null;
  private loading = false;
  private slideLocked = false;
  /** The Harpooner's spear has been fired and not yet replaced. */
  private spearOut = false;
  private slideKick = 1;
  private cylinderKick = 1;
  private sprintCue = false;
  private adsCue = false;
  private fade = 0;
  private fadeTime = FADE;
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
    this.melee = createRiggedModel('mallet', kit, 'first');
    this.grenade = createRiggedModel('grenade', kit, 'first');
    this.arms.left.hand.add(this.melee.model.root, this.grenade.model.root);
    this.melee.model.root.position.copy(HANDLE_IN_FIST);
    this.grenade.model.root.position.set(0.0165, 0.016, -0.002);
    this.shell = new THREE.Mesh(this.fx.shellGeometry, surfaceMaterial(kit.materials));
    this.shell.position.set(0.042, 0.028, 0.0005);
    this.shell.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    this.arms.left.hand.add(this.shell);
    this.pinRest = this.grenade.parts.get('pin')?.position.clone() ?? new THREE.Vector3();
    this.extra = { ...extraGoals(this.scene), ...meleeGoals(this.scene), ...grenadeGoals(this.scene) };
    this.ctx = { id: 'ar', tuning: null!, view: this.scene, goals: {}, flags: { empty: false } };
    this.setCharacter('rivet');
    this.equip('ar');
  }

  setCharacter(id: CharacterId) {
    this.arms.setColors(ROSTER[id]);
    this.setMelee(LOADOUTS[id].melee);
  }

  private setMelee(id: MeleeId) {
    if (this.melee.model.id === id) return;
    this.melee.model.root.removeFromParent();
    this.melee = createRiggedModel(id, this.kit, 'first');
    this.melee.model.root.position.copy(HANDLE_IN_FIST);
    this.arms.left.hand.add(this.melee.model.root);
  }

  equip(id: WeaponId) {
    this.player.stop();
    this.loading = false;
    this.slideLocked = false;
    this.spearOut = false;
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
    this.ctx.goals = { ...rig.goals, ...this.extra, ring: this.ringSeat() };
  }

  /** Where the pin's ring rests on the bomb, in the bomb's own frame: the pin is animated against it. */
  private ringSeat() {
    const at = this.pinRest.clone().add(this.grenade.nodes.get('ring')!.position);
    return goal(this.grenade.model.root, [at.x, at.y, at.z], new THREE.Quaternion());
  }

  act(action: ViewAction) {
    const g = this.gun;
    switch (action.type) {
      case 'fire': {
        this.triggerPull = 1;
        this.motion.kick(this.lastAds);
        this.fx.fire(g.rigged.model.muzzle, g.flash);
        if (g.casing && g.rigged.model.ejectPort) this.fx.eject(g.casing, g.rigged.model.ejectPort);
        if (g.rest.has('slide')) {
          this.slideKick = 0;
          if (action.empty) this.slideLocked = true;
        }
        if (g.rest.has('spear')) this.spearOut = true;
        if (g.rest.has('cylinder')) this.cylinderKick = 0;
        return;
      }
      case 'reload':
        this.ctx.flags.empty = action.empty;
        switch (RELOAD[g.id]) {
          case 'pump':
            this.loading = true;
            return this.play(shotgunLoadIn(action.duration < 0.6 ? action.duration : 0.28));
          case 'rifle':
            return this.play(arReload(action.empty, action.duration));
          case 'bolt':
            return this.play(sniperReload(action.empty, action.duration));
          case 'pistol':
            return this.play(pistolReload(action.empty, action.duration));
          case 'revolver':
            return this.play(revolverReload(action.empty, action.duration));
          case 'harpoon':
            return this.play(harpoonReload(action.empty, action.duration));
        }
        return;
      case 'reloadShell':
        if (RELOAD[g.id] !== 'pump') return;
        this.loading = true;
        return this.play(shotgunShell(action.duration));
      case 'reloadEnd':
      case 'cancelReload':
        if (RELOAD[g.id] === 'pump' && this.loading) {
          this.loading = false;
          const rack = this.ctx.flags.empty;
          return this.play(shotgunLoadOut(rack ? 0.75 : 0.32, rack));
        }
        if (action.type === 'cancelReload' && this.player.clip) this.play(restClip(0.25));
        return;
      case 'cycle':
        if (RELOAD[g.id] === 'pump') return this.play(shotgunPump(action.duration, true));
        if (RELOAD[g.id] === 'bolt') return this.play(sniperCycle(action.duration));
        return;
      case 'melee': {
        const melee = MELEES[this.melee.model.id as MeleeId];
        return this.play(meleeClip(melee.id, melee.cooldown * 0.75, melee.windup));
      }
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
    this.fadeTime = clip.fade ?? FADE;
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
      case 'magIn':
        if (g.rest.has('spear')) this.spearOut = false;
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
    this.cylinderKick = Math.min(1, this.cylinderKick + dt / REVOLVER_CYCLE);
    this.fade = Math.max(0, this.fade - dt / this.fadeTime);
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
    this.poseHands(k, dt);
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
      } else if ((name === 'cylinder' || name === 'hammer') && this.gun.rest.has('cylinder')) {
        part.quaternion.multiply(revolverAction(name, this.cylinderKick, this.tmpQ));
      }
      if (name === 'spear') part.visible = !this.spearOut || !!o;
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

  private triggerPull = 0;
  private readonly firingFingers: FingerPose = { ...FINGERS.trigger };

  private poseHands(k: number, dt: number) {
    const f = this.frame;
    const g = this.ctx.goals;
    const grip = this.gun.tuning.fingers;
    // The index finger squeezes on each shot and lets go just after.
    this.triggerPull = Math.max(0, this.triggerPull - dt / TRIGGER_RESET);
    Object.assign(this.firingFingers, grip.right);
    this.firingFingers.index += (FINGERS.squeeze.index - FINGERS.trigger.index) * this.triggerPull;
    const held = f.show.mallet ? FINGERS.handle : f.show.grenade ? FINGERS.ball : f.show.shell ? FINGERS.pinch : grip.left;
    const onGrip = !f.right || (f.right.from === g.rightRest && f.right.to === g.rightRest);
    this.arms.setFingers(f.rightFingers ?? this.firingFingers, f.leftFingers ?? held, dt, onGrip);
    const left = f.left ? followPath(f.left, this.tmpM) : goalMatrix(g.leftRest!, this.tmpM);
    if (this.fade > 0) blendMatrices(this.fadeLeft, left, k, this.leftMat);
    else this.leftMat.copy(left);
    this.leftMat.decompose(this.arms.left.hand.position, this.arms.left.hand.quaternion, this.tmpV);
    this.arms.left.hand.scale.copy(ONE);
    this.melee.model.root.visible = f.show.mallet;
    this.grenade.model.root.visible = f.show.grenade;
    const pin = this.grenade.parts.get('pin');
    const pinOffset = f.parts.get('pin');
    if (pin) {
      pin.visible = f.show.pin;
      pin.position.set(this.pinRest.x + (pinOffset?.[0] ?? 0), this.pinRest.y + (pinOffset?.[1] ?? 0), this.pinRest.z + (pinOffset?.[2] ?? 0));
    }
    this.shell.visible = f.show.shell;
    this.arms.left.hand.updateMatrixWorld(true);
    const right = f.right ? followPath(f.right, this.tmpM) : goalMatrix(g.rightRest!, this.tmpM);
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
