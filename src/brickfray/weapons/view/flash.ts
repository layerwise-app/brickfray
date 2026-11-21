import * as THREE from 'three';

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
const ENERGY: Tint = [0.35, 0.9, 1];
const SPARK: Tint = [1, 0.88, 0.45];
const SMOKE = new THREE.Color(0.72, 0.7, 0.68);
const MIST = new THREE.Color(0.95, 0.98, 1);

/** Fully aimed, the flash facing the eye is this much smaller, and every card this much shorter-lived. */
const AIM_SMALLER = 0.6;
const AIM_SHORTER = 0.4;
/** …and the flame tongues and side jets this much shorter and narrower. */
const AIM_TIGHTER = 0.35;

const Cell = { Star: 0, Petal: 1, Core: 2, Ring: 3, Puff: 4, Streak: 5 } as const;
type Cell = (typeof Cell)[keyof typeof Cell];
const CELLS = 6;
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

/**
 * First-person muzzle flash: additive cards that change shape over their 2–4 frames (the core burns out first, the
 * flame stretches and thins), plus smoke or mist sprites left hanging where the shot went off.
 */
export class MuzzleFlash {
  private readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly texture = atlas();
  private readonly cards: Card[] = [];
  private readonly puffs: Puff[] = [];
  private next = 0;
  private age = 1;

  constructor(private readonly scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CARDS * 12), 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(CARDS * 8), 2));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CARDS * 16), 4));
    const index: number[] = [];
    for (let q = 0; q < CARDS; q++) index.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
    this.geometry.setIndex(index);
    const material = new THREE.MeshBasicMaterial({ map: this.texture, color: new THREE.Color(1.7, 1.7, 1.7), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
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
    muzzle.add(this.mesh);
    this.cards.length = 0;
    const brief = 1 - AIM_SHORTER * aim;
    const card = (corners: THREE.Vector3[], cell: Cell, tint: Tint, across: number, along: number, life: number, delay = 0, peak = 1) =>
      this.cards.push({ corners, cell, tint, across, along, delay, life: life * brief, peak });
    const star = s.star * rnd(0.85, 1.15) * (1 - AIM_SMALLER * aim);
    switch (s.kind) {
      case 'powder':
      case 'blast': {
        const wide = s.kind === 'blast';
        card(facing(star, -0.01), Cell.Star, FIRE, 9, 0, 0.034);
        card(facing(star * 0.45, -0.02), Cell.Core, HOT, 4, 0, 0.018);
        const turn = Math.random() * Math.PI;
        for (let i = 0; i < s.prongs; i++) {
          const a = turn + (i / s.prongs) * Math.PI + rnd(-0.25, 0.25);
          card(along(s.petal * rnd(0.6, 0.9), s.width * rnd(0.8, 1.2), a, wide ? rnd(0.18, 0.32) : rnd(-0.06, 0.06)), Cell.Petal, FIRE, -3, 16, 0.05);
        }
        if (s.side > 0) for (const d of [1, -1]) card(along(s.side * 2, s.side * 0.6, Math.PI / 2, 0, 0).map((p) => v(p.z * -d, p.y, p.x - 0.004)), Cell.Petal, FIRE, 2, 10, 0.04);
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
    this.mesh.visible = true;
    this.age = -1;
    this.smoke(muzzle, s, 1 - AIM_SMALLER * aim);
  }

  update(dt: number) {
    this.age = this.age < 0 ? 0 : this.age + dt;
    const alive = this.cards.some((c) => this.age < c.delay + c.life);
    this.mesh.visible = alive;
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
    this.mesh.removeFromParent();
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
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
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = this.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const color = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let q = 0; q < CARDS; q++) {
      const c = this.cards[q];
      const a = c ? age - c.delay : -1;
      const k = c && a >= 0 ? a / c.life : 1;
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

/** Atlas of white-hot shapes the cards tint: spiky star, flame petal, soft core, energy ring, smoke puff, spark streak. */
function atlas(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S * CELLS;
  canvas.height = S;
  const g = canvas.getContext('2d')!;
  const radial = (cx: number, cy: number, r: number, stops: [number, string][]) => {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [at, c] of stops) grad.addColorStop(at, c);
    return grad;
  };
  const fire: [number, string][] = [[0, 'rgba(255,255,245,1)'], [0.25, 'rgba(255,236,170,0.95)'], [0.6, 'rgba(255,170,80,0.55)'], [1, 'rgba(255,120,40,0)']];
  // Star: 7 uneven spikes.
  g.save();
  g.translate(S / 2, S / 2);
  g.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = i % 2 === 0 ? S * (0.38 + 0.1 * Math.sin(i * 2.3)) : S * 0.13;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = radial(0, 0, S * 0.48, fire);
  g.fill();
  g.restore();
  // Petal: teardrop, v = 1 the far end.
  g.save();
  g.translate(S * 1.5, 0);
  g.beginPath();
  g.moveTo(0, S * 0.98);
  g.bezierCurveTo(S * 0.42, S * 0.7, S * 0.3, S * 0.2, 0, S * 0.02);
  g.bezierCurveTo(-S * 0.3, S * 0.2, -S * 0.42, S * 0.7, 0, S * 0.98);
  const pg = g.createLinearGradient(0, S, 0, 0);
  pg.addColorStop(0, 'rgba(255,252,235,1)');
  pg.addColorStop(0.35, 'rgba(255,220,150,0.9)');
  pg.addColorStop(0.75, 'rgba(255,150,70,0.45)');
  pg.addColorStop(1, 'rgba(255,110,40,0)');
  g.fillStyle = pg;
  g.fill();
  g.restore();
  // Core.
  g.fillStyle = radial(S * 2.5, S / 2, S * 0.5, fire);
  g.fillRect(S * 2, 0, S, S);
  // Ring: thin bright band with a soft halo, empty middle.
  g.fillStyle = radial(S * 3.5, S / 2, S * 0.5, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0)'], [0.78, 'rgba(255,255,255,1)'], [0.86, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
  g.fillRect(S * 3, 0, S, S);
  // Puff: lumpy soft blob.
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const cx = S * 4.5 + Math.cos(a) * S * 0.14 * (i % 3);
    const cy = S / 2 + Math.sin(a) * S * 0.14 * (i % 3);
    g.fillStyle = radial(cx, cy, S * 0.32, [[0, 'rgba(255,255,255,0.5)'], [0.6, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
    g.fillRect(S * 4, 0, S, S);
  }
  // Streak: narrow, brightest at the near end.
  const sg = g.createLinearGradient(0, S, 0, 0);
  sg.addColorStop(0, 'rgba(255,255,255,1)');
  sg.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sg;
  g.beginPath();
  g.moveTo(S * 5.5 - S * 0.12, S);
  g.lineTo(S * 5.5 + S * 0.12, S);
  g.lineTo(S * 5.5 + S * 0.03, 0);
  g.lineTo(S * 5.5 - S * 0.03, 0);
  g.closePath();
  g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
