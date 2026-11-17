import * as THREE from 'three';
import { WEAPONS, type WeaponId } from '../weapons/defs';

const PITCH_LIMIT = 1.52;

/**
 * First-person camera: aim angles (what bullets use) plus purely visual layers
 * (landing dip, hurt flinch, shake, FOV changes) that never move the crosshair.
 */
export class FirstPersonCamera {
  readonly camera = new THREE.PerspectiveCamera(80, 1, 0.04, 600);
  yaw = 0;
  pitch = 0;
  /** Scope sway added to both the view and the bullets. */
  readonly sway = new THREE.Vector2();
  baseFov = 80;
  private recoverPitch = 0;
  private recoverYaw = 0;
  private sinceShot = 10;
  private dip = 0;
  private dipVel = 0;
  private shake = 0;
  private flinch = new THREE.Vector2();
  private flinchVel = new THREE.Vector2();
  private roll = 0;
  private fov = 80;
  private time = 0;

  look(dYaw: number, dPitch: number) {
    this.yaw += dYaw;
    const before = this.pitch;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT);
    // Pulling down against recoil counts toward recovery, so we don't over-correct afterwards.
    const pulled = this.pitch - before;
    if (pulled < 0 && this.recoverPitch > 0) this.recoverPitch = Math.max(0, this.recoverPitch + pulled);
  }

  /** Fixed per-weapon pattern; 70% of it comes back after the trigger is released. */
  kick(weapon: WeaponId, burst: number, ads: number) {
    const pattern = WEAPONS[weapon].recoil;
    const [p, y] = pattern[Math.max(0, burst) % pattern.length]!;
    const scale = 1 - ads * 0.25;
    this.pitch = Math.min(PITCH_LIMIT, this.pitch + p * scale);
    this.yaw += y * scale;
    this.recoverPitch += p * scale * 0.7;
    this.recoverYaw += y * scale * 0.7;
    this.sinceShot = 0;
  }

  land(speed: number) {
    this.dipVel -= Math.min(speed, 16) * 0.035;
  }

  hurt(amount: number, fromLocalX: number) {
    const k = Math.min(1, amount / 60);
    this.flinchVel.x += (0.6 + k) * 0.6;
    this.flinchVel.y += fromLocalX * (0.4 + k) * 0.5;
    this.shake = Math.max(this.shake, k * 0.6);
  }

  addShake(amount: number) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt: number, opts: { ads: number; zoom: number; sprint: boolean; slide: boolean; strafe: number; aspect: number }) {
    this.time += dt;
    this.sinceShot += dt;
    if (this.sinceShot > 0.1 && (this.recoverPitch > 0 || Math.abs(this.recoverYaw) > 0)) {
      const k = 1 - Math.exp(-dt * 9);
      const dp = this.recoverPitch * k;
      const dy = this.recoverYaw * k;
      this.pitch -= dp;
      this.yaw -= dy;
      this.recoverPitch -= dp;
      this.recoverYaw -= dy;
      if (this.recoverPitch < 1e-4) this.recoverPitch = 0;
      if (Math.abs(this.recoverYaw) < 1e-4) this.recoverYaw = 0;
    }
    // Damped springs for the dip and flinch.
    this.dipVel += (-this.dip * 160 - this.dipVel * 18) * dt;
    this.dip += this.dipVel * dt;
    this.flinchVel.x += (-this.flinch.x * 220 - this.flinchVel.x * 22) * dt;
    this.flinchVel.y += (-this.flinch.y * 220 - this.flinchVel.y * 22) * dt;
    this.flinch.addScaledVector(this.flinchVel, dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.roll += ((opts.slide ? 0.06 : 0) - opts.strafe * 0.012 - this.roll) * Math.min(1, dt * 8);

    const zoomed = this.baseFov / (1 + (opts.zoom - 1) * opts.ads);
    const target = zoomed + (opts.sprint ? 6 : 0) + (opts.slide ? 4 : 0);
    this.fov += (target - this.fov) * Math.min(1, dt * 14);
    const vertical = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.fov) / 2) / Math.max(opts.aspect, 0.5)));
    // The configured FOV is horizontal (like most shooters); Three wants vertical.
    if (Math.abs(this.camera.fov - vertical) > 0.01 || this.camera.aspect !== opts.aspect) {
      this.camera.fov = vertical;
      this.camera.aspect = opts.aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Place the camera at the eye with all visual offsets applied. */
  place(eye: THREE.Vector3) {
    const t = this.time;
    const s = this.shake * this.shake;
    const shakeX = (Math.sin(t * 61) + Math.sin(t * 37)) * 0.006 * s;
    const shakeY = (Math.sin(t * 53) + Math.sin(t * 29)) * 0.006 * s;
    this.camera.position.set(eye.x, eye.y + this.dip, eye.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw + this.sway.x + this.flinch.y * 0.04 + shakeX;
    this.camera.rotation.x = this.pitch + this.sway.y + this.flinch.x * 0.03 + shakeY;
    this.camera.rotation.z = this.roll + this.flinch.y * 0.02;
    this.camera.updateMatrixWorld();
  }

  /** Horizontal FOV in degrees currently applied (sprint/ADS included). */
  get currentFov() {
    return this.fov;
  }
}
