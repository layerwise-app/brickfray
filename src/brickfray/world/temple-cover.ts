import type { Element, Plan } from './plan';
import type { At } from './props-kit';
import { box, type Piece } from './temple-layout';

/** Adds an element and its mirror copy across x = 0. */
export function both<P extends At>(p: Plan, el: Element<P>, at: P) {
  p.add(el, at);
  p.add(el, { ...at, x: -at.x, turns: -(at.turns ?? 0) });
}

const prop = (tag: string, x0: number, z0: number, x1: number, h: number, z1: number): Piece => box('prop', x0, 0, z0, x1, h, z1, { tag });

/**
 * Cover of the west half (the geometry mirrors it), in clusters: a standing piece with low ones against it, clean
 * ground between the clusters. Standing pieces are 2.4 m or more and never next to a step up, so none is climbed;
 * low ones are 1.0-1.28 m (crouch cover).
 */
export function templeCover(p: Piece[]) {
  // Gorge path (the rim spur at its mouth is in temple-lanes). G2 past the spur: the old bell frame on the rim side and
  // a broken wall, the walking line along the inner half left clear.
  p.push(prop('bell', -38.4, -40.8, -35.2, 3.2, -38.4), box('ruin', -35.2, 0, -39.2, -32.8, 1.2, -38.4));
  // G3 under the bell pavilion, on the rim side: a rockfall out to the bridge's north way (it closes the line through
  // that way) and a fallen column, the counter to the pavilion.
  p.push(prop('boulder', -24.0, -44.8, -20.8, 2.8, -40.0), box('ruin', -27.2, 0, -40.0, -24.0, 1.0, -39.2));
  // G4 before the bridge, on the court side: a boulder that closes the line through the bridge's south way.
  p.push(prop('boulder', -16.0, -36.8, -13.6, 2.8, -33.6));
  // Camp north yard: the incense cauldron before the gorge path's mouth.
  p.push(prop('cauldron', -60.8, -33.6, -58.4, 1.28, -31.2));
  // Forecourt: an offering table before each passage mouth.
  p.push(prop('table', -46.4, 3.6, -44.8, 1.0, 4.4), prop('table', -42.4, -4.4, -40.8, 1.0, -3.6));
  // Lotus court: the open incense pavilion at its middle (four posts, a roof over head height, a low altar between
  // them); a stele with a planter in the north half, a bell frame with an offering table in the south half, a lotus
  // basin by the gate.
  for (const [x, z] of [[-26.8, -2.8], [-21.8, -2.8], [-26.8, 2.2], [-21.8, 2.2]] as const) p.push(box('pillar', x, 0, z, x + 0.6, 3.6, z + 0.6, { tag: 'pavilion' }));
  p.push(box('roof', -27.2, 3.6, -3.2, -20.8, 4.08, 3.2, { tag: 'shrine' }), prop('altar', -25.2, -1.2, -22.8, 1.2, 1.2));
  p.push(box('stele', -20.0, 0, -10.4, -18.4, 3.2, -8.0), prop('planter', -21.6, -9.6, -20.0, 1.2, -8.8));
  p.push(prop('bell', -30.4, 8.0, -27.2, 3.2, 9.6), prop('table', -27.2, 8.4, -25.6, 1.0, 9.2));
  p.push(prop('planter', -31.2, -9.6, -28.8, 0.9, -8.0));
  // Raised flower beds along the court's north and south sides (too high to step onto): the court's walls stand back
  // behind them, so the court reads wider at eye height than it walks.
  for (const s of [-1, 1]) p.push(prop('bed', -35.2, s * 14.4, -16.0, 1.36, s * 17.6));
  // Nave: prayer tables before the altar's ends.
  p.push(prop('table', -3.6, -10.0, -1.2, 1.0, -9.2), prop('table', -3.6, 9.2, -1.2, 1.0, 10.0));
  // Village street (the river house at its mouth stands out into it). V1 in the camp's south yard: a handcart and
  // firewood, cover between the yard and the street's mouth.
  p.push(prop('cart', -60.0, 33.6, -57.6, 1.8, 34.8), prop('firewood', -57.6, 33.8, -56.0, 1.2, 34.6));
  // V2 the village well in the street's middle under the balcony.
  p.push(prop('well', -26.4, 32.8, -24.0, 2.8, 35.2));
  // V3 the market stall under the balcony and baskets beside it.
  p.push(prop('stall', -22.4, 37.6, -19.2, 2.4, 39.6), prop('firewood', -19.2, 38.4, -17.6, 1.0, 39.2));
  // V4 the ghat before the pagoda's porch: a boat on trestles.
  p.push(prop('boat', -10.4, 37.6, -7.2, 1.0, 38.4));
}
