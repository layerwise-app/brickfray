import type { BotKind, CharacterId } from '../../characters/types';
import type { MeleeId, WeaponId } from '../../weapons/defs';
import type { MessageKey } from '../i18n';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const KINDS: ReadonlySet<string> = new Set<BotKind>(['grunt', 'rusher', 'sniper', 'boss']);

/** A snapbot goes by its kind in the player's language (the host names them in English); everyone else by their name. */
export function shownName(t: Translate, name: string, look: CharacterId | BotKind | null | undefined) {
  return look && KINDS.has(look) ? t(`kind.${look as BotKind}`) : name;
}

export function weaponName(t: Translate, id: WeaponId | MeleeId) {
  return t(`weapon.${id}`);
}
