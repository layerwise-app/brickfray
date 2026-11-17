import type { LabContext } from '../types';
import { mapLab } from '../../world/lab-map';
import { SHOWROOM } from '../../world/showroom';

/** Every map prop on one baseplate, rows: nature, street, vehicles, harbor, castle. */
export default function setup(ctx: LabContext) {
  return mapLab(ctx, SHOWROOM, [
    { name: 'overview', cam: [0, 26, 40], target: [0, 0, 4], fov: 50 },
    { name: 'nature', cam: [0, 4, -2], target: [0, 2.5, -12], fov: 70 },
    { name: 'street', cam: [-6, 2.5, 3], target: [-6, 1, -4], fov: 65 },
    { name: 'street2', cam: [10, 2.5, 3], target: [10, 1, -4], fov: 65 },
    { name: 'vehicles', cam: [-8, 3.5, 12], target: [-8, 1, 4], fov: 60 },
    { name: 'plaza', cam: [10, 4, 13], target: [10, 1, 4], fov: 60 },
    { name: 'harbor', cam: [-6, 3.5, 20], target: [-6, 1, 13], fov: 60 },
    { name: 'harbor2', cam: [12, 3, 19], target: [12, 0.5, 13], fov: 60 },
    { name: 'castle', cam: [0, 3.5, 28], target: [0, 1.5, 21], fov: 65 }
  ]);
}
