import type { LabContext } from '../types';
import { mapLab } from '../../world/lab-map';
import { FORTRESS, FORTRESS_VIEWS } from '../../world/map-fortress';

export default function setup(ctx: LabContext) {
  return mapLab(ctx, FORTRESS, FORTRESS_VIEWS);
}
