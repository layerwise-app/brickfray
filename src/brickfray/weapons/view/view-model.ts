import * as THREE from 'three';
import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import type { Kit } from '../../engine/kit';
import type { Atmosphere } from '../../engine/renderer';
import { MELEES, type WeaponId } from '../defs';
import { aimLenses } from '../surface';
import { LOADOUTS } from '../loadouts';
import type { ViewAction, ViewCue, ViewInput, ViewModel } from '../types';
import { GunAction } from './action';
import { Arms } from './arms';
import { Carry } from './blend';
import { ClipPlayer, Frame, type Clip, type ClipCtx, type ClipEvent } from './clip';
import { Drops } from './drops';
import { cycleClip, loadsShells, reloadClip, shotgunLoadOut, shotgunShell } from './clips-guns';
import { reseatClip, reseats } from './clips-rifles';
import { extraGoals, restClip } from './clips-extra';
import { blueHull, Saddle } from './saddle';
import { cookClip, grenadeGoals, throwClip } from './clips-grenade';
import { MELEE_CONTACT, meleeClip, meleeGoals, meleeWeight } from './clips-melee';
import { HitStop } from './hit-stop';
import { ViewFx } from './fx';
import { THUMB_JOINT } from './hand';
import { Held } from './held';
import { ViewLighting } from './lighting';
import { Motion } from './motion';
import { Parts } from './parts';
import { ViewPose } from './pose';
import { GunRack } from './rack';
import { ScopeOverlay } from './scope';
import type { GunRig } from './rig';
import { smooth01 } from './springs';
import { Switcher } from './switching';

export function createViewModel(kit: Kit, character: CharacterId = 'rivet'): ViewModel {
  return new FirstPersonView(kit, character);
}

/** Seconds a clip takes over from the one it cuts in on, unless it names its own. */
const FADE = 0.12;
/** A shot fired from a gun held far off its firing pose (out of a shell-by-shell reload) goes off on the same frame, its flash riding the muzzle as the gun swings back up over SNAP_SPAN. */
const SNAP_SPAN = 0.08;
/** How far off (radians of clip offset, or a quarter as many meters) counts as far. */
const ASTRAY = 0.32;
const BUSY_RAMP = 0.08;
const CARRY_LEAD = 0.3;
/** Seconds per radian (or quarter meter) the gun is off its rest that a strike takes to tuck it away. */
const TUCK = 0.34;
const IDLE: ViewInput = { speed: 0, sprint: false, grounded: true, crouch: 0, sliding: false, ads: 0, look: { yaw: 0, pitch: 0 }, time: 0 };

class FirstPersonView implements ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(54, 16 / 10, 0.01, 30);
  onCue: ((cue: ViewCue) => void) | null = null;
  private readonly lighting: ViewLighting;
  private readonly arms: Arms;
  private readonly fx: ViewFx;
  private readonly rack: GunRack;
  private gun!: GunRig;
  private readonly motion = new Motion();
  get stepPhase() {
    return this.motion.phase;
  }
  private readonly player = new ClipPlayer();
  private readonly frame = new Frame();
  private readonly held: Held;
  private readonly parts = new Parts();
  private readonly drops: Drops;
  private readonly extra: ReturnType<typeof extraGoals>;
  private readonly ctx: ClipCtx;
  private readonly switcher: Switcher;
  private loading = false;
  private readonly saddle = new Saddle();
  private readonly action = new GunAction();
  private sprintCue = false;
  private adsCue = false;
  private readonly carry = new Carry();
  private readonly pose: ViewPose;
  private readonly scope: ScopeOverlay;
  private readonly hitStop = new HitStop();
  private hidden = false;
  private readonly tmpV = new THREE.Vector3();

  constructor(
    private readonly kit: Kit,
    character: CharacterId
  ) {
    this.camera.updateMatrixWorld();
    this.lighting = new ViewLighting(this.scene, kit);
    this.arms = new Arms(kit);
    this.scene.add(this.arms.root);
    this.fx = new ViewFx(this.scene, kit);
    this.held = new Held(kit, this.scene, this.arms.left.hand, this.arms.right.joints[THUMB_JOINT + 2]!, this.fx.shellGeometry, this.fx.blueShell);
    this.drops = new Drops(this.scene);
    this.extra = { ...extraGoals(this.scene), ...meleeGoals(this.scene), ...grenadeGoals(this.scene), ring: this.held.ringSeat(), ringHook: this.held.ringHook() };
    this.ctx = { id: 'ar', tuning: null!, view: this.scene, goals: {}, flags: { empty: false }, ads: 0 };
    this.pose = new ViewPose(this.arms, this.held, this.carry, this.motion, this.parts, this.action, this.camera);
    this.rack = new GunRack(kit, this.scene);
    this.scope = new ScopeOverlay(this.scene, this.camera);
    this.switcher = new Switcher({
      player: this.player,
      camera: this.camera,
      gun: () => this.gun,
      play: (clip) => this.play(clip),
      setGun: (id) => this.setGun(id),
      outside: (rig, offset, margin) => this.pose.outside(rig, offset, margin),
      fresh: () => {
        this.carry.reset();
        this.parts.reset();
        this.held.reset();
      }
    });
    this.setCharacter(character);
    this.equip(LOADOUTS[character].primary);
  }

  setCharacter(id: CharacterId) {
    const loadout = LOADOUTS[id];
    this.arms.setColors(ROSTER[id]);
    this.held.setMelee(loadout.melee);
    this.rack.stock(loadout, this.gun);
  }

  equip(id: WeaponId) {
    this.player.stop();
    this.loading = false;
    this.busy = this.carrying = 0;
    this.action.reset();
    this.carry.reset();
    this.parts.reset();
    this.held.reset();
    this.drops.clear();
    this.switcher.reset();
    this.setGun(id);
    this.motion.reset();
  }

  private setGun(id: WeaponId) {
    const rig = this.rack.swap(this.gun, id);
    this.gun = rig;
    this.motion.setTuning(rig.tuning);
    this.saddle.reset();
    this.parts.refilled.clear();
    if (reseats(id)) this.parts.refilled.add('magazine');
    this.ctx.id = id;
    this.ctx.tuning = rig.tuning;
    this.ctx.goals = { ...rig.goals, ...this.extra };
    return rig;
  }

  act(action: ViewAction) {
    const g = this.gun;
    switch (action.type) {
      case 'fire':
        if (this.carry.gunRot.value.length() > ASTRAY || this.carry.gunPos.value.length() > ASTRAY / 4) this.play(restClip(0.2), SNAP_SPAN);
        return this.shoot(action.empty);
      case 'reload':
        this.ctx.flags.empty = action.empty;
        this.loading = loadsShells(g.id);
        return this.play(reloadClip(g.id, action.empty, action.duration, this.saddle.slot(g, 0)));
      case 'reloadShell': {
        if (!loadsShells(g.id)) return;
        this.loading = true;
        const take = this.saddle.slot(g, 0);
        this.held.shellHull(blueHull(take));
        this.play(shotgunShell(action.duration, take, this.saddle.slot(g, 1)));
        if (take !== null) this.saddle.take();
        return;
      }
      case 'reloadEnd':
      case 'cancelReload':
        if (this.loading) {
          this.loading = false;
          const rack = this.ctx.flags.empty;
          return this.play(shotgunLoadOut(rack ? 0.75 : 0.32, rack));
        }
        if (action.type === 'cancelReload' && this.player.clip) this.play(restClip(0.25));
        return;
      case 'cycle': {
        const cycle = cycleClip(g.id, action.duration);
        if (cycle) this.play(cycle);
        return;
      }
      case 'melee': {
        const melee = MELEES[this.held.meleeId];
        this.play(meleeClip(melee.id, melee.cooldown * 0.75, melee.windup));
        return this.hitStop.strike(this.player.clip!, MELEE_CONTACT[melee.id]);
      }
      case 'grenadeCook':
        return this.play(cookClip());
      case 'grenadeThrow':
        // The host throws on release, so a quick tap skips the rest of the cook and goes straight into the throw.
        return this.play(throwClip(action.low, this.player.clip?.name === 'cook' ? this.player.time : Infinity));
      case 'switch':
        this.loading = false;
        return this.switcher.request(action.to, action.holster, action.draw);
      case 'land':
        return this.motion.landImpulse(action.impact);
      case 'hurt':
        return this.motion.hurt(action.strength);
    }
  }

  private shoot(empty: boolean) {
    const g = this.gun;
    const spear = g.rigged.parts.get('spear');
    if (spear?.visible && !this.action.gone(g, 'spear')) this.fx.launch(spear, g.rigged.model.muzzle);
    this.action.fire(g, empty);
    this.motion.kick(this.lastAds);
    // Through the scope the shot is the lens's own flash and smoke; the put-away gun shows nothing.
    if (this.scope.up) return this.scope.fire();
    this.fx.fire(g.rigged.model.muzzle, g.flash, this.lastAds);
    if (g.casing && g.rigged.model.ejectPort) this.fx.eject(g.casing, g.rigged.model.ejectPort, 1, this.lastAds);
  }

  /** `swing`: seconds the gun takes to come over to the new clip, when not the usual. */
  private play(clip: Clip, swing?: number) {
    // Whatever the cut-off clip left in the left hand is let go: a shell, a magazine or a spear falls, a melee weapon goes down with the hand.
    if (this.frame.show.shell && !this.held.thumbHome(this.ctx.goals.shellInside)) this.fx.eject('shell', this.held.shell, 0.22);
    this.frame.show.shell = 0;
    this.held.interrupt();
    if (this.parts.capture(this.gun, this.drops)) this.onCue?.('magIn');
    const span = clip.fade ?? FADE;
    // A strike cutting in on a gun held far off its rest (a reload, a bolt cycle) tucks it away over a few frames, not one.
    const tuck = clip.instant ? TUCK * (this.carry.gunRot.value.length() + 4 * this.carry.gunPos.value.length()) : 0;
    this.carry.cut(span, swing ?? Math.max(FADE, span, tuck), clip.instant);
    const from = this.extra.leftFrom!;
    this.carry.left.matrix.decompose(from.pos, from.quat, this.tmpV);
    this.player.play(clip);
  }

  private onEvent = (e: ClipEvent) => {
    const g = this.gun;
    switch (e) {
      case 'eject':
        // A revolver's empties leave on the moon clip its reload carries; its eject only cues the sound.
        if (g.rigged.model.ejectPort && !this.scope.up && !g.rest.has('speedloader')) this.fx.eject(g.id === 'sniper' ? 'long' : 'brass', g.rigged.model.ejectPort, 0.8);
        return;
      case 'shellEject':
        if (g.rigged.model.ejectPort) this.fx.eject('shell', g.rigged.model.ejectPort, 0.9, this.lastAds);
        return;
      case 'swap':
        return this.switcher.swap();
      case 'slideForward':
        this.action.release(g);
        break;
      case 'magIn':
        this.action.seat(g);
        break;
      case 'boltRelease':
        this.action.release(g);
        return;
      case 'shellLoaded':
      case 'release':
        return;
    }
    this.onCue?.(e as ViewCue);
  };

  private lastAds = 0;
  private busy = 0;
  /** How much the running clip keeps the gun out of the sprint carry, looking CARRY_LEAD ahead so the carry is back as the action ends. */
  private carrying = 0;
  private readonly ahead = new Frame();

  private carryHold(busy: number, input: ViewInput) {
    const clip = this.player.clip;
    if (!clip || !input.sprint || busy <= 0) return busy;
    this.ahead.reset();
    clip.sample(Math.min(1, this.player.u + CARRY_LEAD / clip.duration), this.ahead, this.ctx);
    return Math.min(busy, this.ahead.busy);
  }

  update(dt: number, input: ViewInput = IDLE) {
    const f = this.frame;
    f.reset();
    this.player.update(this.hitStop.step(dt, this.player), this.onEvent);
    if (this.hitStop.started) this.motion.knock(meleeWeight(this.held.meleeId));
    this.switcher.update();
    if (!this.player.clip && this.parts.lacks('magazine') && this.parts.refilled.has('magazine')) this.play(reseatClip(this.gun.id));
    this.ctx.ads = input.ads;
    this.player.clip?.sample(this.player.u, f, this.ctx);
    this.action.update(dt);

    // A cut can switch a clip's hold on the aim on or off at once; the gun still takes a moment to follow.
    this.busy += THREE.MathUtils.clamp(f.busy - this.busy, -dt / BUSY_RAMP, dt / BUSY_RAMP);
    const ads = smooth01(input.ads * (1 - this.busy));
    this.lastAds = ads;
    aimLenses(this.kit.materials, ads);
    if (input.ads > 0.05 && !this.adsCue) this.onCue?.('cloth');
    this.adsCue = input.ads > 0.05;
    this.carrying += THREE.MathUtils.clamp(this.carryHold(f.busy, input) - this.carrying, -dt / BUSY_RAMP, dt / BUSY_RAMP);
    this.motion.update(dt, input, ads, this.carrying);
    const sprinting = this.motion.sprint > 0.5;
    if (sprinting && !this.sprintCue) this.onCue?.('cloth');
    this.sprintCue = sprinting;

    this.scope.update(dt, this.gun.id, input.ads, this.motion.rot, this.motion.pos.z);
    this.place(f, ads, dt);
    // On the frame the old gun leaves the picture, whenever along its holster that is, the new one already shows coming in.
    if (this.switcher.due()) {
      this.switcher.swap(dt);
      f.reset();
      this.player.clip?.sample(this.player.u, f, this.ctx);
      this.place(f, ads, dt);
    }
    this.fx.update(dt);
    this.drops.update(dt);
    this.camera.updateMatrixWorld();
  }

  private place(f: Frame, ads: number, dt: number) {
    this.showGun();
    this.saddle.show(this.gun);
    this.pose.gun(this.gun, f, ads, dt);
    this.pose.hands(this.gun, f, this.ctx.goals, dt);
  }

  meleeLanded(hit: boolean) {
    this.hitStop.land(hit);
  }

  muzzleViewPosition(out: THREE.Vector3) {
    return this.gun.rigged.model.muzzle.getWorldPosition(out);
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.showGun();
  }

  /** The gun and hands are put away for the scope picture on the frame it comes up, and back on the frame it goes. */
  private showGun() {
    const shown = !this.hidden && !this.scope.up;
    this.gun.rigged.model.root.visible = shown;
    this.arms.root.visible = shown;
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
    this.scope.dispose();
    this.drops.clear();
    this.arms.mesh.geometry.dispose();
    this.rack.dispose();
    this.scene.clear();
  }
}
