import type { SoundSpec } from '../catalog';
import { clack, drive, gainNode, noise, rand, thump, tone, vary, midiHz, type Synth } from '../synth';
import { brass, crash, glock, kick, marimba } from './instruments';
import { bounces } from './parts';

type FeedbackIds =
  | 'hitmarker'
  | 'headshotMarker'
  | 'killConfirm'
  | 'hurt'
  | 'death'
  | 'heartbeat'
  | 'respawn'
  | 'uiHover'
  | 'uiClick'
  | 'uiBack'
  | 'matchStart'
  | 'matchEnd'
  | 'waveStart'
  | 'countdown';

function tick(s: Synth, at: number, f: number, gain: number) {
  noise(s, at, { attack: 0.0002, decay: 0.012, gain: gain * 0.6, filter: { type: 'highpass', freq: 4500, q: 0 } });
  tone(s, at, { freq: f, decay: 0.04, gain: gain * 0.28 });
  tone(s, at, { freq: f * 2, decay: 0.012, gain: gain * 0.08 });
}

function heartbeat(s: Synth) {
  for (const [at, g, f] of [
    [0, 1, 62],
    [0.27, 0.72, 70]
  ] as const) {
    thump(s, at, { from: f * vary(s, 0.03), to: f * 0.72, glide: 0.06, decay: 0.16, gain: g });
    thump(s, at, { from: f * 2, to: f * 1.4, glide: 0.05, decay: 0.1, gain: g * 0.5 });
    thump(s, at, { from: f * 4, to: f * 3, glide: 0.04, decay: 0.06, gain: g * 0.18 });
    noise(s, at, { attack: 0.004, decay: 0.08, gain: g * 0.6, filter: { type: 'lowpass', freq: 400, q: 0 } });
  }
}

function respawn(s: Synth) {
  let t = 0;
  for (let i = 0; i < 6; i++) {
    clack(s, t, { pitch: 1200 + i * 280, gain: 0.35 + i * 0.05, decay: 0.04 });
    t += 0.11 * 0.8 ** i;
  }
  for (const [i, n] of [72, 76, 79, 86].entries()) glock(s, t + 0.02 + i * 0.03, midiHz(n), 0.4);
  noise(s, 0, {
    attack: t,
    decay: 0.6,
    gain: 0.12,
    filter: { type: 'bandpass', freq: 2000, q: 1.5, sweep: [[t, 6000]] }
  });
}

export const FEEDBACK_SOUNDS: Record<FeedbackIds, SoundSpec> = {
  hitmarker: { category: 'marker', duration: 0.12, loudness: -21, render: (s) => tick(s, 0, 3200 * vary(s, 0.01), 1) },
  // A helmet "tink" then a bell-like ding: unmistakably different from the body tick.
  headshotMarker: {
    category: 'marker',
    duration: 0.5,
    loudness: -17,
    render: (s) => {
      tick(s, 0, 4200, 1);
      glock(s, 0.03, midiHz(100), 0.75);
      glock(s, 0.03, midiHz(107), 0.25);
    }
  },
  killConfirm: {
    category: 'marker',
    duration: 1.7,
    loudness: -17,
    render: (s) => {
      clack(s, 0, { pitch: 3000, gain: 0.35, decay: 0.03 });
      for (const [i, n] of [84, 88, 91].entries()) glock(s, i * 0.055 * vary(s, 0.05), midiHz(n), 0.55 + i * 0.1);
      glock(s, 0.16, midiHz(96), 0.3);
    }
  },
  hurt: {
    category: 'player',
    duration: 0.4,
    render: (s) => {
      const crunch = gainNode(s, 1, drive(s, 2));
      thump(s, 0, { from: 120 * vary(s, 0.08), to: 60, glide: 0.06, decay: 0.18, gain: 0.9, dest: crunch });
      noise(s, 0, { attack: 0.001, decay: 0.12, gain: 0.5, filter: { type: 'lowpass', freq: 650, q: 0 }, dest: crunch });
      clack(s, 0, { pitch: 600, gain: 0.25, decay: 0.05, bright: 0.3 });
      noise(s, 0.02, { attack: 0.03, decay: 0.12, gain: 0.08, filter: { type: 'bandpass', freq: 900, q: 1.2 } });
    }
  },
  death: {
    category: 'player',
    duration: 1.5,
    render: (s) => {
      tone(s, 0, {
        type: 'triangle',
        freq: 420 * vary(s, 0.04),
        sweep: [[0.7, 70]],
        attack: 0.01,
        decay: 0.9,
        gain: 0.35,
        filter: { type: 'lowpass', freq: 1200, q: 0 }
      });
      thump(s, 0, { from: 100, to: 40, glide: 0.2, decay: 0.4, gain: 0.7 });
      bounces(s, 0.05, { pieces: 12, spread: 0.6, pitch: [900, 2600], gain: 0.3 }, (t, pitch, gain) =>
        clack(s, t, { pitch, gain, decay: 0.035 })
      );
    }
  },
  heartbeat: { category: 'player', duration: 0.6, variants: 3, render: heartbeat },
  respawn: { category: 'fx', duration: 2.3, variants: 3, render: respawn },
  uiHover: {
    category: 'ui',
    duration: 0.08,
    variants: 3,
    loudness: -30,
    render: (s) => {
      tone(s, 0, { freq: 1800 * vary(s, 0.01), decay: 0.025, gain: 0.4 });
      noise(s, 0, { attack: 0.0002, decay: 0.006, gain: 0.15, filter: { type: 'highpass', freq: 5000, q: 0 } });
    }
  },
  uiClick: {
    category: 'ui',
    duration: 0.12,
    variants: 3,
    render: (s) => {
      clack(s, 0, { pitch: 2200, gain: 0.6, decay: 0.035 });
      thump(s, 0, { from: 400, to: 250, glide: 0.02, decay: 0.03, gain: 0.15 });
    }
  },
  uiBack: {
    category: 'ui',
    duration: 0.16,
    variants: 3,
    render: (s) => {
      clack(s, 0, { pitch: 2000, gain: 0.5, decay: 0.03 });
      clack(s, 0.045, { pitch: 1500, gain: 0.45, decay: 0.035 });
    }
  },
  matchStart: {
    category: 'stinger',
    duration: 2.2,
    variants: 3,
    render: (s) => {
      marimba(s, 0, midiHz(72), 0.5);
      marimba(s, 0.09, midiHz(77), 0.55);
      for (const n of [53, 57, 60, 65]) brass(s, 0.18, midiHz(n), 0.18, 0.5);
      glock(s, 0.18, midiHz(89), 0.4);
      kick(s, 0.18, 0.9);
      crash(s, 0.18, 0.18);
    }
  },
  matchEnd: {
    category: 'stinger',
    duration: 2.6,
    variants: 3,
    render: (s) => {
      for (const n of [58, 62, 65, 70]) brass(s, 0, midiHz(n), 0.35, 0.4);
      for (const n of [57, 60, 65, 69]) brass(s, 0.45, midiHz(n), 0.8, 0.45);
      for (const [i, n] of [89, 84, 81, 77].entries()) glock(s, 0.45 + i * 0.09, midiHz(n), 0.3);
      kick(s, 0.45, 0.6);
    }
  },
  waveStart: {
    category: 'stinger',
    duration: 1.6,
    variants: 3,
    render: (s) => {
      brass(s, 0, midiHz(69), 0.16, 0.6);
      brass(s, 0.22, midiHz(72), 0.3, 0.65);
      brass(s, 0.22, midiHz(57), 0.3, 0.4);
      kick(s, 0.22, 1);
      thump(s, 0.22, { from: 110, to: 80, glide: 0.1, decay: 0.4, gain: 0.5 });
      for (let i = 0; i < 6; i++) {
        noise(s, i * 0.03, {
          attack: 0.0005,
          decay: 0.05,
          gain: 0.1 + i * 0.03,
          filter: { type: 'bandpass', freq: 1800, q: 0.9 }
        });
      }
    }
  },
  countdown: {
    category: 'stinger',
    duration: 0.9,
    variants: 3,
    loudness: -21,
    render: (s) => {
      marimba(s, 0, midiHz(81), 0.8);
      clack(s, 0, { pitch: rand(s, 2950, 3050), gain: 0.15, decay: 0.02 });
    }
  }
};
