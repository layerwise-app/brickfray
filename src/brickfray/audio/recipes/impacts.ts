import type { Surface } from '../../world/types';
import type { SoundSpec } from '../catalog';
import type { MeleeClass, MeleeHit, WhizClass } from '../types';
import { clack, drive, gainNode, grains, noise, rand, strike, thump, tone, vary, type Synth } from '../synth';
import { bounces, metal, rustle, splash, whoosh } from './parts';

const crack = (s: Synth, at: number, hp: number, gain: number, decay = 0.016) =>
  noise(s, at, { attack: 0.0002, decay: decay * vary(s, 0.15), gain, filter: { type: 'highpass', freq: hp, q: 0 } });

const plasticBits = (s: Synth, at: number, o: { pieces: number; spread: number; pitch: [number, number]; gain: number; hops?: number }) =>
  bounces(s, at, o, (t, pitch, gain) => clack(s, t, { pitch, gain, decay: 0.035 }));

const BULLET: Record<Surface, (s: Synth) => void> = {
  plastic: (s) => {
    crack(s, 0, 2500, 0.5);
    clack(s, 0, { pitch: 2000, gain: 0.75, decay: 0.06, bright: 1.2 });
    thump(s, 0, { from: 220, to: 120, glide: 0.03, decay: 0.06, gain: 0.3 });
    plasticBits(s, 0.04, { pieces: 2, spread: 0.06, pitch: [3000, 4500], gain: 0.18, hops: 2 });
  },
  metal: (s) => {
    crack(s, 0, 3000, 0.6);
    metal(s, 0, { base: 1800, gain: 0.45, decay: 0.35 });
    if (s.rng() < 0.5) {
      tone(s, 0.01, { freq: 2600 * vary(s, 0.1), sweep: [[0.25, 1100]], attack: 0.01, decay: 0.28, gain: 0.08 });
    }
  },
  wood: (s) => {
    crack(s, 0, 1800, 0.35, 0.02);
    const f = 320 * vary(s, 0.06);
    strike(s, 0, [
      { f, decay: 0.1, gain: 0.5 },
      { f: f * 2.2, decay: 0.07, gain: 0.3 },
      { f: f * 4, decay: 0.04, gain: 0.15 }
    ]);
    noise(s, 0, { attack: 0.0005, decay: 0.05, gain: 0.45, filter: { type: 'bandpass', freq: 800, q: 1 } });
    grains(s, 0.005, { count: 6, spread: 0.06, gain: 0.2, freq: 3000, q: 1.5, decay: 0.006 });
  },
  glass: (s) => {
    crack(s, 0, 4000, 0.6, 0.02);
    metal(s, 0, { base: 3000, gain: 0.25, decay: 0.2 });
    bounces(s, 0.02, { pieces: 4, spread: 0.12, pitch: [4200, 7000], gain: 0.12, hops: 2 }, (t, pitch, gain) =>
      tone(s, t, { freq: pitch, decay: 0.06, gain })
    );
  },
  foliage: (s) => {
    noise(s, 0, { attack: 0.002, decay: 0.1, gain: 0.5, filter: { type: 'bandpass', freq: 2400, q: 0.7 } });
    grains(s, 0, { count: 10, spread: 0.1, gain: 0.3, freq: 3000, q: 0.9, decay: 0.015 });
    clack(s, 0.003, { pitch: 2400, gain: 0.2, decay: 0.012 });
  },
  water: (s) => {
    splash(s, 0, { gain: 0.8, size: 0.6 });
    tone(s, 0, { freq: 250, sweep: [[0.03, 800]], attack: 0.002, decay: 0.06, gain: 0.25 });
  },
  stone: (s) => {
    crack(s, 0, 2000, 0.6, 0.02);
    noise(s, 0, { attack: 0.0005, decay: 0.05, gain: 0.5, filter: { type: 'bandpass', freq: 1500, q: 1 } });
    grains(s, 0.01, { count: 10, spread: 0.12, gain: 0.18, freq: 3200, q: 1.2, decay: 0.008, fade: 1.5 });
    thump(s, 0, { from: 140, to: 80, glide: 0.03, decay: 0.06, gain: 0.35 });
  }
};

const bulletSpec = (surface: Surface): SoundSpec => ({
  category: 'impact',
  duration: surface === 'metal' ? 0.6 : 0.4,
  render: BULLET[surface]
});

const IMPACT_SOUNDS = Object.fromEntries(
  (Object.keys(BULLET) as Surface[]).map((surface) => [`impact:${surface}`, bulletSpec(surface)])
) as Record<`impact:${Surface}`, SoundSpec>;

function explosion(s: Synth) {
  const shaped = drive(s, 2.5);
  const body = gainNode(s, 0.5, shaped);
  crack(s, 0, 1000, 1.5, 0.05);
  noise(s, 0, {
    attack: 0.003,
    decay: 1.4,
    gain: 4,
    filter: { type: 'lowpass', freq: 2500, q: 0, sweep: [[0.6, 250]] },
    dest: body
  });
  noise(s, 0.005, {
    attack: 0.01,
    decay: 0.9,
    gain: 2.5,
    filter: { type: 'bandpass', freq: 420 * vary(s, 0.1), q: 0.7, sweep: [[0.8, 160]] },
    dest: body
  });
  thump(s, 0, { from: 80, to: 28, glide: 0.25, decay: 1.3, gain: 0.9, dest: body });
  noise(s, 0.05, {
    attack: 0.1,
    decay: 2.5,
    gain: 1.2,
    filter: [
      { type: 'lowpass', freq: 300, q: 0 },
      { type: 'highpass', freq: 30, q: 0 }
    ]
  });
  grains(s, 0.05, { count: 60, spread: 1.4, gain: 0.3, freq: 2500, q: 1.2, decay: 0.01, fade: 1.6 });
  plasticBits(s, 0.15, { pieces: 16, spread: 1.1, pitch: [900, 3000], gain: 0.25 });
}

type ImpactIds =
  | 'impactBody'
  | 'impactHead'
  | 'shatter'
  | 'brickClatter'
  | 'casing'
  | 'shell'
  | `whiz:${WhizClass}`
  | 'grenadeBounce'
  | 'explosion'
  | 'explosionFar'
  | `meleeHit:${MeleeHit}`
  | `meleeSwing:${MeleeClass}`;

const meleeHit = (pitch: number, low: number, ring: number): SoundSpec => ({
  category: 'hit',
  duration: 0.6,
  loudness: -20,
  render: (s) => {
    clack(s, 0, { pitch, gain: 0.9, decay: 0.09, bright: 0.7 });
    thump(s, 0, { from: low * 2, to: low, glide: 0.05, decay: 0.15, gain: 0.9 });
    noise(s, 0, { attack: 0.0005, decay: 0.06, gain: 0.45, filter: { type: 'bandpass', freq: pitch * 1.5, q: 0.9 } });
    if (ring) metal(s, 0.002, { base: ring, gain: 0.3, decay: 0.25 });
    else plasticBits(s, 0.03, { pieces: 2, spread: 0.08, pitch: [1800, 3000], gain: 0.2, hops: 2 });
  }
});

/** Peaks 45 ms in: the view model cues the swing 55 ms before the strike. */
const meleeSwing = (peak: number): SoundSpec => ({
  category: 'fx',
  duration: 0.3,
  loudness: -21,
  render: (s) => whoosh(s, 0, { from: peak * 0.3, peak: rand(s, peak * 0.9, peak * 1.1), to: peak * 0.35, dur: 0.1, gain: 0.8 })
});

const MELEE: Record<`meleeHit:${MeleeHit}` | `meleeSwing:${MeleeClass}`, SoundSpec> = {
  'meleeHit:blade': meleeHit(2600, 140, 0),
  'meleeHit:chop': meleeHit(1200, 110, 0),
  'meleeHit:iron': meleeHit(600, 55, 1400),
  'meleeHit:mallet': meleeHit(500, 70, 0),
  'meleeHit:clank': meleeHit(1500, 90, 2600),
  'meleeSwing:blunt': meleeSwing(750),
  'meleeSwing:blade': meleeSwing(1900),
  'meleeSwing:heavy': meleeSwing(520)
};

/** A round passing close: a band of noise sweeping down (Doppler), pitched by the kind of round. */
const whiz = (pitch: number): SoundSpec => ({
  category: 'fx',
  duration: 0.35,
  render: (s) => {
    const f = pitch * vary(s, 0.1);
    noise(s, 0, {
      attack: 0.07,
      decay: 0.12,
      gain: 0.7,
      filter: { type: 'bandpass', freq: f, q: 2.5, sweep: [[0.15, f * 0.37]] }
    });
    tone(s, 0.01, { freq: f * 1.07, sweep: [[0.14, f * 0.5]], attack: 0.06, decay: 0.1, gain: 0.08 });
  }
});

const WHIZ: Record<`whiz:${WhizClass}`, SoundSpec> = {
  'whiz:small': whiz(3400),
  'whiz:rifle': whiz(2200),
  'whiz:crack': whiz(4200),
  'whiz:energy': whiz(2800),
  'whiz:spear': whiz(900)
};

const OTHER: Record<ImpactIds, SoundSpec> = {
  impactBody: {
    category: 'hit',
    duration: 0.3,
    render: (s) => {
      thump(s, 0, { from: 150, to: 85, glide: 0.04, decay: 0.12, gain: 0.5 });
      noise(s, 0, { attack: 0.0008, decay: 0.06, gain: 1.2, filter: { type: 'lowpass', freq: 900, q: 0 } });
      noise(s, 0, { attack: 0.0008, decay: 0.05, gain: 1.5, filter: { type: 'bandpass', freq: 650, q: 1.2 } });
      clack(s, 0, { pitch: 700, gain: 0.5, decay: 0.04, bright: 0.3 });
    }
  },
  impactHead: {
    category: 'hit',
    duration: 0.8,
    render: (s) => {
      const f = 1900 * vary(s, 0.03);
      strike(s, 0, [
        { f, decay: 0.6, gain: 0.35 },
        { f: f * 2.47, decay: 0.35, gain: 0.18 },
        { f: f * 3.84, decay: 0.2, gain: 0.08 }
      ]);
      clack(s, 0, { pitch: 2600, gain: 0.4, decay: 0.03 });
      thump(s, 0, { from: 200, to: 120, glide: 0.03, decay: 0.08, gain: 0.35 });
    }
  },
  shatter: {
    category: 'fx',
    duration: 1.3,
    render: (s) => {
      crack(s, 0, 1500, 0.8, 0.04);
      thump(s, 0, { from: 120, to: 60, glide: 0.08, decay: 0.2, gain: 0.6 });
      plasticBits(s, 0, { pieces: 28, spread: 0.45, pitch: [1100, 3800], gain: 0.35 });
    }
  },
  brickClatter: {
    category: 'debris',
    duration: 0.8,
    render: (s) => plasticBits(s, 0, { pieces: 7, spread: 0.15, pitch: [1400, 3600], gain: 0.45 })
  },
  casing: {
    category: 'debris',
    duration: 0.6,
    render: (s) =>
      bounces(s, 0, { pieces: 1, spread: 0, pitch: [3800, 4600], gain: 0.6, hops: 4 }, (t, pitch, gain) =>
        metal(s, t, { base: pitch, gain, decay: 0.12 })
      )
  },
  shell: {
    category: 'debris',
    duration: 0.6,
    render: (s) =>
      bounces(s, 0, { pieces: 1, spread: 0, pitch: [900, 1200], gain: 0.7, hops: 3 }, (t, pitch, gain) => {
        clack(s, t, { pitch, gain, decay: 0.05, bright: 0.5 });
        thump(s, t, { from: 260, to: 180, glide: 0.02, decay: 0.04, gain: gain * 0.3 });
      })
  },
  ...WHIZ,
  grenadeBounce: {
    category: 'impact',
    duration: 0.3,
    render: (s) => {
      clack(s, 0, { pitch: 750, gain: 0.7, decay: 0.07, bright: 0.6 });
      thump(s, 0, { from: 180, to: 110, glide: 0.03, decay: 0.07, gain: 0.45 });
      clack(s, 0.011, { pitch: 2400, gain: 0.15, decay: 0.02 });
    }
  },
  explosion: { category: 'boom', duration: 3.5, render: explosion },
  explosionFar: { category: 'boom', duration: 3.5, loudness: -14, render: explosion },
  ...MELEE
};

export const IMPACT_SOUNDS_ALL = { ...IMPACT_SOUNDS, ...OTHER };
