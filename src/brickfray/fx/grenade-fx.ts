import * as THREE from 'three';
import { GRENADE } from '../weapons/defs';
import { MarkBatch } from './grenade-marks';

/** Blinks per second of the fuse bulb, from a fresh fuse to the burst; the HUD warning pulses in step. */
const SLOW = 1.6;
const FAST = 9;
/** Seconds of flight the trail covers. */
const TRAIL_TIME = 0.28;
/** A grenade that has not moved for this long is lying still. */
const SETTLED = 0.12;

const BULB_ON = new THREE.Color('#ff4a22');
const BULB_OFF = new THREE.Color('#b8240e');
const HALO = new THREE.Color('#ff3a18');
const TRAIL = new THREE.Color('#ffbf5a');
const POP = new THREE.Color('#ffe08a');
const FLASH = new THREE.Color('#fff4d0');
const DUST = new THREE.Color('#efe7d4');
const UP = new THREE.Vector3(0, 1, 0);

const smooth = THREE.MathUtils.smoothstep;

/**
 * How lit the fuse bulb is (0..1) with `left` seconds to go, and how close the burst is (0 fresh, 1 now). The blink
 * speeds up as the fuse burns (phase is the integral of the rising rate, so it never jumps).
 */
export function fuseBlink(left: number) {
  const urgency = THREE.MathUtils.clamp(1 - left / GRENADE.fuse, 0, 1);
  const phase = GRENADE.fuse * (SLOW * urgency + ((FAST - SLOW) * urgency ** 3) / 3);
  const x = phase - Math.floor(phase);
  return { on: smooth(x, 0, 0.04) * (1 - smooth(x, 0.52, 0.6)), urgency };
}

interface Track {
  points: THREE.Vector3[];
  ages: number[];
  still: number;
  /** Lights up the halo for a moment after a landing. */
  flare: number;
  seen: boolean;
}

interface Pop {
  at: THREE.Vector3;
  normal: THREE.Vector3;
  /** Directions along the surface the dust puffs roll out in. */
  puffs: THREE.Vector3[];
  age: number;
  strength: number;
}

const POP_LIFE = 0.45;

/**
 * What makes a live grenade readable from across the map: a bulb on the fuse cap blinking faster as the fuse burns,
 * with a halo that holds a minimum size on screen; a short streak while it flies; a ring, a flash and dust where it
 * lands; and a pulsing ring on the floor while it lies still.
 */
export class GrenadeFx {
  private readonly marks = new MarkBatch('grenade-marks', 5);
  /** Glows of bulbs in plain sight, over the floor they would otherwise sink into; the bulbs go on top, hidden by their own ball. */
  private readonly glare = new MarkBatch('grenade-glare', 6, false);
  private readonly bulbs = new MarkBatch('grenade-bulbs', 7);
  readonly group = new THREE.Group();
  private tracks = new Map<number, Track>();
  private pops: Pop[] = [];
  private v = new THREE.Vector3();
  private dt = 0;

  constructor() {
    this.group.add(this.marks.group, this.glare.group, this.bulbs.group);
  }

  begin(dt: number) {
    this.dt = dt;
    this.marks.begin();
    this.glare.begin();
    this.bulbs.begin();
    for (const t of this.tracks.values()) {
      t.seen = false;
      t.flare = Math.max(0, t.flare - dt / 0.3);
    }
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < POP_LIFE);
  }

  /**
   * One live grenade this frame: `center` of the ball, `bulb` on its cap, `left` seconds of fuse, `moving` or not;
   * `inSight` when nothing solid stands between the eye and the bulb, so its glow is not cut off by the floor around it.
   */
  grenade(id: number, center: THREE.Vector3, bulb: THREE.Vector3, left: number, moving: boolean, inSight: boolean) {
    const t = this.track(id);
    t.seen = true;
    t.still = moving ? 0 : t.still + this.dt;
    for (let i = 0; i < t.ages.length; i++) t.ages[i]! += this.dt;
    if (moving) {
      t.points.unshift(center.clone());
      t.ages.unshift(0);
    }
    while (t.ages.length && t.ages[t.ages.length - 1]! > TRAIL_TIME) {
      t.ages.pop();
      t.points.pop();
    }
    if (t.points.length > 1) this.marks.trail(t.points, 0.1, 3.5, TRAIL, 0.95);
    const { on, urgency } = fuseBlink(left);
    const swell = 1 + 0.35 * urgency;
    if (t.still > SETTLED) {
      const at = this.v.set(center.x, center.y - 0.09, center.z);
      this.marks.add(at, { shape: 'glow', size: 1.3 * swell, minPx: 0, maxPx: 400, color: HALO, alpha: 0.12 + 0.3 * on, cover: 0.25, normal: UP });
      this.marks.add(at, { shape: 'ring', size: (0.8 + 0.2 * on) * swell, minPx: 0, maxPx: 400, color: HALO, alpha: 0.4 + 0.5 * on, cover: 0.6, width: 0.2, normal: UP });
    }
    const lit = Math.max(on, t.flare);
    // A wide soft bloom that adds light, a tighter halo that covers (red still reads on pale stone), then the bulb.
    const glow = inSight ? this.glare : this.marks;
    glow.add(bulb, { shape: 'glow', size: (0.8 + 0.6 * t.flare) * swell, minPx: (30 + 24 * t.flare) * swell, maxPx: 96, color: HALO, alpha: 0.2 + 0.6 * lit, cover: 0.15 });
    glow.add(bulb, { shape: 'glow', size: 0.3 * swell, minPx: (13 + 3 * lit) * swell, maxPx: 30, color: HALO, alpha: 0.7 + 0.3 * lit, cover: 0.8 });
    this.bulbs.add(bulb, { shape: 'bulb', size: 0.06, minPx: 6 + 1.5 * lit, maxPx: 16, color: lit > 0.2 ? BULB_ON : BULB_OFF, alpha: 1, cover: 1, width: lit });
  }

  /** A bounce off a surface with this normal: a ring on the surface, a flash and a puff of dust; `strength` 1 for the first landing. */
  land(id: number, at: THREE.Vector3, normal: THREE.Vector3, strength: number) {
    this.track(id).flare = strength;
    const side = new THREE.Vector3(1, 0, 0).cross(normal);
    if (side.lengthSq() < 0.01) side.set(0, 0, 1).cross(normal);
    side.normalize();
    const turn = Math.random() * Math.PI * 2;
    const puffs = Array.from({ length: 5 }, (_, i) => side.clone().applyAxisAngle(normal, turn + (i / 5) * Math.PI * 2 + Math.random() * 0.5));
    this.pops.push({ at: at.clone(), normal: normal.clone(), puffs, age: 0, strength });
  }

  end() {
    for (const p of this.pops) {
      const k = p.strength;
      const ring = p.age / POP_LIFE;
      this.marks.add(p.at, { shape: 'ring', size: (0.3 + 1.5 * smooth(ring, 0, 1) ** 0.6) * k, minPx: 0, maxPx: 600, color: POP, alpha: 0.95 * (1 - ring) ** 1.5, cover: 0.55, width: 0.28 - 0.16 * ring, normal: p.normal });
      const flash = p.age / 0.15;
      if (flash < 1 && k >= 1) this.marks.add(this.v.copy(p.at).addScaledVector(p.normal, 0.2), { shape: 'star', size: 0.6 * k, minPx: 18 * k, maxPx: 80, color: FLASH, alpha: 1 - flash * flash, cover: 0.25 });
      const out = 1 - (1 - ring) ** 2;
      for (const dir of p.puffs) {
        const at = this.v.copy(p.at).addScaledVector(dir, 0.55 * out * k).addScaledVector(p.normal, 0.08 + 0.22 * ring);
        this.marks.add(at, { shape: 'glow', size: (0.14 + 0.2 * out) * k, minPx: 4 + 3 * out, maxPx: 60, color: DUST, alpha: 0.85 * (1 - ring) ** 1.5, cover: 0.75 });
      }
    }
    for (const [id, t] of this.tracks) if (!t.seen) this.tracks.delete(id);
    this.marks.end();
    this.glare.end();
    this.bulbs.end();
  }

  dispose() {
    this.marks.dispose();
    this.glare.dispose();
    this.bulbs.dispose();
    this.tracks.clear();
    this.pops = [];
  }

  private track(id: number) {
    let t = this.tracks.get(id);
    if (!t) {
      t = { points: [], ages: [], still: 0, flare: 0, seen: true };
      this.tracks.set(id, t);
    }
    return t;
  }
}
