import type { LabContext } from '../types';
import { mapLab } from '../../world/lab-map';
import { TEMPLE, TEMPLE_VIEWS } from '../../world/map-temple';

export default function setup(ctx: LabContext) {
  return mapLab(ctx, TEMPLE, TEMPLE_VIEWS);
}
