import type { BotKind, CharacterId } from '../../characters/types';
import { scaledMag } from '../../sim/arms';
import { PLAYER } from '../../sim/constants';
import { UPGRADES, upgradeStats, type UpgradeId, type UpgradeLevels } from '../../sim/upgrades';
import { WEAPONS, type WeaponId } from '../../weapons/defs';
import { LOADOUTS } from '../../weapons/loadouts';
import type { MessageKey } from '../i18n';

/** One piece of a card's before → after line: a number pair, optionally after a weapon silhouette. */
export interface DetailPart {
  weapon?: WeaponId | 'grenade';
  from: number;
  to: number;
  unit?: 'seconds' | 'percent' | 'perSecond';
}

export interface CardText {
  effect: { key: MessageKey; vars: Record<string, number> };
  detail: DetailPart[];
}

/** What a card would change for this player, in exact numbers: the step it adds and the values before and after. */
export function cardText(id: UpgradeId, levels: UpgradeLevels, character: CharacterId | BotKind, armor: number): CardText {
  const step = UPGRADES[id].steps[levels[id]] ?? 0;
  const now = upgradeStats(levels);
  const next = upgradeStats({ ...levels, [id]: levels[id] + 1 });
  const loadout = LOADOUTS[character];
  const guns = loadout.primary === loadout.secondary ? [loadout.primary] : [loadout.primary, loadout.secondary];
  const pct = (v: number) => Math.round(v * 100);
  const key = `upgrade.fx.${id}` as MessageKey;
  switch (id) {
    case 'health':
      return { effect: { key, vars: { n: step } }, detail: [{ from: PLAYER.health + now.healthBonus, to: PLAYER.health + next.healthBonus }] };
    case 'magazine':
      return { effect: { key, vars: { n: pct(step) } }, detail: guns.map((w) => ({ weapon: w, from: scaledMag(w, now.magScale), to: scaledMag(w, next.magScale) })) };
    case 'reload':
      return {
        effect: { key, vars: { n: pct(step) } },
        detail: [{ weapon: loadout.primary, from: round2(WEAPONS[loadout.primary].reload * now.reloadScale), to: round2(WEAPONS[loadout.primary].reload * next.reloadScale), unit: 'seconds' }]
      };
    case 'grenades':
      return { effect: { key, vars: { n: step } }, detail: [{ weapon: 'grenade', from: now.grenadeMax, to: next.grenadeMax }] };
    case 'grenadeRefill':
      return { effect: { key, vars: { n: step } }, detail: [{ weapon: 'grenade', from: now.grenadeRefill, to: next.grenadeRefill, unit: 'seconds' }] };
    case 'speed':
      return { effect: { key, vars: { n: pct(step) } }, detail: [{ from: pct(now.pace), to: pct(next.pace), unit: 'percent' }] };
    case 'regen': {
      const scale = (PLAYER.health + now.healthBonus) / 100;
      return {
        effect: { key, vars: { s: round2(now.regenDelay - next.regenDelay), n: Math.round(step * scale) } },
        detail: [
          { from: now.regenDelay, to: next.regenDelay, unit: 'seconds' },
          { from: Math.round(now.regenRate * scale), to: Math.round(next.regenRate * scale), unit: 'perSecond' }
        ]
      };
    }
    case 'damage':
      return {
        effect: { key, vars: { n: pct(step) } },
        detail: [{ weapon: loadout.primary, from: Math.round(WEAPONS[loadout.primary].body * now.damageScale), to: Math.round(WEAPONS[loadout.primary].body * next.damageScale) }]
      };
    case 'armor':
      return { effect: { key, vars: { n: step } }, detail: [{ from: Math.ceil(armor), to: Math.ceil(armor) + step }] };
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;
