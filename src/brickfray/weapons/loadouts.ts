import type { BotKind, CharacterId } from '../characters/types';
import type { MeleeId, WeaponId } from './defs';

export interface Loadout {
  primary: WeaponId;
  secondary: WeaponId;
  melee: MeleeId;
}

/** Picking a character picks their kit: each pairs a primary with a sidearm that covers its weak range. */
export const LOADOUTS: Record<CharacterId | BotKind, Loadout> = {
  rivet: { primary: 'nailer', secondary: 'pistol', melee: 'mallet' },
  vega: { primary: 'ar', secondary: 'pistol', melee: 'knife' },
  clack: { primary: 'shotgun', secondary: 'cannon', melee: 'sword' },
  coral: { primary: 'harpoon', secondary: 'buzzer', melee: 'anchor' },
  moss: { primary: 'sniper', secondary: 'buzzer', melee: 'hatchet' },
  nova: { primary: 'pulse', secondary: 'pistol', melee: 'wrench' },
  grunt: { primary: 'ar', secondary: 'pistol', melee: 'mallet' },
  rusher: { primary: 'pistol', secondary: 'buzzer', melee: 'knife' },
  sniper: { primary: 'sniper', secondary: 'pistol', melee: 'mallet' },
  boss: { primary: 'shotgun', secondary: 'cannon', melee: 'mallet' }
};

/** Slot 0 is the primary, slot 1 the sidearm. */
export function slotWeapon(loadout: Loadout, slot: number): WeaponId {
  return slot === 1 ? loadout.secondary : loadout.primary;
}

export function slotOf(loadout: Loadout, weapon: WeaponId): number {
  return weapon === loadout.secondary && weapon !== loadout.primary ? 1 : 0;
}
