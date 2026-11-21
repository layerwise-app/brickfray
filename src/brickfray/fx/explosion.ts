import * as THREE from 'three';
import type { Effects } from './effects';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const SOOT = ['#5a5755', '#6f6c69', '#86827d', '#4b4846', '#7a7672'] as const;
/** The small puffs that roll up over the column catch the sun. */
const SOOT_LIT = ['#9d9891', '#8e8983', '#aaa59d'] as const;
const DUST = '#b3aa9b';
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A direction on the upper hemisphere, flattened toward the ground by `flat` (0 = dome, 1 = disc). */
function outward(flat: number) {
  const a = Math.random() * Math.PI * 2;
  const up = Math.random() * (1 - flat);
  const side = Math.sqrt(1 - up * up);
  return v(Math.cos(a) * side, up, Math.sin(a) * side);
}

/**
 * A grenade going off: a short flash, a billowing noise-shaded fireball that cools into rising soot,
 * a dust ring and shockwave across the floor, sparks and tumbling bricks, and a scorch mark.
 * `ground` is the floor height under the blast, or null in mid-air.
 */
export function explode(fx: Effects, position: THREE.Vector3, ground: number | null, palette: readonly THREE.ColorRepresentation[]) {
  const low = fx.level === 'low';
  const high = fx.level === 'high';
  const base = ground ?? position.y - 0.4;
  const core = position.clone().setY(Math.max(position.y, base) + 0.75);

  // Flash: bright for two or three frames, soft all the way out, never a white-out. Only high draws through tone
  // mapping; the other tiers would clip white light to a flat disc, so their flash and the fire's heart are orange.
  fx.glow.emit({ position: core, size: high ? 5.5 : 4.4, color: high ? '#ffd9a0' : '#ff9f52', alpha: high ? 0.8 : 0.34, life: 0.09, shape: 'soft' });
  fx.glow.emit({ position: core, size: high ? 1.8 : 1.3, color: high ? '#fff4dc' : '#ffcf96', alpha: high ? 0.9 : 0.5, life: 0.07, shape: 'soft' });
  const heart = high ? '#ffffff' : '#ffb57a';
  const flame = high ? '#ffffff' : '#ffd0a2';
  if (high) fx.glow.emit({ position: core, size: 2.6, color: '#fff4dc', alpha: 0.85, life: 0.06, shape: 'star' });
  if (!low) fx.glow.emit({ position: core, size: 1.2, grow: 26, color: '#ffe2b0', alpha: high ? 0.18 : 0.1, life: 0.16, shape: 'ring' });

  // Fireball: a white-hot heart, billows rolling outward and up, and a few tongues thrown wide.
  for (let i = 0; i < 4; i++) {
    fx.billows.emit({ position: core.clone().add(v(rand(-0.2, 0.2), rand(-0.1, 0.25), rand(-0.2, 0.2))), velocity: v(0, rand(0.6, 1.4), 0), size: rand(1.3, 1.7), grow: 2.4, color: heart, life: rand(0.26, 0.34), drag: 3, shape: 'fire', spin: rand(-1, 1) });
  }
  for (let i = 0; i < (low ? 11 : 13); i++) {
    const d = outward(0.25);
    const at = core.clone().addScaledVector(d, rand(0.15, 0.5));
    at.y = Math.max(at.y, base + 0.55);
    fx.billows.emit({ position: at, velocity: d.multiplyScalar(rand(2, 5)).add(v(0, rand(0.8, 1.8), 0)), size: rand(1, 1.5), grow: rand(1.8, 2.6), color: flame, life: rand(0.42, 0.72), drag: 4.2, gravity: -1.5, shape: 'fire', spin: rand(-0.8, 0.8) });
  }
  for (let i = 0; i < (low ? 6 : 7); i++) {
    const d = outward(0.45);
    fx.billows.emit({ position: core.clone().addScaledVector(d, 0.4), velocity: d.multiplyScalar(rand(6, 10)).add(v(0, 1.5, 0)), size: rand(0.45, 0.7), grow: 1.4, color: flame, life: rand(0.28, 0.42), drag: 5.5, shape: 'fire' });
  }

  // Soot rises out of the fire as it dies, not with it, or it would hide the flame: big slow puffs make the column,
  // smaller quicker ones of other greys roll up through and in front of it so it has lumps and depth. It thins into
  // holes and clears in two or three seconds, so a fight goes on through it.
  for (let i = 0; i < (low ? 9 : 18); i++) {
    const d = outward(0.3);
    const small = i % 3 === 2;
    const at = core.clone().addScaledVector(d, rand(0.4, 1.1));
    at.y = Math.max(at.y, base + 0.7);
    fx.billows.emit({
      position: at,
      velocity: d.multiplyScalar(rand(0.8, 2.2)).add(v(0, small ? rand(2.2, 3.2) : rand(1.1, 2.2), 0)),
      size: small ? rand(0.7, 1.0) : rand(1.1, 1.7),
      grow: small ? rand(0.5, 0.8) : rand(0.7, 1.1),
      color: small ? SOOT_LIT[i % SOOT_LIT.length]! : SOOT[i % SOOT.length]!,
      alpha: 0.86,
      life: rand(1.6, 2.6),
      drag: 1.6,
      gravity: -0.5,
      shape: 'smoke',
      spin: rand(-0.35, 0.35),
      delay: rand(0.1, 0.28)
    });
  }

  for (let i = 0; i < 22; i++) {
    const d = outward(0.1);
    fx.glow.emit({ position: core, velocity: d.multiplyScalar(rand(9, 20)), size: rand(0.08, 0.15), color: i % 3 ? '#ffc46b' : '#fff1c4', life: rand(0.35, 0.7), shape: 'soft', gravity: 14, drag: 1.2 });
  }

  for (let i = 0; i < 26; i++) {
    const d = outward(0.1);
    const s = rand(0.09, 0.19);
    const brick = i % 3 === 0;
    fx.debris.spawn(core, d.multiplyScalar(rand(5, 13)).setY(d.y + 2), brick ? v(s * 2.2, s * 1.1, s * 1.2) : v(s, s * 0.7, s), palette[i % palette.length]!, rand(3, 5));
  }

  if (ground === null) return;
  const floor = v(position.x, ground + 0.02, position.z);
  // A faint ring racing out on high; the other tiers would clip a ring on the bright floor into a hard ellipse, so
  // they get a short warm pool of light that falls off softly.
  if (high) fx.shockwaves.add(floor, 0.4, 5.6, 0.3, '#c8b896');
  else fx.shockwaves.add(floor, 1, 4.6, 0.24, '#5a3a20', true);
  fx.decals.add('scorch', v(position.x, ground, position.z), UP, 3.6, 0.92);
  // A ring of dust kicked along the floor.
  const ring = low ? 7 : 10;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + Math.random() * 0.5;
    const d = v(Math.cos(a), 0, Math.sin(a));
    fx.billows.emit({ position: floor.clone().addScaledVector(d, 0.9).setY(ground + 0.45), velocity: d.multiplyScalar(rand(5, 7.5)).setY(0.4), size: 0.7, grow: 1.9, color: DUST, alpha: 0.7, life: rand(0.9, 1.4), drag: 3.4, shape: 'smoke', spin: rand(-0.5, 0.5), delay: 0.03 });
  }
}
