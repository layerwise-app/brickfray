import * as THREE from 'three';
import type { ShatterPiece } from '../characters/types';
import type { Kit } from '../engine/kit';
import type { CollisionWorld } from '../sim/collision';
import { Debris } from './debris';
import { Decals } from './decals';
import { ShatterField } from './shatter';
import { SpritePool } from './sprites';
import { Tracers } from './tracers';

const SURFACE_COLOR: Record<string, string> = {
  plastic: '#d9d4c7',
  metal: '#9aa3ad',
  wood: '#8a5a33',
  glass: '#bfe3f2',
  foliage: '#3f8f3a',
  water: '#7cc4e8',
  stone: '#9b978c',
  body: '#e33a2c'
};

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Every world-space effect behind one facade; all pools live in `root`. */
export class Effects {
  readonly root = new THREE.Group();
  readonly tracers = new Tracers();
  readonly debris: Debris;
  readonly shatterField: ShatterField;
  readonly glow = new SpritePool(true, 320);
  readonly smoke = new SpritePool(false, 220);
  readonly decals: Decals;
  onChipBounce: ((position: THREE.Vector3, speed: number) => void) | null = null;

  constructor(kit: Kit, world: CollisionWorld | null) {
    this.debris = new Debris(kit, world);
    this.shatterField = new ShatterField(world, kit.profile.level === 'low' ? 60 : kit.profile.level === 'medium' ? 140 : 260);
    this.decals = new Decals(kit.profile.maxDecals);
    this.debris.onBounce = (p, s) => this.onChipBounce?.(p, s);
    this.shatterField.onClatter = (p, s) => this.onChipBounce?.(p, s);
    this.root.add(this.debris.mesh, this.shatterField.group, this.decals.mesh, this.smoke.mesh, this.tracers.mesh, this.glow.mesh);
    this.root.name = 'effects';
  }

  impact(point: THREE.Vector3, normal: THREE.Vector3, surface: string, color?: THREE.ColorRepresentation) {
    const c = color ?? SURFACE_COLOR[surface] ?? SURFACE_COLOR.plastic!;
    if (surface === 'water') {
      for (let i = 0; i < 6; i++) {
        this.smoke.emit({ position: point, velocity: v((Math.random() - 0.5) * 1.5, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 1.5), size: 0.12, grow: 0.4, color: '#e8f6ff', alpha: 0.8, life: 0.5, gravity: 9 });
      }
      return;
    }
    if (surface === 'foliage') {
      this.debris.burst(point, normal, c, 4, 2, 0.06);
      return;
    }
    if (surface !== 'glass') this.decals.add(point, normal);
    this.debris.burst(point, normal, c, surface === 'metal' ? 2 : 5, 3, 0.045);
    this.glow.emit({ position: point.clone().addScaledVector(normal, 0.03), size: 0.18, color: '#fff1c4', life: 0.06, shape: 'star' });
    if (surface === 'metal') {
      for (let i = 0; i < 6; i++) {
        const dir = normal.clone().multiplyScalar(4).add(v((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6));
        this.glow.emit({ position: point, velocity: dir, size: 0.035, color: '#ffc46b', life: 0.25 + Math.random() * 0.2, shape: 'soft', gravity: 12 });
      }
    }
    this.smoke.emit({ position: point.clone().addScaledVector(normal, 0.08), velocity: normal.clone().multiplyScalar(0.6), size: 0.16, grow: 0.9, color: c, alpha: 0.55, life: 0.55, drag: 2 });
  }

  bodyHit(point: THREE.Vector3, dir: THREE.Vector3, color: THREE.ColorRepresentation, head: boolean) {
    const n = dir.clone().negate();
    this.debris.burst(point, n, color, head ? 7 : 4, 3.5, 0.05);
    this.glow.emit({ position: point, size: head ? 0.4 : 0.26, color: head ? '#ffe28a' : '#ffffff', life: 0.07, shape: 'star' });
  }

  /** Muzzle flash in world space for other players (the local one draws in the view layer). */
  muzzle(position: THREE.Vector3, dir: THREE.Vector3, big: boolean) {
    this.glow.emit({ position, size: big ? 0.55 : 0.38, color: '#ffd38a', life: 0.05, shape: 'star' });
    this.glow.emit({ position: position.clone().addScaledVector(dir, 0.15), size: big ? 0.8 : 0.5, color: '#ff9f43', alpha: 0.5, life: 0.07, shape: 'soft' });
    this.smoke.emit({ position: position.clone().addScaledVector(dir, 0.1), velocity: dir.clone().multiplyScalar(0.8).add(v(0, 0.3, 0)), size: 0.12, grow: 0.7, color: '#d8d8d8', alpha: 0.25, life: 0.6, drag: 1.5 });
  }

  explosion(position: THREE.Vector3, palette: readonly THREE.ColorRepresentation[]) {
    this.glow.emit({ position, size: 4.2, color: '#fff2c8', life: 0.12, shape: 'soft' });
    this.glow.emit({ position, size: 1.2, grow: 14, color: '#ffd9a0', alpha: 0.6, life: 0.3, shape: 'ring' });
    for (let i = 0; i < 18; i++) {
      const d = v(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
      this.glow.emit({ position: position.clone().addScaledVector(d, 0.3), velocity: d.multiplyScalar(4 + Math.random() * 5), size: 0.9 + Math.random() * 0.8, grow: 1.5, color: i % 3 ? '#ff8a2a' : '#ffd166', life: 0.35 + Math.random() * 0.25, drag: 5, shape: 'soft' });
    }
    for (let i = 0; i < 14; i++) {
      const d = v(Math.random() - 0.5, 0.4 + Math.random(), Math.random() - 0.5).normalize();
      this.smoke.emit({ position: position.clone().addScaledVector(d, 0.5), velocity: d.multiplyScalar(2 + Math.random() * 2.5), size: 1 + Math.random(), grow: 1.4, color: i % 2 ? '#5d5a57' : '#7b7672', alpha: 0.75, life: 1.6 + Math.random() * 1.2, drag: 1.6, gravity: -0.4 });
    }
    for (let i = 0; i < 22; i++) {
      const d = v(Math.random() - 0.5, 0.3 + Math.random() * 0.9, Math.random() - 0.5).normalize();
      const s = 0.07 + Math.random() * 0.12;
      this.debris.spawn(position.clone().add(v(0, 0.2, 0)), d.multiplyScalar(5 + Math.random() * 7), v(s * 2, s, s), palette[i % palette.length]!, 3 + Math.random() * 2);
    }
    this.decals.add(position.clone().setY(position.y - 0.05), v(0, 1, 0), 1.6);
  }

  shatter(pieces: ShatterPiece[]) {
    this.shatterField.add(pieces);
  }

  update(dt: number, camera: THREE.Camera) {
    this.tracers.update(dt, camera);
    this.debris.update(dt);
    this.shatterField.update(dt);
    this.glow.update(dt, camera);
    this.smoke.update(dt, camera);
  }

  clear() {
    this.tracers.clear();
    this.debris.clear();
    this.shatterField.clear();
    this.glow.clear();
    this.smoke.clear();
    this.decals.clear();
  }
}
