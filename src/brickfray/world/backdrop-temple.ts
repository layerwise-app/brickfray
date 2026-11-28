import { mountainRange } from './mountains';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { campCliffs, gorge, HAZE, outcrops, river, stupa } from './temple-scenery';
import { village } from './temple-village';
import { Frame } from './util';

/**
 * The jungle valley around the temple: the gorge and the ravine's waterfall (north), the river and the far bank's
 * village (south), the cliffs and the waterfall behind the west camp, terraces behind the east, far stupas and mountains.
 */
export function templeBackdrop(d: Drawer) {
  gorge(d);
  river(d);
  campCliffs(d);
  outcrops(d);
  village(d);
  const t = new Pen(d, new Frame(0, 0, 0));
  for (const [x, y, z, s] of [[-52, 12.4, -110, 1.3], [64, 12.4, -120, 1.0], [-120, 14, 30, 1.2]] as const) stupa(t, x, y, z, s);
  mountainRange(d, { count: 12, dist: [160, 200], radius: [26, 42], height: [16, 30], haze: HAZE, seed: 19, rock: ['#5f8a4a'], slope: '#6f9a4a', forest: '#2f6a3a', green: true });
}
