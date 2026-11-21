import type { WeaponId } from '../weapons/defs';
import type { FoleyId, HandlingCue, SoundId } from './types';

type Kit = Partial<Record<HandlingCue, FoleyId>>;

const RIFLE: Kit = { draw: 'rifleDraw', holster: 'rifleHolster' };
const SIDEARM: Kit = { draw: 'pistolDraw', holster: 'pistolHolster' };
const TOOL: Kit = { draw: 'toolDraw', holster: 'toolHolster' };

/**
 * Which recording each gun plays for a handling cue. Cues a gun has no entry for play the shared `cue:` sound:
 * the rifle magazine and charging handle, the pistol slide, the shotgun pump and shells, pins, throws and cloth.
 */
const KITS: Record<WeaponId, Kit> = {
  ar: RIFLE,
  pistol: { ...SIDEARM, magOut: 'pistolMagOut', magIn: 'pistolMagIn' },
  buzzer: { ...RIFLE, magOut: 'smgMagOut', magIn: 'smgMagIn', slideBack: 'smgBoltBack', slideForward: 'smgBoltForward' },
  shotgun: RIFLE,
  sniper: { ...RIFLE, boltBack: 'boltOpen', boltForward: 'boltClose', magOut: 'boltMagOut', magIn: 'boltMagIn' },
  cannon: { ...SIDEARM, boltBack: 'cylinderOpen', magOut: 'cylinderEject', magIn: 'cylinderLoad', boltForward: 'cylinderClose' },
  harpoon: { ...TOOL, magOut: 'spearFetch', shellIn: 'spearSeat', magIn: 'spearHome' },
  nailer: { ...TOOL, magOut: 'stripOut', magIn: 'stripIn', boltBack: 'driverBack', boltForward: 'driverHome' },
  pulse: { ...TOOL, magOut: 'cellOut', magIn: 'cellIn', boltBack: 'chargeUp', boltForward: 'chargeLock' }
};

/** The cue every family sound stands in for, so the synthesized fallback of a missing file stays plausible. */
export const FOLEY_STANDS_FOR: Record<FoleyId, HandlingCue> = {
  pistolMagOut: 'magOut',
  pistolMagIn: 'magIn',
  boltOpen: 'boltBack',
  boltClose: 'boltForward',
  boltMagOut: 'magOut',
  boltMagIn: 'magIn',
  cylinderOpen: 'boltBack',
  cylinderEject: 'magOut',
  cylinderLoad: 'magIn',
  cylinderClose: 'boltForward',
  spearFetch: 'magOut',
  spearSeat: 'shellIn',
  spearHome: 'magIn',
  stripOut: 'magOut',
  stripIn: 'magIn',
  cellOut: 'magOut',
  cellIn: 'magIn',
  smgMagOut: 'magOut',
  smgMagIn: 'magIn',
  smgBoltBack: 'slideBack',
  smgBoltForward: 'slideForward',
  driverBack: 'boltBack',
  driverHome: 'boltForward',
  chargeUp: 'boltBack',
  chargeLock: 'boltForward',
  rifleDraw: 'draw',
  rifleHolster: 'holster',
  pistolDraw: 'draw',
  pistolHolster: 'holster',
  toolDraw: 'draw',
  toolHolster: 'holster',
  gripOff: 'cloth',
  pouch: 'draw',
  magScrape: 'magOut',
  regrip: 'draw'
};

export function handlingSound(cue: HandlingCue, weapon: WeaponId | null): SoundId {
  const foley = weapon ? KITS[weapon][cue] : undefined;
  return foley ? `foley:${foley}` : `cue:${cue}`;
}
