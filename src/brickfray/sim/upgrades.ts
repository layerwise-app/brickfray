import { GRENADE } from '../weapons/defs';
import { fillMagazines, hashRandom } from './arms';
import { GRENADE_REFILL, REGEN } from './constants';
import type { HostPlayer } from './types';

/** Network order: levels go over the wire in this order, so new upgrades are appended. */
export const UPGRADE_IDS = ['health', 'magazine', 'reload', 'grenades', 'grenadeRefill', 'speed', 'regen', 'damage', 'armor'] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];
export type UpgradeLevels = Record<UpgradeId, number>;

export interface UpgradeDef {
  /** What each level adds, in order; the count is the cap. */
  steps: readonly number[];
  /** Relative chance to be dealt: the strong ones come up less often. */
  weight: number;
  rare?: boolean;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  /** Max health points. */
  health: { steps: [40, 30, 25, 20, 15], weight: 1 },
  /** Share added to every gun's magazine. */
  magazine: { steps: [0.4, 0.3, 0.2], weight: 1 },
  /** Share cut from every reload. */
  reload: { steps: [0.2, 0.15, 0.1], weight: 1 },
  /** Grenade slots. */
  grenades: { steps: [1, 1, 1], weight: 0.8 },
  /** Seconds cut from getting a grenade back. */
  grenadeRefill: { steps: [4, 3, 2], weight: 0.8 },
  /** Share added to move speed. */
  speed: { steps: [0.1, 0.07, 0.05], weight: 0.8 },
  /** Health per second (per 100 max health) added to regeneration, which also starts sooner (REGEN_SOONER). */
  regen: { steps: [12, 8, 6], weight: 0.9 },
  /** Share added to all damage dealt. */
  damage: { steps: [0.2, 0.15, 0.1], weight: 0.55, rare: true },
  /** Armour points, with a full heal. */
  armor: { steps: [80, 60, 40], weight: 0.5, rare: true }
};

/** Seconds each regen level takes off the wait before healing starts. */
export const REGEN_SOONER = [1.5, 1, 0.5] as const;

export function noUpgrades(): UpgradeLevels {
  return { health: 0, magazine: 0, reload: 0, grenades: 0, grenadeRefill: 0, speed: 0, regen: 0, damage: 0, armor: 0 };
}

export function maxLevel(id: UpgradeId) {
  return UPGRADES[id].steps.length;
}

export function canTake(levels: UpgradeLevels, id: UpgradeId) {
  return levels[id] < maxLevel(id);
}

function sum(steps: readonly number[], level: number) {
  let total = 0;
  for (let i = 0; i < Math.min(level, steps.length); i++) total += steps[i]!;
  return total;
}

/** Every number the levels change, for the sim and for the cards' before and after. */
export function upgradeStats(levels: UpgradeLevels) {
  return {
    healthBonus: sum(UPGRADES.health.steps, levels.health),
    magScale: 1 + sum(UPGRADES.magazine.steps, levels.magazine),
    reloadScale: 1 - sum(UPGRADES.reload.steps, levels.reload),
    grenadeMax: GRENADE.perLife + sum(UPGRADES.grenades.steps, levels.grenades),
    grenadeRefill: GRENADE_REFILL - sum(UPGRADES.grenadeRefill.steps, levels.grenadeRefill),
    pace: 1 + sum(UPGRADES.speed.steps, levels.speed),
    regenDelay: REGEN.delay - sum(REGEN_SOONER, levels.regen),
    regenRate: REGEN.rate + sum(UPGRADES.regen.steps, levels.regen),
    damageScale: 1 + sum(UPGRADES.damage.steps, levels.damage)
  };
}
export type UpgradeStats = ReturnType<typeof upgradeStats>;

/** Up to `count` different upgrades not yet at their cap, weighted. The same seed and round deal the same cards. */
export function drawOffer(levels: UpgradeLevels, seed: number, round: number, count = 3): UpgradeId[] {
  const pool = UPGRADE_IDS.filter((id) => canTake(levels, id));
  const out: UpgradeId[] = [];
  for (let k = 0; k < count && pool.length; k++) {
    let r = hashRandom(seed, round, k) * pool.reduce((s, id) => s + UPGRADES[id].weight, 0);
    let i = 0;
    while (i < pool.length - 1 && r >= UPGRADES[pool[i]!].weight) r -= UPGRADES[pool[i++]!].weight;
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}

/** Put the levels' modifiers on the player's arms and movement (a spawn rebuilds both). */
export function applyLevels(p: HostPlayer) {
  const s = upgradeStats(p.upgrades);
  p.arms.magScale = s.magScale;
  p.arms.reloadScale = s.reloadScale;
  p.arms.grenadeMax = s.grenadeMax;
  p.arms.grenadeRefill = s.grenadeRefill;
  p.move.pace = s.pace;
}

/** One more level of `id`: its modifiers, plus what it hands over at once (health, rounds, a grenade, armour). */
export function takeUpgrade(p: HostPlayer, id: UpgradeId): boolean {
  if (!canTake(p.upgrades, id)) return false;
  const step = UPGRADES[id].steps[p.upgrades[id]]!;
  p.upgrades[id]++;
  applyLevels(p);
  switch (id) {
    case 'health':
      p.maxHealth += step;
      p.health = Math.min(p.maxHealth, p.health + step);
      break;
    case 'armor':
      p.armor += step;
      p.health = p.maxHealth;
      break;
    case 'magazine':
      fillMagazines(p.arms);
      break;
    case 'grenades':
      p.arms.grenades = Math.min(p.arms.grenadeMax, p.arms.grenades + step);
      break;
    case 'grenadeRefill':
      p.arms.grenadeTimer = Math.min(p.arms.grenadeTimer, p.arms.grenadeRefill);
      break;
  }
  return true;
}
