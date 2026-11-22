import type { WeaponId } from '../../weapons/defs';
import type { Falloff, SoundSpec } from '../catalog';
import { clack, drive, gainNode, noise, rand, thump, tone, vary, type Synth } from '../synth';

type GunIds = `fire:${WeaponId}` | `fireFar:${WeaponId}` | 'dryFire';

/**
 * Three layers per shot: mechanical (toy plastic), body (crack + blast +
 * band burst + thump, saturated together) and a short decaying tail. Space
 * comes from the mixer's shared room; baked echoes repeat on every shot.
 * Gains are relative RMS: band-limited noise keeps only a fraction of its
 * power, so noise layers carry larger numbers than the sine thump.
 */
interface GunVoice {
  duration: number;
  /**
   * Loudness targets near / far: shotgun, sniper and cannon sit 3-4 dB over pistol, nailer and buzzer, the sniper the
   * loudest of all and 3.5 dB over the rifle far away. Low enough that a recorded shot reaches them without the
   * loader's limiter: the transient stays a transient.
   */
  loudness: [number, number];
  /** The sniper carries further than the other guns (catalog FALLOFF.carry). */
  falloff?: Falloff;
  mech(s: Synth): void;
  crack: { hp: number; decay: number; gain: number };
  blast: { cutoff: number; decay: number; gain: number };
  burst: { freq: number; to: number; q: number; decay: number; gain: number };
  thump: { from: number; to: number; glide: number; decay: number; gain: number };
  drive: number;
  tail: { cutoff: number; to: number; decay: number; gain: number };
  far: { duration: number; cutoff: number; body: number; tail: number; decay: number; thump: number };
}

const BASE = {
  ar: {
    duration: 0.7,
    loudness: [-17, -19],
    mech: (s) => {
      clack(s, 0, { pitch: 2300, gain: 0.7, decay: 0.04 });
      clack(s, 0.028 * vary(s, 0.1), { pitch: 3400, gain: 0.4, decay: 0.03 });
      tone(s, 0.03, { freq: 5200 * vary(s, 0.04), decay: 0.07, gain: 0.04 });
    },
    crack: { hp: 2000, decay: 0.022, gain: 1.6 },
    blast: { cutoff: 5000, decay: 0.05, gain: 0.8 },
    burst: { freq: 1500, to: 600, q: 0.8, decay: 0.13, gain: 3.2 },
    thump: { from: 165, to: 55, glide: 0.05, decay: 0.17, gain: 0.45 },
    drive: 2,
    tail: { cutoff: 3200, to: 1300, decay: 0.32, gain: 0.42 },
    far: { duration: 1.3, cutoff: 1400, body: 2.4, tail: 1, decay: 0.9, thump: 0.3 }
  },
  shotgun: {
    duration: 1.1,
    loudness: [-15.5, -17.5],
    mech: (s) => {
      clack(s, 0, { pitch: 1500, gain: 0.6, decay: 0.06 });
      const count = 4 + Math.floor(s.rng() * 3);
      for (let i = 0; i < count; i++) {
        clack(s, rand(s, 0.012, 0.095), { pitch: rand(s, 1700, 3300), gain: rand(s, 0.15, 0.32), decay: 0.03 });
      }
    },
    crack: { hp: 1200, decay: 0.035, gain: 1.4 },
    blast: { cutoff: 3000, decay: 0.12, gain: 1 },
    burst: { freq: 1000, to: 300, q: 0.6, decay: 0.26, gain: 3.4 },
    thump: { from: 120, to: 40, glide: 0.1, decay: 0.34, gain: 0.7 },
    drive: 2.4,
    tail: { cutoff: 2400, to: 800, decay: 0.55, gain: 0.5 },
    far: { duration: 1.7, cutoff: 900, body: 3, tail: 1.2, decay: 1.2, thump: 0.55 }
  },
  sniper: {
    duration: 1.6,
    loudness: [-13.5, -15.5],
    mech: (s) => {
      clack(s, 0, { pitch: 2000, gain: 0.4, decay: 0.05 });
      tone(s, 0.004, { freq: 3700 * vary(s, 0.03), decay: 0.15, gain: 0.06 });
    },
    crack: { hp: 2800, decay: 0.013, gain: 2.2 },
    blast: { cutoff: 6000, decay: 0.06, gain: 0.9 },
    burst: { freq: 2200, to: 500, q: 0.7, decay: 0.13, gain: 3 },
    thump: { from: 110, to: 42, glide: 0.07, decay: 0.32, gain: 0.55 },
    drive: 2.2,
    tail: { cutoff: 2600, to: 900, decay: 0.8, gain: 0.5 },
    far: { duration: 2.1, cutoff: 1100, body: 2.6, tail: 1.3, decay: 1.5, thump: 0.35 }
  },
  pistol: {
    duration: 0.5,
    loudness: [-19, -21],
    mech: (s) => {
      clack(s, 0, { pitch: 3000, gain: 0.7, decay: 0.035 });
      clack(s, 0.034 * vary(s, 0.1), { pitch: 2500, gain: 0.5, decay: 0.04 });
      clack(s, 0.062 * vary(s, 0.1), { pitch: 3600, gain: 0.35, decay: 0.03 });
    },
    crack: { hp: 2400, decay: 0.017, gain: 1.6 },
    blast: { cutoff: 7000, decay: 0.04, gain: 0.7 },
    burst: { freq: 2800, to: 1200, q: 1, decay: 0.09, gain: 2.6 },
    thump: { from: 200, to: 85, glide: 0.04, decay: 0.13, gain: 0.3 },
    drive: 1.8,
    tail: { cutoff: 4500, to: 2000, decay: 0.22, gain: 0.32 },
    far: { duration: 1.0, cutoff: 1700, body: 2.2, tail: 0.9, decay: 0.7, thump: 0.2 }
  }
} satisfies Record<string, GunVoice>;

const VOICES: Record<WeaponId, GunVoice> = {
  ...BASE,
  sniper: { ...BASE.sniper, falloff: 'carry' },
  // Nailer: rapid, light and snappy; a pneumatic hiss under the crack.
  nailer: {
    ...BASE.ar,
    duration: 0.5,
    loudness: [-19.5, -21.5],
    mech: (s) => {
      clack(s, 0, { pitch: 2900, gain: 0.6, decay: 0.03 });
      noise(s, 0.004, { attack: 0.001, decay: 0.05, gain: 0.25, filter: { type: 'highpass', freq: 5000, q: 0 } });
    },
    burst: { freq: 2000, to: 900, q: 0.9, decay: 0.09, gain: 2.8 },
    thump: { from: 190, to: 80, glide: 0.04, decay: 0.12, gain: 0.3 },
    tail: { ...BASE.ar.tail, decay: 0.25, gain: 0.35 }
  },
  // Pulse Carbine: a bright electric zap riding on a rifle report.
  pulse: {
    ...BASE.ar,
    loudness: [-17.5, -19.5],
    mech: (s) => {
      clack(s, 0, { pitch: 2600, gain: 0.5, decay: 0.035 });
      tone(s, 0, { freq: 1800 * vary(s, 0.03), decay: 0.08, gain: 0.12 });
      tone(s, 0.004, { freq: 3600 * vary(s, 0.03), decay: 0.05, gain: 0.06 });
    },
    burst: { freq: 1700, to: 700, q: 1.2, decay: 0.11, gain: 3 }
  },
  // Harpooner: a deep pneumatic thunk, less crack than a rifle.
  harpoon: {
    ...BASE.sniper,
    duration: 1.2,
    loudness: [-17.5, -19.5],
    mech: (s) => {
      clack(s, 0, { pitch: 1300, gain: 0.7, decay: 0.07 });
      noise(s, 0, { attack: 0.002, decay: 0.12, gain: 0.5, filter: { type: 'bandpass', freq: 900, q: 1 } });
    },
    crack: { hp: 1600, decay: 0.02, gain: 1.2 },
    thump: { from: 95, to: 38, glide: 0.09, decay: 0.38, gain: 0.7 }
  },
  // Hand Cannon: a heavy revolver boom.
  cannon: {
    ...BASE.pistol,
    duration: 0.9,
    loudness: [-16, -18],
    crack: { hp: 1800, decay: 0.024, gain: 1.7 },
    burst: { freq: 1600, to: 500, q: 0.8, decay: 0.16, gain: 3.2 },
    thump: { from: 140, to: 48, glide: 0.07, decay: 0.3, gain: 0.6 },
    tail: { cutoff: 3000, to: 1100, decay: 0.45, gain: 0.45 }
  },
  // Buzzer: a thin, fast machine-pistol rattle.
  buzzer: {
    ...BASE.pistol,
    duration: 0.5,
    loudness: [-19, -21],
    burst: { freq: 3200, to: 1500, q: 1, decay: 0.07, gain: 2.4 },
    thump: { from: 220, to: 100, glide: 0.03, decay: 0.1, gain: 0.25 }
  }
};

function nearShot(g: GunVoice) {
  return (s: Synth) => {
    const shaped = drive(s, g.drive);
    const body = gainNode(s, 0.5, shaped);
    noise(s, 0, {
      attack: 0.0003,
      decay: g.crack.decay * vary(s, 0.15),
      gain: g.crack.gain,
      filter: { type: 'highpass', freq: g.crack.hp * vary(s, 0.1), q: 0 },
      dest: body
    });
    noise(s, 0, {
      attack: 0.0005,
      decay: g.blast.decay * vary(s, 0.15),
      gain: g.blast.gain,
      filter: { type: 'lowpass', freq: g.blast.cutoff, q: 0 },
      dest: body
    });
    noise(s, 0, {
      attack: 0.0008,
      decay: g.burst.decay * vary(s, 0.12),
      gain: g.burst.gain,
      filter: {
        type: 'bandpass',
        freq: g.burst.freq * vary(s, 0.08),
        q: g.burst.q,
        sweep: [[g.burst.decay * 0.6, g.burst.to]]
      },
      dest: body
    });
    thump(s, 0, { ...g.thump, from: g.thump.from * vary(s, 0.05), dest: body });
    noise(s, 0.003, {
      attack: 0.004,
      decay: g.tail.decay * vary(s, 0.1),
      gain: g.tail.gain,
      filter: [
        { type: 'lowpass', freq: g.tail.cutoff, sweep: [[g.tail.decay * 0.5, g.tail.to]] },
        { type: 'highpass', freq: 70 }
      ]
    });
    g.mech(s);
  };
}

/** Distant shot: air eats the highs and the crack; a longer, darker tail sells the distance. */
function farShot(g: GunVoice) {
  return (s: Synth) => {
    const f = g.far;
    const body = gainNode(s, 1);
    noise(s, 0, {
      attack: 0.006,
      decay: g.burst.decay * 2.2,
      gain: f.body,
      filter: { type: 'lowpass', freq: f.cutoff * vary(s, 0.08), q: 0 },
      dest: body
    });
    thump(s, 0, {
      from: g.thump.from * 0.8,
      to: g.thump.to,
      glide: g.thump.glide * 1.6,
      decay: g.thump.decay * 1.7,
      gain: f.thump,
      attack: 0.006,
      dest: body
    });
    noise(s, 0.012, {
      attack: 0.03,
      decay: f.decay * vary(s, 0.1),
      gain: f.tail,
      filter: [
        { type: 'lowpass', freq: f.cutoff * 0.7, sweep: [[f.decay * 0.6, f.cutoff * 0.25]] },
        { type: 'highpass', freq: 55 }
      ]
    });
  };
}

function dryFire(s: Synth) {
  clack(s, 0, { pitch: 2600, gain: 0.6, decay: 0.03 });
  clack(s, 0.011, { pitch: 1300, gain: 0.22, decay: 0.025 });
  tone(s, 0.002, { freq: 4800 * vary(s, 0.04), decay: 0.05, gain: 0.03 });
}

function gunEntries(): Record<GunIds, SoundSpec> {
  const out: Partial<Record<GunIds, SoundSpec>> = { dryFire: { category: 'mech', duration: 0.2, render: dryFire } };
  for (const id of Object.keys(VOICES) as WeaponId[]) {
    const g = VOICES[id];
    out[`fire:${id}`] = { category: 'gun', duration: g.duration, loudness: g.loudness[0], falloff: g.falloff, render: nearShot(g) };
    out[`fireFar:${id}`] = { category: 'gunFar', duration: g.far.duration, loudness: g.loudness[1], falloff: g.falloff, render: farShot(g) };
  }
  return out as Record<GunIds, SoundSpec>;
}

export const GUN_SOUNDS = gunEntries();
