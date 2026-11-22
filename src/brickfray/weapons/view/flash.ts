import * as THREE from 'three';
import { Cell, CELLS, flashAtlas } from './flash-atlas';

/** How a gun's muzzle lets go: burning powder, a wide shotgun blast, a long rifle flame, an energy ring, a puff of air or a spray of sparks. */
export type FlashKind = 'powder' | 'blast' | 'long' | 'energy' | 'air' | 'spark';

/** Muzzle flash per weapon: kind, flame tongues (or sparks), star radius, flame length and width, side blasts, smoke puff size (all meters). */
export interface FlashStyle {
  kind: FlashKind;
  prongs: number;
  star: number;
  petal: number;
  width: number;
  side: number;
  smoke: number;
}

type Tint = readonly [number, number, number];
const FIRE: Tint = [1, 0.82, 0.55];
const HOT: Tint = [1, 0.95, 0.85];
/** The glow behind a shotgun's fireball: additive, so it has to start deep orange to stay coloured. */
const EMBER: Tint = [0.95, 0.42, 0.12];
const ENERGY: Tint = [0.35, 0.9, 1];
const SPARK: Tint = [1, 0.88, 0.45];
/** The hard-edged cards carry their own colour bands. */
const PLAIN: Tint = [1, 1, 1];
const SMOKE = new THREE.Color(0.72, 0.7, 0.68);
const MIST = new THREE.Color(0.95, 0.98, 1);

/** Fully aimed, the flash facing the eye is this much smaller, and every card this much shorter-lived. */
const AIM_SMALLER = 0.6;
const AIM_SHORTER = 0.25;
/** Seconds every card stays at full strength before it fades: a flash shows whole for at least a frame or two. */
const HOLD = 0.017;
/** …and the flame tongues and side jets this much shorter and narrower. */
const AIM_TIGHTER = 0.35;

const CARDS = 12;
const PUFFS = 8;

/** One flash card: corners at birth in muzzle space, how fast it grows across and along the barrel, when it shows and how long it lasts. */
interface Card {
  corners: THREE.Vector3[];
  cell: Cell;
  tint: Tint;
  across: number;
  along: number;
  delay: number;
  life: number;
  peak: number;
}

interface Puff {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  size: number;
  grow: number;
  life: number;
  peak: number;
  age: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A card facing back along the barrel, spun about it. */
function facing(r: number, z: number, spin = Math.random() * Math.PI): THREE.Vector3[] {
  const c = Math.cos(spin) * r;
  const s = Math.sin(spin) * r;
  return [v(-c + s, -s - c, z), v(c + s, s - c, z), v(c - s, s + c, z), v(-c - s, -s + c, z)];
}

/** A card containing the barrel axis at angle `a` about it, tilted `tilt` outward, from z0 forward to -len. */
function along(len: number, w: number, a: number, tilt = 0, z0 = 0.004): THREE.Vector3[] {
  const ax = Math.cos(a) * w * 0.5;
  const ay = Math.sin(a) * w * 0.5;
  const ox = -Math.sin(a) * tilt * len;
  const oy = Math.cos(a) * tilt * len;
  return [v(-ax, -ay, z0), v(ax, ay, z0), v(ax + ox, ay + oy, -len), v(-ax + ox, -ay + oy, -len)];
}

/** Cards drawn opaque in their own colour bands (hard-edged toon fire) rather than added as light. */
const solidCell = (cell: Cell) => cell >= Cell.Bloom3;

/** A batch of flash cards sharing one material. */
function cardMesh(material: THREE.Material, renderOrder: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CARDS * 12), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(CARDS * 8), 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CARDS * 16), 4));
  const index: number[] = [];
  for (let q = 0; q < CARDS; q++) index.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return mesh;
}

/**
 * First-person muzzle flash: cards that change shape over their 2–4 frames (the core burns out first, the flame
 * stretches and thins), plus smoke or mist sprites left hanging where the shot went off. Powder flashes are hard-edged
 * opaque blooms and tongues; the rest are additive light.
 */
export class MuzzleFlash {
  private readonly root = new THREE.Group();
  private readonly glow: THREE.Mesh;
  private readonly solid: THREE.Mesh;
  private readonly texture = flashAtlas();
  private readonly cards: Card[] = [];
  private readonly puffs: Puff[] = [];
  private next = 0;
  private age = 1;

  constructor(private readonly scene: THREE.Scene) {
    const base = { map: this.texture, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false };
    this.glow = cardMesh(new THREE.MeshBasicMaterial({ ...base, color: new THREE.Color(1.7, 1.7, 1.7), blending: THREE.AdditiveBlending }), 10);
    this.solid = cardMesh(new THREE.MeshBasicMaterial(base), 11);
    this.root.add(this.glow, this.solid);
    this.root.visible = false;
    // In the scene before the first shot, so a match's warm-up frame compiles and draws it.
    scene.add(this.root);
    const puffMap = this.texture.clone();
    puffMap.repeat.set(1 / CELLS, 1);
    puffMap.offset.set(Cell.Puff / CELLS, 0);
    puffMap.needsUpdate = true;
    for (let i = 0; i < PUFFS; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffMap, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.visible = false;
      sprite.renderOrder = 9;
      scene.add(sprite);
      this.puffs.push({ sprite, velocity: new THREE.Vector3(), size: 0, grow: 0, life: 1, peak: 0, age: 1 });
    }
  }

  /**
   * Lays out a new flash on the muzzle node (its -Z is the line of fire). `aim` 0…1: in the sights the muzzle sits just
   * under the front sight and the target, so the flash facing the eye is smaller and shorter and the smoke thinner.
   */
  fire(muzzle: THREE.Object3D, style: FlashStyle, aim = 0) {
    const reach = 1 - AIM_TIGHTER * aim;
    const s = { ...style, petal: style.petal * reach, width: style.width * reach, side: style.side * reach };
    muzzle.add(this.root);
    this.cards.length = 0;
    const brief = 1 - AIM_SHORTER * aim;
    const card = (corners: THREE.Vector3[], cell: Cell, tint: Tint, across: number, along: number, life: number, delay = 0, peak = 1) =>
      this.cards.push({ corners, cell, tint, across, along, delay, life: life * brief, peak });
    const star = s.star * rnd(0.85, 1.15) * (1 - AIM_SMALLER * aim);
    switch (s.kind) {
      case 'powder': {
        // A hard-edged bloom of three or four lobes round a white core, cut, turned and stretched afresh every shot, and crisp flame tongues along the line of fire.
        const lobes = s.prongs >= 4 || Math.random() < 0.5 ? 4 : 3;
        const cut = Math.random() < 0.5;
        const bloom = lobes === 4 ? (cut ? Cell.Bloom4 : Cell.Bloom4b) : cut ? Cell.Bloom3 : Cell.Bloom3b;
        const turn = Math.random() * Math.PI * 2;
        for (let i = 0; i < s.prongs; i++) {
          const a = turn + (i / s.prongs) * Math.PI + rnd(-0.3, 0.3);
          card(along(s.petal * rnd(0.45, 0.75), s.width * rnd(0.85, 1.2), a, rnd(-0.08, 0.08)), Cell.Tongue, PLAIN, -2, 8, rnd(0.035, 0.05));
        }
        if (s.side > 0) for (const d of [1, -1]) card(along(s.side * 2, s.side * 0.6, Math.PI / 2, 0, 0).map((p) => v(p.z * -d, p.y, p.x - 0.004)), Cell.Petal, FIRE, 2, 10, 0.04);
        // Drawn last, so its white core sits over the tongues' roots.
        const stretch = rnd(0.8, 1.2);
        card(facing(star, -0.01).map((p) => p.set(p.x * stretch, p.y / stretch, p.z)), bloom, PLAIN, -4, 0, 0.04);
        break;
      }
      case 'blast': {
        // A fireball, not a white star: a deep orange glow behind fat banded flame tongues fanned round the line of fire,
        // and a banded four-lobed bloom (orange rim, yellow, white core) over their roots.
        card(facing(star * 1.2, -0.004), Cell.Star, EMBER, 8, 0, 0.045);
        const turn = Math.random() * Math.PI;
        for (let i = 0; i < s.prongs; i++) {
          const a = turn + (i / s.prongs) * Math.PI + rnd(-0.25, 0.25);
          card(along(s.petal * rnd(0.55, 0.85), s.width * rnd(1, 1.4), a, rnd(0.18, 0.32)), Cell.Tongue, PLAIN, -3, 12, rnd(0.04, 0.055));
        }
        const stretch = rnd(0.85, 1.15);
        card(facing(star * 0.75, -0.01).map((p) => p.set(p.x * stretch, p.y / stretch, p.z)), Math.random() < 0.5 ? Cell.Bloom4 : Cell.Bloom4b, PLAIN, -3, 0, 0.036);
        break;
      }
      case 'long': {
        card(facing(star * 0.5, -0.015), Cell.Core, HOT, 5, 0, 0.022);
        card(facing(star, -0.01), Cell.Star, FIRE, 6, 0, 0.03);
        for (const a of [0, Math.PI / 2]) card(along(s.petal * rnd(0.55, 0.7), s.width, a + rnd(-0.15, 0.15)), Cell.Petal, FIRE, -4, 14, 0.06);
        for (const d of [1, -1]) card(along(s.side * 2, s.side * 0.55, Math.PI / 2, 0, 0).map((p) => v(p.z * -d, p.y, p.x - 0.01)), Cell.Petal, FIRE, 3, 12, 0.05);
        break;
      }
      case 'energy': {
        card(facing(star * 0.55, -0.012), Cell.Core, HOT, 3, 0, 0.026);
        card(facing(star * 0.9, -0.016, 0), Cell.Ring, ENERGY, 22, 0, 0.07);
        card(facing(star * 0.6, -0.05, 0), Cell.Ring, ENERGY, 26, 0, 0.06, 0.016, 0.8);
        for (const a of [0.3, 0.3 + Math.PI / 2]) card(along(s.petal, s.width, a), Cell.Streak, ENERGY, 0, 10, 0.04);
        break;
      }
      case 'spark': {
        card(facing(star, -0.008), Cell.Star, SPARK, 6, 0, 0.026);
        for (let i = 0; i < s.prongs; i++) card(along(s.petal * rnd(0.5, 1), s.width, rnd(0, Math.PI * 2), rnd(0.2, 0.55), -0.01), Cell.Streak, SPARK, 0, 20, rnd(0.04, 0.065));
        break;
      }
      case 'air':
        card(facing(star, -0.012), Cell.Puff, [0.5, 0.55, 0.6], 20, 0, 0.05, 0, 0.6);
        break;
    }
    this.layout(0);
    this.root.visible = true;
    this.age = -1;
    this.smoke(muzzle, s, 1 - AIM_SMALLER * aim);
  }

  update(dt: number) {
    this.age = this.age < 0 ? 0 : this.age + dt;
    const alive = this.cards.some((c) => this.age < c.delay + HOLD + c.life);
    this.root.visible = alive;
    if (alive) this.layout(this.age);
    for (const p of this.puffs) {
      if (p.age >= p.life) continue;
      p.age += dt;
      const k = Math.min(1, p.age / p.life);
      p.sprite.visible = k < 1;
      p.sprite.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(Math.exp(-dt * 5));
      p.sprite.scale.setScalar(p.size * (1 + p.grow * k));
      (p.sprite.material as THREE.SpriteMaterial).opacity = p.peak * Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k) * (1 - k);
    }
  }

  dispose() {
    this.root.removeFromParent();
    for (const mesh of [this.glow, this.solid]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const p of this.puffs) {
      p.sprite.removeFromParent();
      (p.sprite.material as THREE.SpriteMaterial).map?.dispose();
      p.sprite.material.dispose();
    }
    this.texture.dispose();
  }

  /** Smoke (powder) or mist (air) left in the air at the muzzle, drifting down the line of fire. */
  private smoke(muzzle: THREE.Object3D, s: FlashStyle, scale: number) {
    if (s.smoke <= 0) return;
    const at = muzzle.getWorldPosition(new THREE.Vector3());
    const ahead = v(0, 0, -1).transformDirection(muzzle.matrixWorld);
    const air = s.kind === 'air';
    const count = air ? 3 : s.kind === 'long' || s.kind === 'blast' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const p = this.puffs[this.next++ % PUFFS]!;
      p.age = 0;
      p.life = air ? rnd(0.28, 0.36) : rnd(0.3, 0.45);
      p.size = s.smoke * scale * rnd(0.8, 1.2) * (air ? 0.7 + i * 0.25 : 1);
      p.grow = air ? 1.6 : 1.2;
      p.peak = air ? 0.45 : count > 1 ? 0.5 : 0.38;
      p.sprite.position.copy(at).addScaledVector(ahead, 0.02 + i * s.smoke * 0.5);
      p.velocity.copy(ahead).multiplyScalar(air ? 0.9 + i * 0.4 : 0.6).add(v(rnd(-0.05, 0.05), 0.08, rnd(-0.05, 0.05)));
      p.sprite.material.color.set(air ? MIST : SMOKE);
      p.sprite.material.rotation = Math.random() * Math.PI * 2;
    }
  }

  private layout(age: number) {
    this.layoutMesh(this.glow, this.cards.filter((c) => !solidCell(c.cell)), age);
    this.layoutMesh(this.solid, this.cards.filter((c) => solidCell(c.cell)), age);
  }

  private layoutMesh(mesh: THREE.Mesh, cards: Card[], age: number) {
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const color = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let q = 0; q < CARDS; q++) {
      const c = cards[q];
      const a = c ? age - c.delay : -1;
      const k = c && a >= 0 ? Math.max(0, a - HOLD) / c.life : 1;
      const alpha = c && k < 1 ? c.peak * Math.pow(1 - k, 1.4) : 0;
      for (let i = 0; i < 4; i++) {
        const p = c?.corners[i];
        const xy = c ? Math.max(0.2, 1 + c.across * Math.max(0, a)) : 0;
        const z = c ? 1 + c.along * Math.max(0, a) : 0;
        pos.setXYZ(q * 4 + i, p ? p.x * xy : 0, p ? p.y * xy : 0, p ? p.z * z : 0);
        color.setXYZW(q * 4 + i, c?.tint[0] ?? 0, c?.tint[1] ?? 0, c?.tint[2] ?? 0, alpha);
      }
      const u0 = (c?.cell ?? 0) / CELLS;
      uv.setXY(q * 4, u0, 0);
      uv.setXY(q * 4 + 1, u0 + 1 / CELLS, 0);
      uv.setXY(q * 4 + 2, u0 + 1 / CELLS, 1);
      uv.setXY(q * 4 + 3, u0, 1);
    }
    pos.needsUpdate = uv.needsUpdate = color.needsUpdate = true;
  }
}
