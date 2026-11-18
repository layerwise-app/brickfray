import { stance as clack } from './designs/clack';
import { stance as coral } from './designs/coral';
import { stance as moss } from './designs/moss';
import { stance as nova } from './designs/nova';
import { stance as rivet } from './designs/rivet';
import { stance as vega } from './designs/vega';
import type { Stance } from './stance';
import type { CharacterId } from './types';

/** Each playable character's signature showroom pose. */
export const STANCES: Record<CharacterId, Stance> = { rivet, vega, clack, coral, moss, nova };
