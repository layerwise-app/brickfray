/**
 * Katana focus mode (solo only): a streak of katana kills slows time, marks the best enemy in view,
 * and the dash combo flings the player at it for an execution. A kill during focus chains it once more.
 */
import * as THREE from 'three';
import { DASH_SPEED, FOCUS_ARM, FOCUS_MAX_CHAIN, FOCUS_RANGE, FOCUS_TIME } from '../config';
import { t } from '../core/i18n';
import { clamp } from '../core/math';
import type { Player } from '../entities/player';
import { INK } from '../render/ink-renderer';
import { isOnline } from './state';
import type { Enemy, Session } from './state';

type Body = Player['body'];

const _fv = new THREE.Vector3();

export class FocusMode {
  constructor(private readonly s: Session) {}

  /** The enemy a focus dash would go for: in range, in sight and closest to the crosshair. */
  candidate(): Enemy | null {
    const { player, enemies, world } = this.s.ctx;
    let best: Enemy | null = null;
    let bestScore = -1;
    for (const e of enemies.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      _fv.subVectors(e.center, player.eye);
      const d = _fv.length();
      if (d > FOCUS_RANGE || d < 0.5) continue;
      const aim = _fv.divideScalar(d).dot(player.forward);
      if (aim < 0.4) continue;
      if (!world.hasLineOfSight(player.eye, e.center)) continue;
      const score = aim * 3 - d / FOCUS_RANGE;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  enter(): void {
    const { game } = this.s;
    const { audio, hud } = this.s.ctx;
    if (isOnline(game) || game.focus.chain >= FOCUS_MAX_CHAIN || !this.candidate()) return;
    const fresh = !game.focus.active;
    game.focus.active = true;
    game.focus.t = FOCUS_TIME;
    game.focus.chain++;
    game.focus.arm = FOCUS_ARM;
    game.focus.ready = false;
    if (fresh) {
      audio.focusIn();
      hud.tip(t('focusReady', { key: hud.key('focus') }), 2.2);
    }
  }

  end(): void {
    const { game } = this.s;
    const { player, hud } = this.s.ctx;
    if (!game.focus.active && !game.focus.dash) return;
    game.focus.active = false;
    game.focus.target = null;
    game.focus.chain = 0;
    game.focus.dash = null;
    game.katanaStreak = 0;
    player.dashLock = false;
    hud.setFocusMark(null);
  }

  private startDash(target: Enemy): void {
    const { player, audio, input, hud } = this.s.ctx;
    this.s.game.focus.dash = { target, t: 0, trail: player.center.clone(), lastTrail: 0 };
    player.dashLock = true;
    player.body.vel.set(0, 0, 0);
    audio.dash();
    player.kickFov(5);
    input.rumble(0.5, 0.4, 120);
    hud.setFocusMark(null);
  }

  /** Moves a body flat along (nx, nz), stepping up small ledges; returns how far it got. */
  private marchBody(b: Body, nx: number, nz: number, dist: number): number {
    const { world } = this.s.ctx;
    let moved = 0;
    for (let step = Math.min(0.22, dist); moved + 1e-4 < dist; ) {
      const s2 = Math.min(step, dist - moved);
      b.pos.x += nx * s2;
      b.pos.z += nz * s2;
      if (world.overlapsBody(b)) {
        b.pos.y += 0.65;
        if (world.overlapsBody(b)) {
          b.pos.y -= 0.65;
          b.pos.x -= nx * s2;
          b.pos.z -= nz * s2;
          return moved;
        }
      }
      moved += s2;
    }
    return moved;
  }

  /** Advances the dash; true once it is over. */
  private updateDash(dt: number): boolean {
    const d = this.s.game.focus.dash;
    if (!d) return true;
    const { player, world, effects } = this.s.ctx;
    const target = d.target;
    d.t += dt;
    if (!target.alive || d.t > 1.2) {
      this.endDash(false);
      return true;
    }
    const b = player.body;
    const dx = target.body.pos.x - b.pos.x;
    const dz = target.body.pos.z - b.pos.z;
    const flat = Math.hypot(dx, dz);
    const nx = dx / (flat || 1);
    const nz = dz / (flat || 1);
    player.yaw = Math.atan2(-dx, -dz);
    _fv.subVectors(target.center, player.eye);
    player.pitch = clamp(Math.atan2(_fv.y, Math.hypot(_fv.x, _fv.z)), -1.2, 1.2);
    const want = Math.max(0, flat - 1.1);
    const moved = this.marchBody(b, nx, nz, Math.min(DASH_SPEED * dt, want));
    const aimY = target.body.pos.y + (target.T.flying ? 0.2 : 0);
    const dy = aimY - b.pos.y;
    if (Math.abs(dy) > 0.05) {
      const y = b.pos.y;
      b.pos.y += clamp(dy, -DASH_SPEED * dt, DASH_SPEED * dt);
      if (world.overlapsBody(b)) {
        b.pos.y = y;
        d.stuckY = (d.stuckY || 0) + dt;
      } else d.stuckY = 0;
    }
    d.lastTrail += dt;
    if (d.lastTrail > 0.02) {
      d.lastTrail = 0;
      effects.tracer(d.trail, player.center, INK.BLUE, 0.045, 0.28);
      d.trail.copy(player.center);
      effects.strokeBurst(player.center, INK.BLUE, 2, 5, { life: 0.22, size: 0.03 });
    }
    const reach = Math.hypot(flat, Math.max(0, Math.abs(dy) - 0.6));
    if (reach <= 1.5) {
      this.execute(target);
      return true;
    }
    if (moved < 1e-4 && want > 0.05 && (d.stuckY || 0) > 0.08) {
      this.endDash(true);
      return true;
    }
    return false;
  }

  private endDash(blocked: boolean): void {
    const { player, audio, hud } = this.s.ctx;
    player.dashLock = false;
    this.s.game.focus.dash = null;
    player.body.vel.set(0, 0, 0);
    if (blocked) {
      player.weapons[player.katanaIndex].startSlash(player._weaponState(false, false, 0));
      audio.katanaSwing();
      hud.tip(t('dashBlocked'), 1.2);
    }
  }

  private execute(target: Enemy): void {
    const { game } = this.s;
    const { player, enemies, audio, effects, input, hud } = this.s.ctx;
    player.dashLock = false;
    game.focus.dash = null;
    player.body.vel.set(0, 0, 0);
    player.weapons[player.katanaIndex].startSlash(player._weaponState(false, false, 0));
    _fv.subVectors(target.center, player.eye);
    const dir = _fv.clone().normalize();
    const chainBefore = game.focus.chain;
    enemies.damage(target, 100000, { point: target.center.clone(), dir, part: 'head', source: 'focus', crit: true });
    audio.focusSlash();
    game.hitstop(0.1, 0.08);
    effects.shakeAmt += 0.35;
    input.rumble(0.9, 0.7, 140);
    player.kickFov(6);
    player.hp = Math.min(player.maxHp, player.hp + 6);
    if (game.focus.chain === chainBefore) game.focus.t = Math.min(game.focus.t, 0.35);
    game.focus.target = null;
    hud.setFocusMark(null);
  }

  update(dt: number): void {
    const f = this.s.game.focus;
    if (!f.active) return;
    if (f.dash) {
      this.updateDash(dt);
      return;
    }
    const { player, input, hud, camera } = this.s.ctx;
    f.t -= dt;
    f.arm -= dt;
    if (f.t <= 0 || !player.alive) {
      this.end();
      return;
    }
    const combo = (input.down('aim') && input.down('fire')) || input.down('dash');
    if (!combo) f.ready = true;
    const target = this.candidate();
    f.target = target;
    if (!target) {
      hud.setFocusMark(null);
      return;
    }
    _fv.copy(target.center).project(camera);
    if (_fv.z < 1) hud.setFocusMark((_fv.x * 0.5 + 0.5) * window.innerWidth, (-_fv.y * 0.5 + 0.5) * window.innerHeight);
    else hud.setFocusMark(null);
    if (combo && f.ready && f.arm <= 0) {
      input.consume('fire');
      this.startDash(target);
    }
  }
}
