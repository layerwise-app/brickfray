import type { LabContext } from '../types';
import { mapLab } from '../../world/lab-map';
import { DOCKS, DOCKS_VIEWS } from '../../world/map-docks';

export default function setup(ctx: LabContext) {
  return mapLab(ctx, DOCKS, DOCKS_VIEWS);
}
