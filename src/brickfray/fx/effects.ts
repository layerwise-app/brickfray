import * as THREE from 'three';
import type { ShatterPiece } from '../characters/types';
import type { Kit } from '../engine/kit';
import type { QualityLevel } from '../engine/quality';
import type { CollisionWorld } from '../sim/collision';
import type { WeaponId } from '../weapons/defs';
import { AoMask } from './ao-mask';
import { BlobShadows } from './blob-shadows';
import { Debris } from './debris';
import { Decals, type DecalKind } from './decals';
import { explode } from './explosion';
import { remoteMuzzle } from './muzzle';
import { buildGroundContact } from './ground-contact';
import { ShatterField } from './shatter';
import { Shockwaves } from './shockwave';
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

/** The mark a bullet leaves on each surface, and how wide it is in meters. */
const MARK: Record<string, { kind: DecalKind; size: number }> = {
  plastic: { kind: 'chip', size: 0.2 },
  stone: { kind: 'spall', size: 0.24 },
  metal: { kind: 'dent', size: 0.22 },
  glass: { kind: 'crack', size: 0.42 },
  wood: { kind: 'splinter', size: 0.3 }
};

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const jitter = (spread: number) => (Math.random() - 0.5) * spread;

const HEAD_GOLD = '#ffd23f';
/** The one flash light's settings for a blast and for a shot; a blast wins while it lasts. */
const BLAST = { color: '#ffb466', distance: 16, decay: 1.6, peak: 180, life: 0.4 };
const SHOT = { color: '#ffc27a', distance: 5, decay: 2, peak: 2, life: 0.07 };
const across = new THREE.Vector3();
const up = new THREE.Vector3();
const probe = new THREE.Vector3();
/** What a remote figure carries, written on its root by the match's remotes: its gun and the gun's muzzle node. */
interface FigureGun {
  weapon: WeaponId;
  muzzle: THREE.Object3D;
}
/** Share of a mark's width that is visibly drawn, and the sizes tried when it does not fit on the face it hit. */
const MARK_REACH = 0.42;
const MARK_FITS = [1, 0.7, 0.45];
/** A collider face narrower than this (m) is a post or pole: no marks on it. */
const MARK_POST = 0.3;

/** Every world-space effect behind one facade; all pools live in `root`. */
export class Effects {
  readonly root = new THREE.Group();
  readonly tracers = new Tracers();
  readonly debris: Debris;
  readonly shatterField: ShatterField;
  readonly glow = new SpritePool('additive', 320);
  readonly smoke = new SpritePool('alpha', 220);
  readonly billows = new SpritePool('billow', 192);
  readonly level: QualityLevel;
  readonly shockwaves = new Shockwaves();
  readonly decals: Decals;
  private readonly blobs: BlobShadows | null = null;
  /** One light for explosions, dark between them: it stays in the scene so lighting it never recompiles a shader. */
  private readonly flash: THREE.PointLight | null = null;
  private flashLeft = 0;
  private flashKind: typeof BLAST | typeof SHOT = BLAST;
  private flashStrength = 1;
  private figures: THREE.Object3D | null = null;
  private camera: THREE.Camera | null = null;
  onChipBounce: ((position: THREE.Vector3, speed: number) => void) | null = null;

  constructor(
    kit: Kit,
    private readonly world: CollisionWorld | null
  ) {
    this.level = kit.profile.level;
    this.debris = new Debris(kit, world);
    this.shatterField = new ShatterField(world, kit.profile.level === 'low' ? 60 : kit.profile.level === 'medium' ? 140 : 260);
    this.decals = new Decals(kit.profile.maxDecals);
    this.debris.onBounce = (p, s) => this.onChipBounce?.(p, s);
    this.shatterField.onClatter = (p, s) => this.onChipBounce?.(p, s);
    if (kit.profile.ambientOcclusion) {
      this.billows.mask = new AoMask(96, world);
      this.root.add(this.billows.mask.mesh);
    }
    this.root.add(this.debris.mesh, this.shatterField.group, this.decals.mesh, this.billows.mesh, this.smoke.mesh, this.shockwaves.mesh, this.tracers.mesh, this.glow.mesh);
    if (kit.profile.shadows) {
      this.flash = new THREE.PointLight(BLAST.color, 0, BLAST.distance, BLAST.decay);
      this.root.add(this.flash);
    } else {
      this.blobs = new BlobShadows(world);
      this.root.add(this.blobs.mesh);
      if (world) this.root.add(buildGroundContact(world));
    }
    this.root.name = 'effects';
    this.tracers.weaponAt = (p) => this.gunAt(p)?.weapon ?? this.ownWeapon(p);
  }

  /** The remote gun whose muzzle is at `p` (a remote's shot starts at its muzzle). */
  private gunAt(p: THREE.Vector3): FigureGun | null {
    // The match keeps every other player's rig in a scene group of this name.
    this.figures ??= this.root.parent?.getObjectByName('remotes') ?? null;
    for (const f of this.figures?.children ?? []) {
      const gun = f.userData.gun as FigureGun | undefined;
      if (gun && f.visible && gun.muzzle.getWorldPosition(probe).distanceToSquared(p) < 1e-4) return gun;
    }
    return null;
  }

  /** The local player's gun, for a shot that starts next to the camera. */
  private ownWeapon(p: THREE.Vector3): WeaponId | null {
    if (!this.camera || this.camera.getWorldPosition(probe).distanceToSquared(p) > 4) return null;
    return (this.figures?.userData.selfWeapon as WeaponId | undefined) ?? null;
  }

  impact(point: THREE.Vector3, normal: THREE.Vector3, surface: string, color?: THREE.ColorRepresentation) {
    const c = color ?? SURFACE_COLOR[surface] ?? SURFACE_COLOR.plastic!;
    if (surface === 'water') {
      for (let i = 0; i < 6; i++) {
        this.smoke.emit({ position: point, velocity: v(jitter(1.5), 2 + Math.random() * 2.5, jitter(1.5)), size: 0.12, grow: 0.4, color: '#e8f6ff', alpha: 0.8, life: 0.5, gravity: 9 });
      }
      return;
    }
    if (surface === 'foliage') {
      this.debris.burst(point, normal, c, 4, 2, 0.06);
      return;
    }
    const mark = MARK[surface] ?? MARK.plastic!;
    const size = this.fitMark(point, normal, mark.size);
    if (size > 0) this.decals.add(mark.kind, point, normal, size);
    const out = point.clone().addScaledVector(normal, 0.03);
    this.glow.emit({ position: out, size: 0.2, color: '#fff1c4', life: 0.06, shape: 'star' });
    switch (surface) {
      case 'metal':
        this.debris.burst(point, normal, c, 2, 3, 0.04);
        for (let i = 0; i < 7; i++) {
          const dir = normal.clone().multiplyScalar(4).add(v(jitter(6), Math.random() * 4, jitter(6)));
          this.glow.emit({ position: point, velocity: dir, size: 0.04, color: '#ffc46b', life: 0.25 + Math.random() * 0.2, shape: 'soft', gravity: 12 });
        }
        break;
      case 'glass':
        for (let i = 0; i < 6; i++) {
          const s = 0.03 + Math.random() * 0.04;
          this.debris.spawn(out, normal.clone().multiplyScalar(1.5 + Math.random() * 2).add(v(jitter(2.5), Math.random() * 1.5, jitter(2.5))), v(s, 0.008, s * 1.4), '#dff4fb', 1.2 + Math.random());
        }
        this.glow.emit({ position: out, size: 0.34, color: '#e8fbff', alpha: 0.7, life: 0.09, shape: 'star' });
        break;
      case 'wood':
        for (let i = 0; i < 6; i++) {
          const s = 0.05 + Math.random() * 0.07;
          this.debris.spawn(out, normal.clone().multiplyScalar(2 + Math.random() * 2).add(v(jitter(3), Math.random() * 2.5, jitter(3))), v(0.014, 0.012, s), i % 2 ? c : '#e6c794', 1.4 + Math.random());
        }
        break;
      default:
        this.debris.burst(point, normal, c, 5, 3, 0.05);
    }
    this.smoke.emit({ position: point.clone().addScaledVector(normal, 0.08), velocity: normal.clone().multiplyScalar(0.6), size: 0.18, grow: 1, color: c, alpha: surface === 'stone' ? 0.7 : 0.5, life: 0.55, drag: 2 });
  }

  /**
   * The largest size at which a mark centred on `point` still lies on the face that was hit: its rim is probed at
   * eight points, and a probe that falls off an edge or onto a step shrinks the mark, or drops it (0).
   */
  private fitMark(point: THREE.Vector3, normal: THREE.Vector3, size: number) {
    if (!this.world) return size;
    // Posts and poles have box colliders wider than the round thing drawn: a mark on one would hang in the air.
    probe.copy(point).addScaledVector(normal, 0.04);
    const centre = this.world.raycast(probe.x, probe.y, probe.z, -normal.x, -normal.y, -normal.z, 0.1, true);
    if (centre) {
      const b = this.world.boxes;
      const o = centre.index * 6;
      const axis = Math.abs(normal.x) > 0.7 ? 0 : Math.abs(normal.y) > 0.7 ? 1 : 2;
      for (let k = 0; k < 3; k++) if (k !== axis && b[o + 3 + k]! - b[o + k]! < MARK_POST) return 0;
    }
    across.set(0, 1, 0);
    if (Math.abs(normal.y) > 0.9) across.set(1, 0, 0);
    across.cross(normal).normalize();
    up.crossVectors(normal, across);
    for (const k of MARK_FITS) {
      const r = size * k * MARK_REACH;
      let fits = true;
      for (let i = 0; i < 8 && fits; i++) {
        const a = (i / 8) * Math.PI * 2;
        probe.copy(point).addScaledVector(across, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).addScaledVector(normal, 0.04);
        const hit = this.world.raycast(probe.x, probe.y, probe.z, -normal.x, -normal.y, -normal.z, 0.1, true);
        fits = !!hit && Math.abs(hit.t - 0.04) < 0.02 && hit.normal[0] * normal.x + hit.normal[1] * normal.y + hit.normal[2] * normal.z > 0.9;
      }
      if (fits) return size * k;
    }
    return 0;
  }

  bodyHit(point: THREE.Vector3, dir: THREE.Vector3, color: THREE.ColorRepresentation, head: boolean) {
    const n = dir.clone().negate();
    if (!head) {
      this.debris.burst(point, n, color, 4, 3.5, 0.05);
      this.glow.emit({ position: point, size: 0.26, color: '#ffffff', life: 0.07, shape: 'star' });
      return;
    }
    this.debris.burst(point, n, color, 6, 4, 0.05);
    this.debris.burst(point, n, HEAD_GOLD, 5, 5, 0.04);
    this.glow.emit({ position: point, size: 0.75, color: '#fff3c4', life: 0.1, shape: 'star' });
    this.glow.emit({ position: point, size: 0.2, grow: 3, color: HEAD_GOLD, alpha: 0.9, life: 0.22, shape: 'ring' });
    for (let i = 0; i < 9; i++) {
      const velocity = n.clone().multiplyScalar(2.5).add(v(jitter(5), 1 + Math.random() * 3.5, jitter(5)));
      this.glow.emit({ position: point, velocity, size: 0.05, color: '#ffe28a', life: 0.28 + Math.random() * 0.15, shape: 'soft', gravity: 11 });
    }
  }

  /**
   * Muzzle flash in world space for other players (the local one draws in the view layer), styled per gun. Given only
   * `big` (shotgun or sniper), the gun is found from the remote figure whose muzzle is at `position`, which also gives
   * the barrel's real direction.
   */
  muzzle(position: THREE.Vector3, dir: THREE.Vector3, weapon: WeaponId | boolean) {
    let id: WeaponId = weapon === true ? 'shotgun' : 'ar';
    let barrel = dir;
    if (typeof weapon === 'string') id = weapon;
    else {
      const gun = this.gunAt(position);
      if (gun) {
        id = gun.weapon;
        barrel = gun.muzzle.getWorldDirection(probe).negate();
      }
    }
    const [color, strength] = remoteMuzzle(this.glow, this.smoke, position, barrel, id, this.camera);
    if (strength > 0) this.shotLight(position.clone().addScaledVector(barrel, 0.6), strength, color);
  }

  /** The brief light of a shot on nearby walls and the shooter's hands (tiers with shadow maps only). */
  shotLight(position: THREE.Vector3, strength: boolean | number, color: string = SHOT.color) {
    if (!this.flash || (this.flashKind === BLAST && this.flashLeft > 0)) return;
    this.light(position, SHOT, typeof strength === 'number' ? strength : strength ? 1.6 : 1, color);
  }

  explosion(position: THREE.Vector3, palette: readonly THREE.ColorRepresentation[]) {
    const floor = this.world?.raycast(position.x, position.y + 0.3, position.z, 0, -1, 0, 3, false);
    const ground = floor ? position.y + 0.3 - floor.t : null;
    explode(this, position, ground, palette);
    // Medium draws without tone mapping: any light strong enough to clip turns the floor into a hard cream ellipse,
    // so there it is a faint wash from higher up that falls off smoothly.
    const high = this.level === 'high';
    this.light(position.clone().setY(position.y + (high ? 1.2 : 2.2)), BLAST, high ? 1 : 0.03);
  }

  private light(position: THREE.Vector3, kind: typeof BLAST | typeof SHOT, strength: number, color: string = kind.color) {
    if (!this.flash) return;
    this.flash.position.copy(position);
    this.flash.color.set(color);
    this.flash.distance = kind.distance;
    this.flash.decay = kind.decay;
    this.flashKind = kind;
    this.flashLeft = kind.life;
    this.flash.intensity = kind.peak * strength;
    this.flashStrength = strength;
  }

  shatter(pieces: ShatterPiece[]) {
    this.shatterField.add(pieces);
  }

  update(dt: number, camera: THREE.Camera) {
    this.figures ??= this.root.parent?.getObjectByName('remotes') ?? null;
    if (this.blobs) {
      this.blobs.update(this.figures?.children ?? [], camera);
    }
    this.camera = camera;
    if (this.flash && this.flashLeft > 0) {
      this.flashLeft = Math.max(0, this.flashLeft - dt);
      const k = this.flashKind;
      // A shot's light holds through its first frames, then drops; a blast decays from its peak.
      const t = this.flashLeft / k.life;
      this.flash.intensity = k.peak * this.flashStrength * (k === SHOT ? Math.min(1, t * 2) : t * t);
    }
    this.tracers.update(dt);
    this.debris.update(dt);
    this.shatterField.update(dt);
    this.shockwaves.update(dt);
    this.glow.update(dt, camera);
    this.smoke.update(dt, camera);
    this.billows.update(dt, camera);
  }

  clear() {
    this.tracers.clear();
    this.debris.clear();
    this.shatterField.clear();
    this.shockwaves.clear();
    this.glow.clear();
    this.smoke.clear();
    this.billows.clear();
    this.decals.clear();
    if (this.flash) this.flash.intensity = 0;
    this.flashLeft = 0;
  }
}
