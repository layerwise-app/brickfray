import type { SampleMap } from './samples';

/** Footsteps, movement, impacts, explosions, debris and other world sounds. Sources: public/audio/CREDITS-world.md. */
export const WORLD_SAMPLES: SampleMap = {
  'step:plastic': ['world/step-plastic-1.mp3', 'world/step-plastic-2.mp3', 'world/step-plastic-3.mp3', 'world/step-plastic-4.mp3', 'world/step-plastic-5.mp3'],
  'step:metal': ['world/step-metal-1.mp3', 'world/step-metal-2.mp3', 'world/step-metal-3.mp3', 'world/step-metal-4.mp3'],
  'step:wood': ['world/step-wood-1.mp3', 'world/step-wood-2.mp3', 'world/step-wood-3.mp3', 'world/step-wood-4.mp3', 'world/step-wood-5.mp3'],
  'step:glass': ['world/step-glass-1.mp3', 'world/step-glass-2.mp3', 'world/step-glass-3.mp3', 'world/step-glass-4.mp3'],
  'step:foliage': ['world/step-foliage-1.mp3', 'world/step-foliage-2.mp3', 'world/step-foliage-3.mp3', 'world/step-foliage-4.mp3'],
  'step:water': ['world/step-water-1.mp3', 'world/step-water-2.mp3', 'world/step-water-3.mp3', 'world/step-water-4.mp3'],
  'step:stone': ['world/step-stone-1.mp3', 'world/step-stone-2.mp3', 'world/step-stone-3.mp3', 'world/step-stone-4.mp3', 'world/step-stone-5.mp3'],
  land: ['world/land-1.mp3', 'world/land-2.mp3'],
  jump: ['world/jump-1.mp3', 'world/jump-2.mp3'],
  slide: ['world/slide-1.mp3', 'world/slide-2.mp3'],
  'impact:plastic': ['world/impact-plastic-1.mp3', 'world/impact-plastic-2.mp3', 'world/impact-plastic-3.mp3', 'world/impact-plastic-4.mp3'],
  'impact:metal': ['world/impact-metal-1.mp3', 'world/impact-metal-2.mp3', 'world/impact-metal-3.mp3', 'world/impact-metal-4.mp3'],
  'impact:wood': ['world/impact-wood-1.mp3', 'world/impact-wood-2.mp3'],
  'impact:glass': ['world/impact-glass-1.mp3', 'world/impact-glass-2.mp3'],
  'impact:foliage': ['world/impact-foliage-1.mp3', 'world/impact-foliage-2.mp3'],
  'impact:water': ['world/impact-water-1.mp3', 'world/impact-water-2.mp3'],
  'impact:stone': ['world/impact-stone-1.mp3', 'world/impact-stone-2.mp3', 'world/impact-stone-3.mp3', 'world/impact-stone-4.mp3'],
  impactBody: ['world/impact-body-1.mp3', 'world/impact-body-2.mp3', 'world/impact-body-3.mp3'],
  impactHead: ['world/impact-head-1.mp3', 'world/impact-head-2.mp3'],
  hurt: ['world/hurt-1.mp3', 'world/hurt-2.mp3', 'world/hurt-3.mp3'],
  shatter: ['world/shatter-1.mp3', 'world/shatter-2.mp3', 'world/shatter-3.mp3'],
  brickClatter: ['world/brick-clatter-1.mp3', 'world/brick-clatter-2.mp3', 'world/brick-clatter-3.mp3', 'world/brick-clatter-4.mp3'],
  grenadeBounce: ['world/grenade-bounce-1.mp3', 'world/grenade-bounce-2.mp3'],
  explosion: ['world/explosion-1.mp3', 'world/explosion-2.mp3']
};
