/**
 * Player-versus-player hits in a match: installs the context's targets / canHurt / raycastPlayers /
 * playersInArc / hitPlayer / cutRopes / onShot. Damage to another player is only reported to its
 * owner, whose client applies it; local shots are queued so peers can draw the tracers.
 */
import * as THREE from 'three';
import { t } from '../core/i18n';
import { clamp } from '../core/math';
import type { PlayerRayHit } from '../context';
import { RemotePlayer } from '../entities/remote-player';
import { INK } from '../render/ink-renderer';
import { inMatch, isOnline } from './state';
import type { Session } from './state';

const _v = new THREE.Vector3();
const _bc = new THREE.Vector3();
const _rp = new THREE.Vector3();
const _rq = new THREE.Vector3();

export class Combat {
  /** Shot end points (x, y, z, rounded) fired since the last network send. */
  private readonly shotQueue: number[] = [];

  constructor(s: Session) {
    const { ctx, net, remote, game } = s;
    const { effects, audio, hud, input, world } = ctx;

    // anything a bullet or a blade can hit besides enemies
    ctx.targets = () => [ctx.player, ...remote.values()];
    ctx.canHurt = (target) => isOnline(game) && target !== ctx.player;
    ctx.raycastPlayers = (o, d, maxDist) => {
      let best: PlayerRayHit | null = null;
      for (const target of remote.values()) {
        if (!target.alive || !ctx.canHurt(target)) continue;
        for (let i = 0; i < target.hit.length; i++) {
          const c = target.hitSpheres[i];
          const r = target.hit[i][1];
          _v.subVectors(c, o);
          const tca = _v.dot(d);
          if (tca < 0 || tca > maxDist) continue;
          const d2 = _v.lengthSq() - tca * tca;
          if (d2 > r * r) continue;
          const tt = tca - Math.sqrt(r * r - d2);
          if (tt < 0) continue;
          if (!best || tt < best.dist) best = { player: target, part: target.hit[i][0], dist: tt, point: new THREE.Vector3(o.x + d.x * tt, o.y + d.y * tt, o.z + d.z * tt) };
        }
        // a raised katana sits in front of the chest: a ray that reaches it before the body is turned aside
        if (target.blocking) {
          _bc.set(target.center.x + target.forward.x * 0.5, target.center.y + 0.3, target.center.z + target.forward.z * 0.5);
          const r = 0.42;
          _v.subVectors(_bc, o);
          const tca = _v.dot(d);
          if (tca > 0 && tca <= maxDist) {
            const d2 = _v.lengthSq() - tca * tca;
            if (d2 <= r * r) {
              const tt = tca - Math.sqrt(r * r - d2);
              if (tt >= 0 && (!best || best.player !== target || tt < best.dist)) best = { player: target, part: 'blade', dist: tt, point: new THREE.Vector3(o.x + d.x * tt, o.y + d.y * tt, o.z + d.z * tt) };
            }
          }
        }
      }
      return best;
    };
    ctx.playersInArc = (pos, dir, range, cosHalf) => {
      const out: RemotePlayer[] = [];
      for (const target of remote.values()) {
        if (!target.alive || !ctx.canHurt(target)) continue;
        _v.subVectors(target.center, pos);
        const d = _v.length();
        if (d > range + 0.3) continue;
        if (d > 0.3 && _v.normalize().dot(dir) < cosHalf) continue;
        if (!world.hasLineOfSight(pos, target.center)) continue;
        out.push(target);
      }
      return out;
    };
    ctx.hitPlayer = (target, dmg, info) => {
      // canHurt only lets other players through, so the target is always a remote one
      if (!ctx.canHurt(target) || !target.alive || !(target instanceof RemotePlayer)) return;
      const { player } = ctx;
      // a raised katana facing you parries a slash outright and turns some bullets aside
      // the bullet met the blade itself: it glances off, and now and then comes straight back at you
      if (info.part === 'blade') {
        effects.strokeBurst(info.point, INK.ORANGE, 8, 6, { life: 0.22, size: 0.035 });
        audio.shieldHit(target.center);
        const ret = Math.random() < 0.4;
        if (ret) {
          effects.tracer(info.point, player.eye, INK.RED, 0.03, 0.08);
          hud.tip(t('deflectedBack'), 0.9);
          input.rumble(0.5, 0.4, 90);
          player.lastHitBy = target.id;
          player.lastHit = { from: target.center.toArray(), crit: false, amount: dmg * 0.6, src: 'deflect' };
          player.takeDamage(dmg * 0.6, target.center);
        } else hud.tip(t('deflectedAway'), 0.7);
        net.sendTo(target.id, 'parry', { ret, by: net.id });
        return;
      }
      const facing = target.blocking ? _v.subVectors(player.center, target.center).normalize().dot(target.forward) : -1;
      const frontHit = /^(head|torso|arm|fore)/.test(info.part || '');
      // a slash is only parried by a guard that just came up and faces you
      if (facing > 0.6 && frontHit && info.source === 'katana' && target.parryWindow) {
        effects.strokeBurst(info.point, INK.ORANGE, 10, 6, { life: 0.25, size: 0.04 });
        audio.shieldHit(target.center);
        game.hitstop(0.08, 0.15);
        const katana = player.weapons[player.katanaIndex];
        katana.cooldown = Math.max(katana.cooldown, 0.6);
        input.rumble(0.6, 0.3, 90);
        hud.tip(t('parried'), 0.9);
        return;
      }
      effects.blood(info.point, info.dir, clamp(0.4 + dmg / 80, 0.4, 1.6), { ink: INK.RED });
      hud.hitmarker(false, info.crit);
      audio.hitEnemy(target.center);
      target.flash();
      net.sendTo(target.id, 'pdmg', { amount: Math.round(dmg), from: player.center.toArray().map((v) => +v.toFixed(1)), by: net.id, crit: !!info.crit, src: info.source });
    };
    // a slash through another player's rope cuts it: their client drops the hook
    ctx.cutRopes = (eye, dir, range) => {
      let cut = false;
      for (const r of remote.values()) {
        if (!r.alive || !r.grappling) continue;
        _rp.set(r.body.pos.x + r.right.x * 0.35, r.body.pos.y + 1.25, r.body.pos.z + r.right.z * 0.35);
        for (let i = 0; i <= 14; i++) {
          _rq.lerpVectors(_rp, r.gPoint, i / 14).sub(eye);
          const along = _rq.dot(dir);
          if (along < 0.3 || along > range) continue;
          const lat = Math.sqrt(Math.max(0, _rq.lengthSq() - along * along));
          if (lat > 0.9) continue;
          _rq.add(eye);
          effects.strokeBurst(_rq, INK.ORANGE, 10, 5, { life: 0.25, size: 0.035 });
          net.sendTo(r.id, 'cut', {});
          hud.tip(t('ropeCut'), 0.9);
          cut = true;
          break;
        }
      }
      return cut;
    };
    // every ray a gun fires this tick is sent to the others, who draw it as a tracer from the shooter's gun
    ctx.onShot = (end) => {
      if (net.active && inMatch(game)) this.shotQueue.push(+end.x.toFixed(1), +end.y.toFixed(1), +end.z.toFixed(1));
    };
  }

  /** Takes the queued shot end points, or null if there were none. */
  takeShots(): number[] | null {
    return this.shotQueue.length ? this.shotQueue.splice(0) : null;
  }
}
