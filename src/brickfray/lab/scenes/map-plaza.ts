import type { LabContext } from '../types';
import { mapLab } from '../../world/lab-map';
import { PLAZA, PLAZA_VIEWS } from '../../world/map-plaza';

export default function setup(ctx: LabContext) {
  return mapLab(ctx, PLAZA, PLAZA_VIEWS);
}
