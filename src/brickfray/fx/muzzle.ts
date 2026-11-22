import * as THREE from 'three';
import type { WeaponId } from '../weapons/defs';
import type { SpritePool } from './sprites';

/** How a remote gun lets go, like the first-person flashes: powder fire, a wide blast, a long side-vented flame, an energy ring, a puff of air or a spray of sparks. */
type FlashKind = 'powder' | 'blast' | 'long' | 'energy' | 'air' | 'spark';

interface RemoteFlash {
  kind: FlashKind;
  /** Star radius, flame tongue length and smoke puff size (m). */
  star: number;
  tongue: number;
  smoke: number;
  fire: string;
  /** Strength of the shot's light (0 = none). */
  light: number;
}

const FLASH: Record<WeaponId, RemoteFlash> = {
  ar: { kind: 'powder', star: 0.3, tongue: 0.6, smoke: 0.1, fire: '#ffb54f', light: 1 },
  pistol: { kind: 'powder', star: 0.24, tongue: 0.36, smoke: 0.08, fire: '#ffc461', light: 0.8 },
  buzzer: { kind: 'powder', star: 0.22, tongue: 0.32, smoke: 0.07, fire: '#ffd04a', light: 0.7 },
  cannon: { kind: 'powder', star: 0.36, tongue: 0.7, smoke: 0.16, fire: '#ff9a3c', light: 1.4 },
  shotgun: { kind: 'blast', star: 0.42, tongue: 0.62, smoke: 0.16, fire: '#ffa443', light: 1.6 },
  sniper: { kind: 'long', star: 0.26, tongue: 1.1, smoke: 0.14, fire: '#ffb04a', light: 1.6 },
  nailer: { kind: 'spark', star: 0.14, tongue: 0, smoke: 0.05, fire: '#ffe27a', light: 0.35 },
  pulse: { kind: 'energy', star: 0.2, tongue: 0.42, smoke: 0, fire: '#5fd9ff', light: 0.9 },
  harpoon: { kind: 'air', star: 0.12, tongue: 0, smoke: 0.07, fire: '#e8f4ff', light: 0 }
};

/** Tracer colour and ribbon width (m) per gun, so a shot says what fired it. */
export const TRACER: Record<WeaponId, { color: string; width: number; streak: number }> = {
  ar: { color: '#ffc46b', width: 0.034, streak: 4.5 },
  pistol: { color: '#ffe08a', width: 0.03, streak: 3.5 },
  buzzer: { color: '#fff06a', width: 0.03, streak: 3.5 },
  cannon: { color: '#ff8a3a', width: 0.042, streak: 5 },
  shotgun: { color: '#ffb35a', width: 0.022, streak: 2.2 },
  sniper: { color: '#a8dcff', width: 0.06, streak: 13 },
  nailer: { color: '#8fb4ff', width: 0.03, streak: 3 },
  pulse: { color: '#4fd4ff', width: 0.04, streak: 6 },
  harpoon: { color: '#7fe0c8', width: 0.034, streak: 2 }
};

const SHOT_COLOR: Record<FlashKind, string> = { powder: '#ffc27a', blast: '#ffb46a', long: '#ffc27a', energy: '#7fd8ff', air: '#ffffff', spark: '#ffe6a0' };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const jitter = (spread: number) => (Math.random() - 0.5) * spread;
const view = new THREE.Vector3();
const side = new THREE.Vector3();
const lift = new THREE.Vector3();

/** On-screen angle of a world direction and how much of it is across the screen (0 = straight at the camera). */
function screenAngle(dir: THREE.Vector3, camera: THREE.Camera | null): [number, number] {
  if (!camera) return [0, 1];
  view.copy(dir).transformDirection(camera.matrixWorldInverse);
  return [Math.atan2(view.y, view.x), Math.hypot(view.x, view.y)];
}

/**
 * A remote shooter's muzzle flash in world space, styled per gun. Everything stays small and shrinks further when
 * the barrel points at the camera, so a shooter facing it keeps his face. Returns the shot light's colour and
 * strength (strength 0: no light).
 */
export function remoteMuzzle(glow: SpritePool, smoke: SpritePool, position: THREE.Vector3, dir: THREE.Vector3, weapon: WeaponId, camera: THREE.Camera | null): [string, number] {
  const f = FLASH[weapon];
  const [angle, reach] = screenAngle(dir, camera);
  // Head-on the star alone carries the flash: kept under the size of a face.
  const star = f.star * (0.6 + 0.4 * Math.min(1, reach * 1.6));
  const tip = position.clone().addScaledVector(dir, 0.05);
  const tongue = (length: number, along: THREE.Vector3, rotation: number, color: string, width = 1) => {
    const [, r] = screenAngle(along, camera);
    if (r < 0.25) return;
    // The sprite is centred: its base sits on the muzzle when its middle is half its on-screen length ahead.
    glow.emit({ position: position.clone().addScaledVector(along, length * 0.5), size: length * r * width, color, life: 0.06, shape: 'tongue', rotation });
  };
  const puff = (size: number, color: string, alpha: number, count: number, speed: number, ahead = 0.08) => {
    for (let i = 0; i < count; i++) {
      const at = position.clone().addScaledVector(dir, ahead + i * size * 0.8);
      smoke.emit({ position: at, velocity: dir.clone().multiplyScalar(speed * (1 + i * 0.5)).add(v(jitter(0.2), 0.3, jitter(0.2))), size: size * (1 + i * 0.3), grow: 0.7, color, alpha, life: 0.5 + i * 0.12, drag: 1.6 });
    }
  };
  switch (f.kind) {
    case 'powder':
    case 'blast': {
      glow.emit({ position: tip, size: star * 0.34, color: '#fffbea', life: 0.07, shape: 'soft' });
      glow.emit({ position: tip, size: star, color: f.fire, alpha: 0.95, life: 0.06, shape: 'flare', rotation: angle + jitter(0.5) });
      if (f.kind === 'blast') {
        // A shotgun's flame fans out: three short tongues spread about the barrel.
        for (const a of [-0.32, 0, 0.32]) tongue(f.tongue * (a === 0 ? 1 : 0.7), dir, angle + a, f.fire, 1.25);
      } else {
        // A slim flame with two short prongs, a little different each shot: side-on it reads as fire, not one long card.
        const k = 0.85 + Math.random() * 0.3;
        tongue(f.tongue * 0.55 * k, dir, angle, f.fire);
        for (const a of [-0.36, 0.36]) tongue(f.tongue * 0.36 * k, dir, angle + a + jitter(0.12), f.fire);
      }
      glow.emit({ position: tip, size: star * 0.9, color: f.fire, alpha: 0.16, life: 0.08, shape: 'soft' });
      puff(f.smoke, '#d8d8d8', 0.24, f.kind === 'blast' ? 2 : 1, 0.8);
      break;
    }
    case 'long': {
      glow.emit({ position: tip, size: star * 0.4, color: '#fffbea', life: 0.08, shape: 'soft' });
      glow.emit({ position: tip, size: star, color: f.fire, alpha: 0.9, life: 0.06, shape: 'flare', rotation: angle });
      tongue(f.tongue, dir, angle, f.fire, 0.8);
      // The muzzle brake vents flame out to both sides of the barrel.
      side.crossVectors(dir, lift.set(0, 1, 0)).normalize();
      for (const s of [1, -1]) {
        const out = side.clone().multiplyScalar(s);
        const [a] = screenAngle(out, camera);
        tongue(0.36, out, a, f.fire, 0.9);
      }
      puff(f.smoke, '#dadada', 0.26, 2, 0.7);
      break;
    }
    case 'energy': {
      glow.emit({ position: tip, size: star * 0.45, color: '#e8fbff', life: 0.07, shape: 'soft' });
      glow.emit({ position: tip, size: star * 0.7, grow: 2.6, color: f.fire, alpha: 0.95, life: 0.14, shape: 'ring' });
      glow.emit({ position: tip.clone().addScaledVector(dir, 0.08), size: star * 0.5, grow: 2, color: '#a9ecff', alpha: 0.7, life: 0.12, shape: 'ring', delay: 0.02 });
      tongue(f.tongue, dir, angle, f.fire, 0.55);
      glow.emit({ position: tip, size: star * 1.3, color: f.fire, alpha: 0.22, life: 0.1, shape: 'soft' });
      break;
    }
    case 'spark': {
      glow.emit({ position: tip, size: star * 0.5, color: '#fffbea', life: 0.05, shape: 'soft' });
      glow.emit({ position: tip, size: star, color: f.fire, alpha: 0.9, life: 0.05, shape: 'star' });
      for (let i = 0; i < 6; i++) {
        const velocity = dir.clone().multiplyScalar(3 + Math.random() * 2).add(v(jitter(3.4), jitter(2.4) + 0.6, jitter(3.4)));
        const [a] = screenAngle(velocity, camera);
        glow.emit({ position: tip, velocity, size: 0.07, color: '#ffd36a', life: 0.1 + Math.random() * 0.08, shape: 'spark', rotation: a, gravity: 9, drag: 2 });
      }
      puff(f.smoke, '#cfcac0', 0.2, 1, 0.5);
      break;
    }
    case 'air': {
      // A gas-fired spear gun: no fire, a ring of pushed air and a puff of mist.
      glow.emit({ position: tip, size: star, grow: 1.6, color: f.fire, alpha: 0.28, life: 0.12, shape: 'ring' });
      puff(f.smoke, '#eef6fb', 0.2, 2, 1.6, 0.14);
      break;
    }
  }
  return [SHOT_COLOR[f.kind], f.light];
}
