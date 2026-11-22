import type { Surface } from '../../world/types';
import type { SoundSpec } from '../catalog';
import { FOLEY_STANDS_FOR } from '../foley';
import type { FoleyId, GearId, HandlingCue } from '../types';
import { clack, grains, noise, rand, strike, thump, vary, type Synth } from '../synth';
import { metal, rustle, scrape, slide, splash, whoosh } from './parts';

type Hit = (s: Synth, at: number, weight: number, heel: boolean) => void;

/** Handling loudness: a part slamming home sits 5 dB over a release or a pull and 8 dB over cloth. */
const SLAM = -19.5;
const SEAT = -22;
const RELEASE = -24.5;

const cue = (duration: number, loudness: number, render: (s: Synth) => void): SoundSpec => ({ category: 'mech', duration, loudness, render });

const CUES: Record<HandlingCue, SoundSpec> = {
  magOut: cue(0.3, RELEASE, (s) => {
    clack(s, 0, { pitch: 2900, gain: 0.35, decay: 0.03 });
    slide(s, 0.02, { from: 1500, to: 2600, dur: 0.09, gain: 0.25 });
    clack(s, 0.115, { pitch: 1900, gain: 0.32, decay: 0.05 });
  }),
  magIn: cue(0.3, SLAM, (s) => {
    slide(s, 0, { from: 2200, to: 1300, dur: 0.07, gain: 0.25 });
    clack(s, 0.075, { pitch: 2100, gain: 0.7, decay: 0.05 });
    clack(s, 0.089, { pitch: 3300, gain: 0.45, decay: 0.035 });
    thump(s, 0.075, { from: 260, to: 160, glide: 0.03, decay: 0.06, gain: 0.25 });
  }),
  boltBack: cue(0.4, RELEASE, (s) => {
    scrape(s, 0, { freq: 3800, dur: 0.07, gain: 0.25 });
    metal(s, 0.07, { base: 2100, gain: 0.25, decay: 0.18 });
    clack(s, 0.07, { pitch: 2600, gain: 0.3, decay: 0.03 });
  }),
  boltForward: cue(0.4, SLAM, (s) => {
    scrape(s, 0, { freq: 3200, dur: 0.05, gain: 0.25 });
    metal(s, 0.05, { base: 1500, gain: 0.35, decay: 0.2 });
    clack(s, 0.05, { pitch: 2000, gain: 0.4, decay: 0.04 });
    thump(s, 0.05, { from: 240, to: 150, glide: 0.03, decay: 0.07, gain: 0.3 });
  }),
  pumpBack: cue(0.35, RELEASE, (s) => {
    slide(s, 0, { from: 900, to: 1900, dur: 0.1, gain: 0.3 });
    clack(s, 0.1, { pitch: 1600, gain: 0.65, decay: 0.06 });
    thump(s, 0.1, { from: 200, to: 130, glide: 0.03, decay: 0.07, gain: 0.25 });
  }),
  pumpForward: cue(0.35, SLAM, (s) => {
    slide(s, 0, { from: 1900, to: 1000, dur: 0.08, gain: 0.3 });
    clack(s, 0.08, { pitch: 1850, gain: 0.75, decay: 0.06 });
    clack(s, 0.093, { pitch: 2900, gain: 0.3, decay: 0.03 });
    thump(s, 0.08, { from: 230, to: 140, glide: 0.03, decay: 0.08, gain: 0.32 });
  }),
  shellIn: cue(0.25, SEAT, (s) => {
    slide(s, 0, { from: 2500, to: 1800, dur: 0.04, gain: 0.2 });
    clack(s, 0.04, { pitch: 1300, gain: 0.45, decay: 0.05 });
    clack(s, 0.051, { pitch: 3000, gain: 0.2, decay: 0.03 });
  }),
  slideBack: cue(0.25, RELEASE, (s) => {
    scrape(s, 0, { freq: 3000, dur: 0.05, gain: 0.2 });
    clack(s, 0.05, { pitch: 3300, gain: 0.45, decay: 0.035 });
  }),
  slideForward: cue(0.25, SLAM, (s) => {
    clack(s, 0, { pitch: 2600, gain: 0.7, decay: 0.04 });
    metal(s, 0.002, { base: 4200, gain: 0.12, decay: 0.08 });
  }),
  pinPull: cue(0.6, RELEASE, (s) => {
    scrape(s, 0, { freq: 5000, dur: 0.04, gain: 0.12 });
    clack(s, 0.035, { pitch: 3400, gain: 0.3, decay: 0.02 });
    metal(s, 0.04, { base: 3100, gain: 0.3, decay: 0.45 });
  }),
  throw: cue(0.45, SEAT, (s) => whoosh(s, 0, { from: 350, peak: 1500, to: 500, dur: 0.28, gain: 0.6 })),
  draw: cue(0.3, RELEASE, (s) => {
    rustle(s, 0, { dur: 0.14, gain: 0.25 });
    clack(s, 0.12, { pitch: 2400, gain: 0.45, decay: 0.04 });
    metal(s, 0.125, { base: 3600, gain: 0.06, decay: 0.08 });
  }),
  holster: cue(0.3, RELEASE, (s) => {
    rustle(s, 0, { dur: 0.12, gain: 0.25 });
    clack(s, 0.1, { pitch: 1700, gain: 0.35, decay: 0.045 });
  }),
  cloth: cue(0.4, -27.5, (s) => rustle(s, 0, { dur: 0.25, gain: 0.35 }))
};

/** One foot contact (heel then toe) per surface. */
const FOOT: Record<Surface, Hit> = {
  plastic: (s, at, w, heel) => {
    clack(s, at, { pitch: heel ? 1050 : 1750, gain: 0.55 * w, decay: 0.045, bright: 0.6 });
    thump(s, at, { from: 150, to: 90, glide: 0.03, decay: 0.06, gain: 0.35 * w });
  },
  metal: (s, at, w, heel) => {
    metal(s, at, { base: heel ? 380 : 520, gain: 0.32 * w, decay: 0.32 });
    thump(s, at, { from: 130, to: 80, glide: 0.03, decay: 0.07, gain: 0.35 * w });
    clack(s, at, { pitch: 1200, gain: 0.15 * w, decay: 0.03 });
  },
  wood: (s, at, w, heel) => {
    const f = (heel ? 180 : 240) * vary(s, 0.05);
    strike(s, at, [
      { f, decay: 0.09, gain: 0.45 * w },
      { f: f * 2.4, decay: 0.06, gain: 0.25 * w },
      { f: f * 4.1, decay: 0.035, gain: 0.12 * w }
    ]);
    noise(s, at, { attack: 0.0005, decay: 0.03, gain: 0.35 * w, filter: { type: 'bandpass', freq: 900, q: 1 } });
  },
  glass: (s, at, w, heel) => {
    thump(s, at, { from: 160, to: 100, glide: 0.02, decay: 0.05, gain: 0.25 * w });
    metal(s, at, { base: heel ? 2300 : 2900, gain: 0.14 * w, decay: 0.12 });
    noise(s, at, { attack: 0.0003, decay: 0.012, gain: 0.25 * w, filter: { type: 'highpass', freq: 3000, q: 0 } });
  },
  foliage: (s, at, w) => {
    grains(s, at, { count: 12, spread: 0.08, gain: 0.35 * w, freq: 2600, q: 0.8, decay: 0.02 });
    noise(s, at, { attack: 0.005, decay: 0.12, gain: 0.25 * w, filter: { type: 'bandpass', freq: 1800, q: 0.6 } });
    thump(s, at, { from: 110, to: 70, glide: 0.03, decay: 0.06, gain: 0.25 * w });
    if (s.rng() < 0.35) clack(s, at + 0.02, { pitch: 2600, gain: 0.12 * w, decay: 0.012 });
  },
  water: (s, at, w) => {
    splash(s, at, { gain: 0.6 * w, size: 0.8 });
    thump(s, at, { from: 100, to: 60, glide: 0.04, decay: 0.08, gain: 0.25 * w });
  },
  stone: (s, at, w) => {
    noise(s, at, { attack: 0.0005, decay: 0.035, gain: 0.4 * w, filter: { type: 'bandpass', freq: 1800, q: 1 } });
    grains(s, at, { count: 7, spread: 0.05, gain: 0.25 * w, freq: 3200, q: 1.2, decay: 0.008 });
    thump(s, at, { from: 115, to: 70, glide: 0.03, decay: 0.06, gain: 0.4 * w });
  }
};

function footstep(surface: Surface): SoundSpec {
  return {
    category: 'step',
    duration: surface === 'metal' ? 0.45 : 0.3,
    render: (s) => {
      const hit = FOOT[surface];
      hit(s, 0, 1, true);
      hit(s, rand(s, 0.028, 0.05), 0.55, false);
      noise(s, 0, { attack: 0.01, decay: 0.05, gain: 0.08, filter: { type: 'bandpass', freq: 3000, q: 0.8 } });
    }
  };
}

const STEP_SOUNDS = Object.fromEntries(
  (Object.keys(FOOT) as Surface[]).map((surface) => [`step:${surface}`, footstep(surface)])
) as Record<`step:${Surface}`, SoundSpec>;

const CUE_SOUNDS = Object.fromEntries(
  (Object.keys(CUES) as HandlingCue[]).map((id) => [`cue:${id}`, CUES[id]])
) as Record<`cue:${HandlingCue}`, SoundSpec>;

const FAMILY_SOUNDS = Object.fromEntries(
  (Object.keys(FOLEY_STANDS_FOR) as FoleyId[]).map((id) => [`foley:${id}`, CUES[FOLEY_STANDS_FOR[id]]])
) as Record<`foley:${FoleyId}`, SoundSpec>;

const gear = (render: (s: Synth) => void): SoundSpec => ({ category: 'step', duration: 0.25, loudness: -29, render });

const GEAR_SOUNDS: Record<`gear:${GearId}`, SoundSpec> = {
  'gear:armour': gear((s) => {
    metal(s, 0, { base: 1150 * vary(s, 0.06), gain: 0.4, decay: 0.07 });
    clack(s, rand(s, 0.015, 0.03), { pitch: 2400, gain: 0.25, decay: 0.03 });
  }),
  'gear:suit': gear((s) => rustle(s, 0, { dur: 0.14, gain: 0.35 })),
  'gear:rattle': gear((s) => grains(s, 0, { count: 6, spread: 0.06, gain: 0.3, freq: 3600, q: 2, decay: 0.012 }))
};

const MOVE_SOUNDS: Record<'jump' | 'land' | 'slide' | 'slideLoop', SoundSpec> = {
  jump: {
    category: 'move',
    duration: 0.35,
    render: (s) => {
      FOOT.plastic(s, 0, 0.6, false);
      rustle(s, 0, { dur: 0.12, gain: 0.3 });
      whoosh(s, 0.01, { from: 300, peak: 800, to: 500, dur: 0.16, gain: 0.25 });
    }
  },
  land: {
    category: 'move',
    duration: 0.45,
    render: (s) => {
      thump(s, 0, { from: 110, to: 55, glide: 0.06, decay: 0.18, gain: 0.85 });
      clack(s, 0, { pitch: 900 * vary(s, 0.05), gain: 0.45, decay: 0.06, bright: 0.5 });
      clack(s, rand(s, 0.02, 0.035), { pitch: 1500, gain: 0.25, decay: 0.04 });
      rustle(s, 0, { dur: 0.1, gain: 0.25 });
    }
  },
  slide: {
    category: 'move',
    duration: 0.8,
    render: (s) => {
      noise(s, 0, {
        attack: 0.03,
        hold: 0.3,
        decay: 0.3,
        gain: 0.45,
        filter: { type: 'bandpass', freq: 1500 * vary(s, 0.08), q: 0.9, sweep: [[0.6, 800]] }
      });
      grains(s, 0, { count: 30, spread: 0.5, gain: 0.18, freq: 2800, q: 1.4, decay: 0.008 });
      rustle(s, 0, { dur: 0.3, gain: 0.2 });
    }
  },
  // Held under a slide for as long as it lasts (MatchAudio): an even scrape with no attack of its own.
  slideLoop: {
    category: 'move',
    duration: 1.2,
    variants: 1,
    render: (s) => {
      noise(s, 0, { attack: 0.001, hold: 1.2, decay: 0.001, gain: 0.35, filter: { type: 'bandpass', freq: 1300, q: 0.8 } });
      grains(s, 0, { count: 60, spread: 1.2, gain: 0.12, freq: 2600, q: 1.4, decay: 0.008 });
    }
  }
};

export const FOLEY_SOUNDS = { ...CUE_SOUNDS, ...FAMILY_SOUNDS, ...STEP_SOUNDS, ...GEAR_SOUNDS, ...MOVE_SOUNDS };
export { FOOT };
