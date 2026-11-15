/**
 * Breakable props: bullets, blades and blasts break them, and everyone in a match sees it go.
 * Installs the context's breakHit / breakablesInArc / blastBreakables.
 */
import * as THREE from 'three';
import { t } from '../core/i18n';
import { rand } from '../core/math';
import { INK } from '../render/ink-renderer';
import type { Breakable } from '../world/level';
import type { Pickups } from './pickups';
import type { Session } from './state';

const _v = new THREE.Vector3();

export class Props {
  constructor(
    private readonly s: Session,
    private readonly pickups: Pickups,
  ) {
    const { ctx } = s;
    ctx.breakHit = (br, dmg, point, dir) => {
      if (!br.alive) return;
      br.hp -= dmg;
      if (br.hp <= 0) this.break(br, dir, true);
      else {
        ctx.effects.strokeBurst(point, br.ink, 5, 4, { life: 0.2, size: 0.03 });
        ctx.audio.shieldHit(point);
      }
    };
    ctx.breakablesInArc = (pos, dir, range, cosHalf) =>
      ctx.level.breakables.filter((br) => {
        if (!br.alive) return false;
        _v.subVectors(br.pos, pos);
        const d = _v.length();
        return d < range + 0.5 && (d < 0.4 || _v.divideScalar(d).dot(dir) > cosHalf);
      });
    ctx.blastBreakables = (center, radius) => {
      for (const br of ctx.level.breakables) if (br.alive && br.pos.distanceTo(center) < radius * 0.9) this.break(br, br.pos.clone().sub(center).normalize(), true);
    };
  }

  /**
   * Smashes a prop into debris. `local` breaks are announced to the match; a `quiet` break (a late
   * joiner catching up) just removes it.
   */
  break(br: Breakable, dir: THREE.Vector3 | null, local: boolean, quiet = false): void {
    const { game, net } = this.s;
    const { world, scene, effects, audio } = this.s.ctx;
    if (!br.alive) return;
    br.alive = false;
    world.removeBox(br.box);
    const g = br.group;
    const pos = br.pos;
    const d = dir && dir.lengthSq() > 0.01 ? dir.clone().normalize() : new THREE.Vector3(rand(-1, 1), 1, rand(-1, 1)).normalize();
    if (quiet) {
      scene.remove(g);
      return;
    }
    g.updateMatrixWorld(true);
    for (const child of [...g.children]) {
      child.updateWorldMatrix(true, false);
      scene.attach(child);
      const v = d.clone().multiplyScalar(rand(2, 6));
      v.x += rand(-3, 3);
      v.z += rand(-3, 3);
      v.y += rand(2.5, 6.5);
      effects.debris(child, child.position, v, new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), { radius: 0.14, blood: false, life: rand(6, 9) });
    }
    scene.remove(g);
    const up = new THREE.Vector3(0, 1, 0);
    if (br.kind === 'pinata') {
      for (const ink of [INK.PINK, INK.ORANGE, INK.GREEN]) effects.strokeBurst(pos, ink, 16, 7, { life: 0.7, size: 0.05 });
      effects.explosion(pos, 2.5, INK.PINK);
      if (!net.active || net.isHost) for (let i = 0; i < 2; i++) this.pickups.spawn('health', pos.clone().add(new THREE.Vector3(rand(-1.2, 1.2), 0, rand(-1.2, 1.2))));
      if (game.mode === 'solo') game.addScore(25, t('pinata'));
    } else if (br.kind === 'cactus') {
      effects.blood(pos, d, 1.4, { ink: INK.GREEN });
      effects.bloodPool(new THREE.Vector3(pos.x, 0, pos.z), 1.1, INK.GREEN);
    } else {
      effects.strokeBurst(pos, br.ink, 12, 5, { life: 0.35, size: 0.04 });
      effects.smoke(pos, up, 3);
    }
    audio.smash(pos, br.kind === 'barrel' || br.kind === 'crate' || br.kind === 'cactus');
    if (local && net.active) net.broadcast('brk', { id: br.id });
  }
}
