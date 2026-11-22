import type { SoundSpec } from '../catalog';
import { noise, rand, tone, type Synth } from '../synth';
import type { AmbientSpot } from '../types';
import { rustle } from './parts';

const call = (s: Synth, at: number, from: number, to: number, dur: number, gain: number) =>
  tone(s, at, { freq: from, sweep: [[dur, to]], attack: 0.012, decay: dur, gain });

const spot = (duration: number, render: (s: Synth) => void): SoundSpec => ({ category: 'ambient', duration, variants: 3, render });

/** Stand-ins for the recorded scenery one-shots, used only when a recording fails to load. */
const SPOTS: Record<AmbientSpot, SoundSpec> = {
  bird: spot(0.7, (s) => {
    for (let i = 0; i < 4; i++) call(s, i * 0.13, rand(s, 3200, 4200), rand(s, 2400, 5200), 0.07, 0.5);
  }),
  crow: spot(0.9, (s) => {
    for (let i = 0; i < 2; i++) noise(s, i * 0.36, { attack: 0.03, decay: 0.2, gain: 0.6, filter: { type: 'bandpass', freq: rand(s, 1300, 1700), q: 4 } });
  }),
  flag: {
    ...spot(0.8, (s) => {
      for (let i = 0; i < 3; i++) rustle(s, i * 0.2, { dur: 0.16, gain: 0.5 });
    }),
    loudness: -36
  },
  pigeon: spot(1.2, (s) => {
    for (let i = 0; i < 6; i++) rustle(s, i * 0.11, { dur: 0.09, gain: 0.5 });
  }),
  bell: {
    ...spot(2.5, (s) => {
      for (const [ratio, gain] of [[1, 0.5], [2.4, 0.25], [3.0, 0.2], [4.2, 0.1]] as const) tone(s, 0, { freq: 520 * ratio, attack: 0.004, decay: 2.4 / ratio, gain });
    }),
    loudness: -33
  },
  creak: {
    ...spot(1.2, (s) => {
      for (let i = 0; i < 3; i++) call(s, i * 0.32, rand(s, 700, 900), rand(s, 500, 1100), 0.25, 0.3);
    }),
    loudness: -34
  },
  gull: spot(1.1, (s) => {
    for (let i = 0; i < 3; i++) call(s, i * 0.3, rand(s, 2100, 2500), rand(s, 1300, 1600), 0.22, 0.5);
  }),
  gong: {
    ...spot(3, (s) => {
      for (const [ratio, gain] of [[1, 0.5], [1.48, 0.3], [2.03, 0.2], [2.9, 0.12]] as const) tone(s, 0, { freq: 180 * ratio, attack: 0.02, decay: 2.8 / ratio, gain });
    }),
    loudness: -33
  },
  chime: spot(2, (s) => {
    for (let i = 0; i < 4; i++) tone(s, i * 0.17, { freq: rand(s, 1400, 2600), attack: 0.002, decay: 1.2, gain: 0.3 });
  }),
  jungle: spot(1, (s) => {
    for (let i = 0; i < 5; i++) call(s, i * 0.12, rand(s, 1800, 2600), rand(s, 2600, 3600), 0.08, 0.5);
  }),
  water: { ...spot(1.2, (s) => noise(s, 0, { attack: 0.05, decay: 1, gain: 0.4, filter: { type: 'bandpass', freq: 1800, q: 1.2 } })), loudness: -36 },
  bamboo: { ...spot(1.2, (s) => { for (let i = 0; i < 4; i++) rustle(s, i * 0.15, { dur: 0.15, gain: 0.4 }); }), loudness: -36 },
  horn: spot(2.4, (s) => {
    tone(s, 0, { type: 'sawtooth', freq: 138, attack: 0.25, hold: 1.2, decay: 0.8, gain: 0.5, filter: { type: 'lowpass', freq: 600, q: 0 } });
  })
};

export const AMBIENT_SOUNDS = Object.fromEntries(
  (Object.keys(SPOTS) as AmbientSpot[]).map((id) => [`spot:${id}`, SPOTS[id]])
) as Record<`spot:${AmbientSpot}`, SoundSpec>;
