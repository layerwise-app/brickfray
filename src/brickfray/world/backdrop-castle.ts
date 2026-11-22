import type { Drawer } from './plan';
import { mountainRange } from './mountains';

/** Far ring round the fortress country: green hills, then high mountains; the near country is fortress-outside.ts. */
export function castleBackdrop(d: Drawer) {
  const haze = '#efd9bd';
  mountainRange(d, { count: 14, dist: [125, 160], radius: [26, 40], height: [9, 18], haze, seed: 3, rock: ['#6f9a4a'], slope: '#7fa65a', forest: '#3f7f3a', green: true });
  mountainRange(d, { count: 11, dist: [165, 190], radius: [30, 46], height: [34, 58], haze, seed: 17, rock: ['#5f6b7a', '#6c7480', '#565f6c'], slope: '#4f6a40' });
}
