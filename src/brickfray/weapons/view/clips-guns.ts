import type { WeaponId } from '../defs';
import type { Clip } from './clip';
import { buzzerReload } from './clips-buzzer';
import { harpoonReload } from './clips-harpoon';
import { pistolReload } from './clips-pistol';
import { revolverReload } from './clips-revolver';
import { arReload } from './clips-rifles';
import { shotgunLoadIn, shotgunPump } from './clips-shotgun';
import { sniperCycle, sniperReload } from './clips-sniper';

export { shotgunLoadOut, shotgunShell } from './clips-shotgun';

/** Which reload and cycling animations each gun uses. */
const RELOAD: Record<WeaponId, 'rifle' | 'pistol' | 'buzzer' | 'pump' | 'bolt' | 'revolver' | 'harpoon'> = {
  ar: 'rifle',
  nailer: 'rifle',
  pulse: 'rifle',
  shotgun: 'pump',
  sniper: 'bolt',
  harpoon: 'harpoon',
  pistol: 'pistol',
  cannon: 'revolver',
  buzzer: 'buzzer'
};

/** Shell-by-shell loaders hold a loading pose between shells and finish with their own clip. */
export const loadsShells = (id: WeaponId) => RELOAD[id] === 'pump';

/** `slot` is the side-carrier shell a shell-by-shell load starts from (null: from the belt). */
export function reloadClip(id: WeaponId, empty: boolean, duration: number, slot: number | null = null): Clip {
  switch (RELOAD[id]) {
    case 'pump':
      return shotgunLoadIn(duration < 0.6 ? duration : 0.28, slot);
    case 'rifle':
      return arReload(id, empty, duration);
    case 'bolt':
      return sniperReload(empty, duration);
    case 'pistol':
      return pistolReload(empty, duration);
    case 'buzzer':
      return buzzerReload(empty, duration);
    case 'revolver':
      return revolverReload(empty, duration);
    case 'harpoon':
      return harpoonReload(empty, duration);
  }
}

/** The manual action worked after a shot, for guns that have one. */
export function cycleClip(id: WeaponId, duration: number): Clip | null {
  if (RELOAD[id] === 'pump') return shotgunPump(duration, true);
  if (RELOAD[id] === 'bolt') return sniperCycle(duration);
  return null;
}
