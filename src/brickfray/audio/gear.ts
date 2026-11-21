import type { BotKind, CharacterId } from '../characters/types';
import type { GearId } from './types';

const GEAR: Partial<Record<CharacterId | BotKind, GearId>> = {
  clack: 'armour',
  nova: 'suit',
  coral: 'suit',
  rivet: 'rattle',
  moss: 'rattle',
  vega: 'rattle'
};

/** The step layer a character's outfit adds, or null (bots). */
export function gearOf(character: CharacterId | BotKind | undefined): GearId | null {
  return (character && GEAR[character]) ?? null;
}
