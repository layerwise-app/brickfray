import type { Materials } from './materials';
import type { QualityProfile } from './quality';

/** What every model builder needs: the quality tier and its material set. */
export interface Kit {
  profile: QualityProfile;
  materials: Materials;
}
