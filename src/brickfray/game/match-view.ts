import * as THREE from 'three';
import type { AudioEngine, SoundId } from '../audio/types';
import type { Kit } from '../engine/kit';
import type { GameRenderer } from '../engine/renderer';
import { Effects } from '../fx/effects';
import type { ClientSession } from '../net/client-session';
import type { Snapshot } from '../net/codec';
import type { ArmsHooks } from '../sim/arms';
import { CollisionWorld } from '../sim/collision';
import { INTERP_DELAY, TICK } from '../sim/constants';
import { rayHitPlayer } from '../sim/hitboxes';
import { eyeHeight } from '../sim/movement';
import { StepSmoother } from './step-smoother';
import { BUTTON, type Command, type MatchSettings } from '../sim/types';
import { WEAPONS, type WeaponId } from '../weapons/defs';
import { LOADOUTS, slotOf } from '../weapons/loadouts';
import type { ViewModel } from '../weapons/types';
import { MAPS } from '../world';
import type { MapLayout, MapVisual } from '../world/types';
import { FirstPersonCamera } from './camera';
import { GrenadeView } from './grenade-view';
import type { HudStore } from './hud';
import type { FrameInput } from './input';
import { MatchEvents } from './match-events';
import { NameTags } from './name-tags';
import { Predictor } from './predictor';
import { Remotes } from './remotes';

const v3 = () => new THREE.Vector3();

/** Everything that exists only while a match is loaded: map, players, prediction and effects. */
export class MatchView {
  readonly scene = new THREE.Scene();
  readonly layout: MapLayout;
  readonly world: CollisionWorld;
  readonly visual: MapVisual;
  readonly effects: Effects;
  readonly remotes: Remotes;
  readonly predictor: Predictor;
  readonly fp = new FirstPersonCamera();
  readonly grenades: GrenadeView;
  readonly events: MatchEvents;
  private readonly tags: NameTags;
  private seq = 0;
  private acc = 0;
  private latched = 0;
  private slot = 0;
  private prevMove = { x: 0, y: 0, z: 0, grounded: false };
  private eye = v3();
  private readonly steps = new StepSmoother();
  private tmp = v3();
  private tmp2 = v3();
  private lastSnapshot: Snapshot | null = null;
  private pendingSnapshot: Snapshot | null = null;
  private stepTimer = 0;
  private wasGrounded = true;
  scoped = false;
  deathCam: { at: THREE.Vector3; killer: number; t: number } | null = null;

  constructor(
    readonly kit: Kit,
    readonly renderer: GameRenderer,
    readonly session: ClientSession,
    readonly settings: MatchSettings,
    readonly audio: AudioEngine,
    readonly view: ViewModel,
    readonly hud: HudStore,
    tagLayer: HTMLElement
  ) {
    this.tags = new NameTags(tagLayer);
    const def = MAPS[settings.map];
    this.layout = def.layout();
    this.world = new CollisionWorld(this.layout.colliders);
    renderer.atmosphere = def.atmosphere;
    renderer.dress(this.scene);
    view.setAtmosphere(def.atmosphere);
    this.visual = def.build(kit);
    this.scene.add(this.visual.root);
    this.effects = new Effects(kit, this.world);
    this.scene.add(this.effects.root);
    this.remotes = new Remotes(kit, session.you);
    this.scene.add(this.remotes.group);
    this.grenades = new GrenadeView(kit, audio);
    this.scene.add(this.grenades.group);
    this.predictor = new Predictor(this.world, session.you, session.roster.get(session.you)?.character ?? 'rivet');
    this.events = new MatchEvents(this);
    this.remotes.onFire = (r) => {
      // Flash at the gun; the tracer and sound come with the shot trace.
      const muzzle = this.remotes.muzzleOf(r, v3());
      const dir = new THREE.Vector3(-Math.sin(r.yaw), 0, -Math.cos(r.yaw));
      this.effects.muzzle(muzzle, dir, r.weapon === 'shotgun' || r.weapon === 'sniper');
    };
    this.remotes.onStep = (r, loud) => {
      const surface = this.world.surfaceBelow(r.position.x, r.position.y, r.position.z);
      this.play(`step:${surface}`, r.position, loud ? 1 : 0.7, 3);
    };
    this.effects.onChipBounce = (p) => this.play('brickClatter', p, 0.35, 1);
    this.remotes.syncRoster(session.roster);
  }

  play(id: SoundId, at?: THREE.Vector3 | [number, number, number] | null, volume = 1, priority = 5) {
    const position = at ? (Array.isArray(at) ? { x: at[0], y: at[1], z: at[2] } : { x: at.x, y: at.y, z: at.z }) : undefined;
    this.audio.play(id, { position, volume, priority });
  }

  get me() {
    return this.predictor.player;
  }

  /** Where the local muzzle appears on screen, placed in the world for tracers. */
  muzzleWorld(out: THREE.Vector3) {
    const cam = this.fp.camera;
    const local = this.view.muzzleViewPosition(this.tmp2);
    const depth = Math.max(0.35, -local.z);
    const ndc = local.clone().applyMatrix4(this.view.camera.projectionMatrix);
    out.set(ndc.x, ndc.y, 0.5).unproject(cam).sub(cam.position).normalize();
    return out.multiplyScalar(depth).add(cam.position);
  }

  private hooks: ArmsHooks = {
    fire: (player, weapon, dirs) => this.localShot(weapon, dirs, player.arms.burst, player.arms.ads),
    melee: () => this.play('cue:swing', null, 0.9, 6),
    grenade: () => this.play('cue:throw', null, 0.9, 6),
    view: (action) => this.view.act(action),
    dryFire: () => this.play('dryFire', null, 1, 7)
  };

  private localShot(weapon: WeaponId, dirs: [number, number, number][], burst: number, ads: number) {
    const m = this.me.move;
    const ox = m.x;
    const oy = m.y + eyeHeight(m);
    const oz = m.z;
    const muzzle = this.muzzleWorld(v3());
    let predicted: 'body' | 'head' | null = null;
    for (const d of dirs) {
      const wall = this.world.raycast(ox, oy, oz, d[0], d[1], d[2], 260, true);
      let maxT = wall?.t ?? 260;
      let hitRemote: { color: string; head: boolean } | null = null;
      for (const r of this.remotes.map.values()) {
        const pose = this.remotes.pose(r);
        if (!pose || (r.entry.team !== -1 && r.entry.team === this.myTeam)) continue;
        const hit = rayHitPlayer(pose, ox, oy, oz, d[0], d[1], d[2], maxT);
        if (hit) {
          maxT = hit.t;
          hitRemote = { color: '#f2f2ee', head: hit.kind === 'head' };
        }
      }
      const end = new THREE.Vector3(ox + d[0] * maxT, oy + d[1] * maxT, oz + d[2] * maxT);
      const pellet = dirs.length > 1;
      this.effects.tracers.add(muzzle, end, {
        streak: weapon === 'sniper' ? 14 : pellet ? 2.2 : 5,
        width: weapon === 'sniper' ? 0.06 : pellet ? 0.022 : 0.034,
        speed: weapon === 'sniper' ? 700 : 340,
        color: weapon === 'sniper' ? '#bfe9ff' : '#ffd27a'
      });
      if (hitRemote) {
        this.effects.bodyHit(end, new THREE.Vector3(...d), hitRemote.color, hitRemote.head);
        predicted = predicted === 'head' || hitRemote.head ? 'head' : 'body';
      } else if (wall) {
        const n = new THREE.Vector3(...wall.normal);
        this.effects.impact(end, n, wall.surface, this.colorAt(end, n));
        if (!pellet || Math.random() < 0.35) this.play(`impact:${wall.surface}`, end, pellet ? 0.5 : 0.8, 3);
      }
    }
    if (predicted) this.play(predicted === 'head' ? 'impactHead' : 'impactBody', null, 0.7, 7);
    this.fp.kick(weapon, burst, ads);
    this.play(`fire:${weapon}`, null, 1, 9);
    if (weapon === 'shotgun' || weapon === 'sniper') this.fp.addShake(weapon === 'sniper' ? 0.25 : 0.35);
  }

  private raycaster = new THREE.Raycaster();
  /** Sample the scenery's own color under a hit, so chips match what was shot. */
  private colorAt(point: THREE.Vector3, normal: THREE.Vector3): THREE.Color | undefined {
    try {
      this.raycaster.set(point.clone().addScaledVector(normal, 0.06), normal.clone().negate());
      this.raycaster.far = 0.15;
      const hit = this.raycaster.intersectObject(this.visual.root, true)[0] as (THREE.Intersection & { batchId?: number }) | undefined;
      const mesh = hit?.object as THREE.BatchedMesh | undefined;
      if (hit && mesh?.isBatchedMesh && hit.batchId !== undefined) {
        const color = new THREE.Color();
        mesh.getColorAt(hit.batchId, color);
        return color;
      }
      const material = (hit?.object as THREE.Mesh | undefined)?.material as THREE.MeshStandardMaterial | undefined;
      return material?.color?.clone();
    } catch {
      return undefined;
    }
  }

  get myTeam() {
    return this.session.roster.get(this.session.you)?.team ?? -1;
  }

  /** Fixed-rate command generation and prediction. */
  private tick(input: FrameInput) {
    const m = this.me.move;
    this.prevMove = { x: m.x, y: m.y, z: m.z, grounded: m.grounded };
    if (input.slot !== null) this.slot = input.slot;
    if (input.cycle) this.slot = (this.slot + input.cycle + 2) % 2;
    const cmd: Command = {
      seq: ++this.seq,
      forward: input.forward,
      right: input.right,
      yaw: this.fp.yaw + this.fp.sway.x,
      pitch: this.fp.pitch + this.fp.sway.y,
      buttons: input.buttons | this.latched,
      slot: this.slot,
      viewTime: this.session.hostNow() - INTERP_DELAY,
      life: this.me.life
    };
    this.latched = 0;
    input.slot = null;
    input.cycle = 0;
    this.predictor.apply(cmd, this.hooks);
    this.steps.tick(this.prevMove, m);
    this.session.sendCommands(this.predictor.unacked(4));
    if (m.landed > 4) {
      this.fp.land(m.landed);
      this.view.act({ type: 'land', impact: Math.min(1, m.landed / 14) });
      this.play('land', null, Math.min(1, m.landed / 12), 4);
    }
    if (this.wasGrounded && !m.grounded && m.vy > 3) this.play('jump', null, 0.6, 3);
    this.wasGrounded = m.grounded;
  }

  /** Every snapshot as it arrives: shots are drawn right away; reconciliation waits for the frame. */
  receive(snap: Snapshot) {
    this.pendingSnapshot = snap;
    this.events.traces(snap.traces);
  }

  frame(dt: number, input: FrameInput, menuOpen: boolean) {
    if (this.pendingSnapshot) {
      this.onSnapshot(this.pendingSnapshot);
      this.pendingSnapshot = null;
    }
    const alive = this.me.alive;
    if (!menuOpen && alive) this.fp.look(input.lookYaw, input.lookPitch);
    // Presses shorter than a tick still count.
    this.latched |= input.buttons & (BUTTON.fire | BUTTON.jump | BUTTON.melee | BUTTON.reload | BUTTON.grenade);
    if (menuOpen) {
      input.buttons = 0;
      input.forward = input.right = 0;
    }
    this.acc += dt;
    let ticks = 0;
    while (this.acc >= TICK && ticks < 8) {
      this.acc -= TICK;
      ticks++;
      this.tick(input);
    }
    if (ticks === 8) this.acc = 0;
    this.predictor.decaySmoothing(dt);

    const p = this.me;
    const m = p.move;
    const alpha = this.acc / TICK;
    const s = this.predictor.smoothing;
    this.eye.set(
      this.prevMove.x + (m.x - this.prevMove.x) * alpha + s.x,
      this.prevMove.y + (m.y - this.prevMove.y) * alpha + s.y,
      this.prevMove.z + (m.z - this.prevMove.z) * alpha + s.z
    );
    if (alive) this.eye.y += this.steps.frame(alpha, dt);
    else this.steps.reset();
    this.eye.y += eyeHeight(m);
    const speed = Math.hypot(m.vx, m.vz);
    const def = WEAPONS[p.arms.weapon];
    this.scoped = alive && p.arms.weapon === 'sniper' && p.arms.ads > 0.85;
    const cosY = Math.cos(this.fp.yaw);
    const sinY = Math.sin(this.fp.yaw);
    this.breathe(dt, (input.buttons & BUTTON.sprint) !== 0);
    this.fp.update(dt, {
      ads: p.arms.ads,
      zoom: def.zoom,
      sprint: m.sprinting && speed > 5,
      slide: m.slide > 0,
      strafe: (m.vx * cosY - m.vz * sinY) / 7,
      aspect: this.renderer.canvas.clientWidth / Math.max(1, this.renderer.canvas.clientHeight)
    });
    if (alive) {
      this.deathCam = null;
      this.fp.place(this.eye);
    } else this.placeDeathCam(dt);
    this.footsteps(dt, speed);

    const renderTime = this.session.hostNow() - INTERP_DELAY;
    this.remotes.update(dt, this.session.snapshots, renderTime);
    this.grenades.update(this.session.snapshots, renderTime);
    this.view.setHidden(!alive || this.scoped);
    this.view.orient(this.fp.camera.quaternion);
    this.view.update(dt, { speed, sprint: m.sprinting, grounded: m.grounded, crouch: m.crouch, ads: p.arms.ads, look: { yaw: input.lookYaw, pitch: input.lookPitch }, time: performance.now() / 1000 });
    this.effects.update(dt, this.fp.camera);
    this.tags.update(this.fp.camera, this.remotes, alive ? this.aimedRemote() : 0, this.myTeam, this.renderer.canvas.clientWidth, this.renderer.canvas.clientHeight);
    this.visual.update(dt, performance.now() / 1000);
    this.renderer.followShadow(this.fp.camera.position);
    const cam = this.fp.camera;
    this.audio.setListener(cam.position, cam.getWorldDirection(this.tmp), cam.up);
    this.audio.setMuffle(alive && p.health < 30 ? 1 - p.health / 30 : 0);
    this.events.frame(dt);
  }

  /** The remote under the crosshair, if no wall is in the way. */
  private aimedRemote(): number {
    const cam = this.fp.camera;
    const d = cam.getWorldDirection(this.tmp);
    const o = cam.position;
    const wall = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 120, true);
    let best = 0;
    let bestT = wall?.t ?? 120;
    for (const r of this.remotes.map.values()) {
      const pose = this.remotes.pose(r);
      if (!pose) continue;
      const hit = rayHitPlayer(pose, o.x, o.y, o.z, d.x, d.y, d.z, bestT);
      if (hit) {
        bestT = hit.t;
        best = r.entry.id;
      }
    }
    return best;
  }

  private breath = 3;
  private breathTime = 0;
  /** Scoped sniper drifts in a slow figure eight; Shift holds the breath for up to 3 s. */
  private breathe(dt: number, hold: boolean) {
    this.breathTime += dt;
    const scoped = this.scoped;
    const holding = scoped && hold && this.breath > 0;
    this.breath = holding ? Math.max(0, this.breath - dt) : Math.min(3, this.breath + dt * (scoped ? 0.6 : 1.5));
    const amp = scoped ? (this.breath <= 0 ? 0.0045 : 0.0026) : 0;
    const t = this.breathTime;
    const tx = holding ? 0 : Math.sin(t * 0.9) * amp;
    const ty = holding ? 0 : Math.sin(t * 1.8) * amp * 0.55;
    this.fp.sway.x += (tx - this.fp.sway.x) * Math.min(1, dt * 6);
    this.fp.sway.y += (ty - this.fp.sway.y) * Math.min(1, dt * 6);
  }

  /** Controller aim slowdown and a gentle pull toward enemies near the crosshair. */
  assist(yawRate: number, pitchRate: number, strength: number): [number, number] {
    if (strength <= 0 || !this.me.alive) return [yawRate, pitchRate];
    const cam = this.fp.camera;
    const forward = cam.getWorldDirection(this.tmp);
    let best: { yaw: number; pitch: number; angle: number } | null = null;
    for (const r of this.remotes.map.values()) {
      if (!r.visible || (r.entry.team !== -1 && r.entry.team === this.myTeam)) continue;
      const target = this.tmp2.set(r.position.x, r.position.y + 1.25, r.position.z).sub(cam.position);
      const dist = target.length();
      if (dist > 45) continue;
      target.divideScalar(dist);
      const angle = Math.acos(THREE.MathUtils.clamp(forward.dot(target), -1, 1));
      const radius = Math.atan2(0.9, dist) + 0.02;
      if (angle > radius * 1.8 || (best && angle > best.angle)) continue;
      if (!this.world.clearLine(cam.position.x, cam.position.y, cam.position.z, r.position.x, r.position.y + 1.25, r.position.z)) continue;
      const yaw = Math.atan2(-target.x, -target.z);
      const pitch = Math.asin(target.y);
      best = { yaw: Math.atan2(Math.sin(yaw - this.fp.yaw), Math.cos(yaw - this.fp.yaw)), pitch: pitch - this.fp.pitch, angle };
    }
    if (!best) return [yawRate, pitchRate];
    const slow = 1 - 0.45 * strength;
    const pull = 2.2 * strength;
    return [yawRate * slow + best.yaw * pull, pitchRate * slow + best.pitch * pull * 0.6];
  }

  private footsteps(dt: number, speed: number) {
    const m = this.me.move;
    if (!m.grounded || speed < 1 || !this.me.alive) {
      this.stepTimer = 0.18;
      return;
    }
    const interval = m.sprinting ? 0.29 : m.crouch > 0.5 ? 0.55 : 0.4;
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      this.stepTimer = interval;
      const surface = this.world.surfaceBelow(m.x, m.y, m.z);
      this.play(`step:${surface}`, null, m.crouch > 0.5 ? 0.3 : m.sprinting ? 0.75 : 0.5, 2);
    }
  }

  private placeDeathCam(dt: number) {
    if (!this.deathCam) this.deathCam = { at: this.eye.clone(), killer: 0, t: 0 };
    const d = this.deathCam;
    d.t += dt;
    const killer = this.remotes.map.get(d.killer);
    const focus = killer?.visible ? killer.position.clone().setY(killer.position.y + 1.4) : d.at;
    const back = Math.min(1, d.t / 0.8);
    const cam = this.fp.camera;
    const from = d.at.clone().add(new THREE.Vector3(Math.sin(d.t * 0.4) * 2.5 * back, 1.2 * back, Math.cos(d.t * 0.4) * 2.5 * back));
    cam.position.lerp(from, Math.min(1, dt * 4));
    cam.lookAt(focus);
    cam.updateMatrixWorld();
  }

  private onSnapshot(snap: Snapshot) {
    const first = !this.lastSnapshot;
    this.lastSnapshot = snap;
    if (snap.self) {
      const wasAlive = this.me.alive;
      if (first || (!wasAlive && snap.self.alive)) {
        this.predictor.reset(snap.self);
        this.prevMove = { x: snap.self.move.x, y: snap.self.move.y, z: snap.self.move.z, grounded: snap.self.move.grounded };
        const mine = snap.players.find((p) => p.id === this.session.you);
        if (mine) {
          this.fp.yaw = mine.yaw;
          this.fp.pitch = 0;
        }
        this.slot = slotOf(LOADOUTS[this.predictor.player.character], snap.self.arms.weapon);
        this.view.equip(snap.self.arms.weapon);
      } else this.predictor.reconcile(snap.ack, snap.self);
    }
  }

  dispose() {
    this.tags.clear();
    this.remotes.dispose();
    this.effects.clear();
    this.visual.dispose();
    this.grenades.dispose();
    this.scene.clear();
  }
}
