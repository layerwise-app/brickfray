/**
 * Ammo and health pickups. Solo play scatters them each wave and from kills; in a match the host
 * owns them (spawns, expiry, who took one) and tells everyone else.
 */
import * as THREE from 'three';
import { choose, rand } from '../core/math';
import { t } from '../core/i18n';
import { INK, makeInkMaterial } from '../render/ink-renderer';
import type { Session } from './state';

export type PickupKind = 'ammo' | 'health';

export interface Pickup {
  id: number;
  kind: PickupKind;
  mesh: THREE.Group;
  /** Resting height the pickup bobs around. */
  base: number;
  t: number;
  /** Seconds left before it vanishes (solo and host only). */
  life: number;
}

export class Pickups {
  readonly items: Pickup[] = [];
  private nextId = 1;
  /** Host: seconds to the next arena ammo drop. */
  private arenaClock = 0;
  private readonly mats = {
    ammo: makeInkMaterial({ ink: INK.BLUE }),
    health: makeInkMaterial({ ink: INK.GREEN }),
    cap: makeInkMaterial({ ink: INK.BLACK }),
    shell: makeInkMaterial({ ink: INK.ORANGE }),
  };

  constructor(private readonly s: Session) {}

  private make(kind: PickupKind): THREE.Group {
    const pmat = this.mats;
    const g = new THREE.Group();
    if (kind === 'ammo') {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.5, 10), pmat.ammo));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8), pmat.cap);
      c.position.y = 0.33;
      g.add(c);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.02), pmat.cap);
      l.position.set(0, 0, 0.24);
      g.add(l);
    } else if (this.s.ctx.level.key === 'mexico') {
      const sh = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12, 1, false, 0, Math.PI);
      sh.rotateZ(Math.PI / 2);
      sh.rotateX(-Math.PI / 2);
      g.add(new THREE.Mesh(sh, pmat.shell));
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.2), pmat.health);
      f.position.y = 0.02;
      g.add(f);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.14), pmat.cap);
      m.position.y = 0.1;
      g.add(m);
    } else if (this.s.ctx.level.key === 'desk') {
      // a cookie: a fat disc with a few chocolate chips
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 14).rotateX(Math.PI / 2), pmat.health));
      for (const [x, y] of [[-0.15, 0.12], [0.16, 0.05], [0, -0.17]]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.2), pmat.cap);
        c.position.set(x, y, 0);
        g.add(c);
      }
    } else if (this.s.ctx.level.key === 'metro') {
      // a soda can with a ring pull
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.56, 12), pmat.health));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 12), pmat.cap);
      c.position.y = 0.32;
      g.add(c);
    } else {
      g.add(
        new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), pmat.health),
        new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), pmat.health),
      );
    }
    return g;
  }

  spawn(kind: PickupKind, pos: THREE.Vector3, id: number | null = null): Pickup {
    const { ctx, net } = this.s;
    const m = this.make(kind);
    m.position.copy(pos);
    m.position.y += 0.6;
    ctx.scene.add(m);
    const p: Pickup = { id: id ?? this.nextId++, kind, mesh: m, base: m.position.y, t: rand(0, 6), life: 45 };
    this.items.push(p);
    if (net.isHost) net.send('pickup', { id: p.id, kind, pos: pos.toArray() });
    return p;
  }

  find(id: number): Pickup | undefined {
    return this.items.find((x) => x.id === id);
  }

  remove(p: Pickup): void {
    this.s.ctx.scene.remove(p.mesh);
    const i = this.items.indexOf(p);
    if (i >= 0) this.items.splice(i, 1);
  }

  /** Removes every pickup and restarts the arena drop clock. */
  clear(): void {
    for (const p of this.items) this.s.ctx.scene.remove(p.mesh);
    this.items.length = 0;
    this.arenaClock = 0;
  }

  private collect(p: Pickup): void {
    const { player, hud, audio, effects, level } = this.s.ctx;
    if (p.kind === 'ammo') {
      player.addAmmoAll(0.4);
      player.grenades = Math.min(player.maxGrenades, player.grenades + 1);
      hud.kill(t('ammoPickup'), 0);
    } else {
      player.hp = Math.min(player.maxHp, player.hp + 35);
      const name = { mexico: 'tacoPickup', desk: 'cookiePickup', metro: 'sodaPickup', district: 'healthPickup' } as const;
      hud.kill(t(name[level.key]), 0);
    }
    audio.pickup();
    effects.strokeBurst(p.mesh.position, p.kind === 'ammo' ? INK.BLUE : INK.GREEN, 12, 4, { life: 0.3 });
  }

  /** Bobs and spins the pickups, collects any the player walks into and expires old ones. */
  update(dt: number): void {
    const { net } = this.s;
    const { player } = this.s.ctx;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.t += dt;
      p.mesh.position.y = p.base + Math.sin(p.t * 2.5) * 0.12;
      p.mesh.rotation.y += dt * 1.8;
      if (player.alive && p.mesh.position.distanceTo(player.center) < 1.5) {
        this.collect(p);
        this.remove(p);
        if (net.active) net.send(net.isHost ? 'taken' : 'take', { id: p.id });
        continue;
      }
      if (!net.active || net.isHost) {
        p.life -= dt;
        if (p.life <= 0) {
          this.remove(p);
          if (net.isHost) net.send('taken', { id: p.id });
        }
      }
    }
  }

  /** Host only: drops ammo around the arena every few seconds during a match. */
  updateArena(dt: number): void {
    if (!this.s.net.isHost) return;
    this.arenaClock -= dt;
    if (this.arenaClock <= 0 && this.items.length < 10) {
      this.arenaClock = 7;
      this.spawn('ammo', choose(this.s.ctx.level.pickups));
    }
  }
}
