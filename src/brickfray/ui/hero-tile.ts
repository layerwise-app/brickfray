import { ROSTER } from '../characters/roster';
import type { CharacterId } from '../characters/types';

/** Tile colours where a hero's own pair would hide their portrait: Moss's green hood on a green tile. */
const TILE: Partial<Record<CharacterId, [string, string]>> = { moss: ['#e2b25c', '#7a5a3a'] };

/** The tile behind a hero's portrait: their colours, split on a slant. */
export function heroTile(id: CharacterId) {
  const [top, band] = TILE[id] ?? [ROSTER[id].primary, ROSTER[id].secondary];
  return `linear-gradient(160deg, ${top} 0 calc(66% - 0.7px), ${band} calc(66% + 0.7px) 100%)`;
}
