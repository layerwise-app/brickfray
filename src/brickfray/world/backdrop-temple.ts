import { mountainRange } from './mountains';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { gorge, HAZE, northCliff, river, stupa } from './temple-scenery';
import { village } from './temple-village';
import { Frame } from './util';

/**
 * The jungle valley around the temple: the cliff and its waterfalls over the stream (north), the gorge (west), the
 * village and its terraced hill (east), the river and its far bank (south), far temple towers and green mountains.
 */
export function templeBackdrop(d: Drawer) {
  northCliff(d);
  gorge(d);
  river(d);
  village(d);
  const t = new Pen(d, new Frame(0, 0, 0));
  for (const [x, y, z, s] of [[-52, 18.8, -86, 1.3], [64, 18.8, -96, 1.0], [-104, 12.4, 24, 1.2]] as const) stupa(t, x, y, z, s);
  mountainRange(d, { count: 12, dist: [130, 170], radius: [26, 42], height: [16, 30], haze: HAZE, seed: 19, rock: ['#5f8a4a'], slope: '#6f9a4a', forest: '#2f6a3a', green: true });
}
