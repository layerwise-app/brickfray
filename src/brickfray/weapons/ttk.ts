import { damageAt } from '../sim/hitboxes';
import { PLAYER } from '../sim/constants';
import { WEAPONS, type WeaponId } from './defs';

/** Half-width of a standing body, for how often an aimed shot lands at range. */
const BODY = 0.3;
/** Share of landed shots that are headshots for an average player. */
const HEADS = 0.2;
/** An average player's aim error in radians at 1× zoom, on top of the gun's own cone; magnification steadies it. */
const AIM = 0.003;
const MAX_SHOTS = 80;

/** When each shot can fire, from the first; reloads run alongside a bolt or pump cycle. */
function shotTimes(id: WeaponId, count: number): number[] {
  const def = WEAPONS[id];
  const times: number[] = [];
  let t = 0;
  let ammo = def.mag;
  for (let i = 0; i < count; i++) {
    times.push(t);
    ammo--;
    let next = t + (def.burst && (i + 1) % def.burst.count === 0 ? def.burst.pause : Math.max(60 / def.rpm, def.cycle ?? 0));
    if (ammo === 0) {
      next = Math.max(next, t + def.reloadEmpty);
      ammo = def.mag;
    }
    t = next;
  }
  return times;
}

/**
 * Expected seconds to kill a full-health player at `distance`, aiming down
 * sights (aim time included): each shot lands with the odds its cone gives,
 * a fifth of hits are headshots, pellets land as a ring or only the center one does.
 */
export function timeToKill(id: WeaponId, distance: number): number {
  const def = WEAPONS[id];
  const spread = def.adsSpread;
  const falloff = (full: number) => damageAt(distance, full, def.minDamage * (full / def.body), def.falloffStart, def.falloffEnd);
  const pellets = def.pellets > 1 ? (spread * distance <= BODY ? def.pellets : 1) : 1;
  // Follow-up shots ride the recoil when they come too fast to pull it back down.
  const kick = def.recoil.reduce((sum, [pitch, yaw]) => sum + Math.hypot(pitch, yaw), 0) / def.recoil.length;
  const interval = Math.max(60 / def.rpm, def.cycle ?? 0);
  const error = Math.hypot(spread, AIM / Math.sqrt(def.zoom), kick * 0.6 * Math.max(0, 1 - interval / 0.35));
  const hit = def.pellets > 1 ? 1 : Math.min(1, (BODY / (error * distance)) ** 2);
  const outcomes: [number, number][] = [
    [hit * (1 - HEADS), Math.round(falloff(def.body) * pellets)],
    [hit * HEADS, Math.round(falloff(def.head) * pellets)],
    [1 - hit, 0]
  ];
  const times = shotTimes(id, MAX_SHOTS);
  let alive = new Map<number, number>([[PLAYER.health, 1]]);
  let expected = 0;
  for (let shot = 0; shot < MAX_SHOTS && alive.size; shot++) {
    const next = new Map<number, number>();
    for (const [health, p] of alive) {
      for (const [chance, damage] of outcomes) {
        if (chance <= 0) continue;
        const left = health - damage;
        if (left <= 0) expected += p * chance * times[shot]!;
        else next.set(left, (next.get(left) ?? 0) + p * chance);
      }
    }
    alive = next;
  }
  let missing = 0;
  for (const p of alive.values()) missing += p;
  return def.adsTime + expected + missing * times[MAX_SHOTS - 1]!;
}
