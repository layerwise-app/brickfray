import { CHAIN_TOP } from '~/brickfray/sim/streaks';
import { waveRoster } from '~/brickfray/sim/waves';
import type { KillCause } from '~/brickfray/sim/types';
import { MELEE_IDS, type WeaponId } from '~/brickfray/weapons/defs';
import { LOADOUTS } from '~/brickfray/weapons/loadouts';
import { BoardError, type MatchReport } from '../board/contract';

// The counters a match report carries for achievements, beyond kills, assists and headshots. The browser counts them
// from the host's events; the server takes them only inside what the report's own numbers and the rules allow.

/** The local player's own kills of one match, sorted the ways achievements count them. */
export interface MatchFeats {
  /** Kills with the character's sidearm, its melee weapon, a grenade. */
  sidearm: number;
  melee: number;
  grenade: number;
  /** Kills with a long gun (LONG_GUNS) from LONG_SHOT metres or farther. */
  longshot: number;
  /** Gun and melee kills made off the ground. */
  airborne: number;
  /** Rooms: kills that collected the victim's bounty. */
  bounty: number;
  /** Solo: Megabots downed. */
  megabot: number;
  /**
   * Kill chains (sim/streaks.ts) that reached 2, 3, 4 and 5 kills, then the count of chains of six from when they had
   * their own callout: always 0 now, kept so the reports older builds queued (board/client/history.ts) still parse.
   */
  chains: [number, number, number, number, number];
}

export const LONG_GUNS: readonly WeaponId[] = ['sniper', 'harpoon'];
/** Metres from the killer's feet to the victim's. */
export const LONG_SHOT = 40;
const CHAIN_SLOTS = 5;

type Report = Pick<MatchReport, 'mode' | 'difficulty' | 'wave' | 'character' | 'kills'>;

export function noFeats(): MatchFeats {
  return { sidearm: 0, melee: 0, grenade: 0, longshot: 0, airborne: 0, bounty: 0, megabot: 0, chains: [0, 0, 0, 0, 0] };
}

/** Megabots a solo run has met once it is in `wave`. */
export function megabotsThrough(difficulty: NonNullable<Report['difficulty']>, wave: number) {
  let total = 0;
  for (let i = 1; i <= wave; i++) total += waveRoster(difficulty, i).filter((k) => k === 'boss').length;
  return total;
}

function carriesLongGun(character: string) {
  const kit = LOADOUTS[character as keyof typeof LOADOUTS];
  return !!kit && (LONG_GUNS.includes(kit.primary) || LONG_GUNS.includes(kit.secondary));
}

/** Chains as counted: one that reached N kills also reached every count below, and each holds N kills. */
function chainKills(c: readonly number[]) {
  return 2 * c[0]! + c[1]! + c[2]! + c[3]! + c[4]!;
}

function fail(why: string): never {
  throw new BoardError('invalid', `feats: ${why}`);
}

function count(value: unknown, field: string, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) fail(`${field} out of range`);
  return value;
}

/**
 * The report's feats, checked and rebuilt from known fields; null when the client sent none (an older build).
 * Every kill has one weapon, so the weapon kinds share the report's kills; a long shot needs a long gun in the kit;
 * bounties exist only in rooms and Megabots only in the waves a run reached.
 */
export function parseFeats(raw: unknown, r: Report): MatchFeats | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('not an object');
  const f = raw as Record<string, unknown>;
  const k = r.kills;
  const solo = r.mode === 'solo';
  const feats: MatchFeats = {
    sidearm: count(f.sidearm, 'sidearm', k),
    melee: count(f.melee, 'melee', k),
    grenade: count(f.grenade, 'grenade', k),
    longshot: count(f.longshot, 'longshot', carriesLongGun(r.character) ? k : 0),
    airborne: count(f.airborne, 'airborne', k),
    bounty: count(f.bounty, 'bounty', solo ? 0 : k),
    megabot: count(f.megabot, 'megabot', solo && r.difficulty ? Math.min(k, megabotsThrough(r.difficulty, r.wave)) : 0),
    chains: [0, 0, 0, 0, 0]
  };
  if (feats.sidearm + feats.melee + feats.grenade > k) fail('weapon kinds over kills');
  if (feats.longshot + feats.melee + feats.grenade > k) fail('long shots over gun kills');
  if (feats.airborne + feats.grenade > k) fail('airborne over gun kills');
  if (!Array.isArray(f.chains) || f.chains.length !== CHAIN_SLOTS) fail('chains');
  feats.chains = f.chains.map((n: unknown, i) => count(n, `chain${i + 2}`, k)) as MatchFeats['chains'];
  for (let i = 1; i < feats.chains.length; i++) if (feats.chains[i]! > feats.chains[i - 1]!) fail('longer chains than shorter ones');
  if (chainKills(feats.chains) > k) fail('chains over kills');
  feats.chains.fill(0, CHAIN_TOP - 1);
  return feats;
}

/** The browser's counts, trimmed to what parseFeats takes: a kill the scoreboard had not shown yet cannot sink the report. */
export function fitFeats(feats: MatchFeats, r: Report): MatchFeats {
  const k = r.kills;
  const solo = r.mode === 'solo';
  const grenade = Math.min(feats.grenade, k);
  const melee = Math.min(feats.melee, k - grenade);
  const chains = [...feats.chains] as MatchFeats['chains'];
  for (let i = 0; i < chains.length; i++) chains[i] = Math.min(chains[i]!, i ? chains[i - 1]! : k);
  for (let i = chains.length - 1; chainKills(chains) > k; ) {
    if (chains[i]) chains[i]!--;
    else i--;
  }
  return {
    sidearm: Math.min(feats.sidearm, k - grenade - melee),
    melee,
    grenade,
    longshot: carriesLongGun(r.character) ? Math.min(feats.longshot, k - grenade - melee) : 0,
    airborne: Math.min(feats.airborne, k - grenade),
    bounty: solo ? 0 : Math.min(feats.bounty, k),
    megabot: solo && r.difficulty ? Math.min(feats.megabot, k, megabotsThrough(r.difficulty, r.wave)) : 0,
    chains
  };
}

/** One kill by the local player, as the browser saw it. */
export interface SeenKill {
  weapon: KillCause;
  /** The killer's sidearm. */
  sidearm: WeaponId;
  /** The killer was off the ground when the kill arrived. */
  airborne: boolean;
  /** Metres to the victim; null when it is not on screen. */
  distance: number | null;
  bounty: number;
  megabot: boolean;
}

export function countKill(f: MatchFeats, kill: SeenKill): MatchFeats {
  const grenade = kill.weapon === 'grenade';
  const long = LONG_GUNS.includes(kill.weapon as WeaponId) && kill.distance !== null && kill.distance >= LONG_SHOT;
  return {
    ...f,
    sidearm: f.sidearm + (kill.weapon === kill.sidearm ? 1 : 0),
    melee: f.melee + ((MELEE_IDS as readonly string[]).includes(kill.weapon) ? 1 : 0),
    grenade: f.grenade + (grenade ? 1 : 0),
    longshot: f.longshot + (long ? 1 : 0),
    airborne: f.airborne + (kill.airborne && !grenade ? 1 : 0),
    bounty: f.bounty + (kill.bounty > 0 ? 1 : 0),
    megabot: f.megabot + (kill.megabot ? 1 : 0)
  };
}

/** A multikill event of the local player: chains longer than the top callout (CHAIN_TOP) were already counted at it. */
export function countChain(f: MatchFeats, chain: number): MatchFeats {
  if (chain < 2 || chain > CHAIN_TOP) return f;
  const chains = [...f.chains] as MatchFeats['chains'];
  chains[chain - 2]!++;
  return { ...f, chains };
}
