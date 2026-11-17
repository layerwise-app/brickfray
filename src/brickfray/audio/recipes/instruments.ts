import { clack, noise, strike, thump, tone, vary, type Synth } from '../synth';

/** Tuned mallet instruments, keys, bass and drums shared by music and stingers. */

export function marimba(s: Synth, at: number, f: number, gain: number, dest?: AudioNode): void {
  strike(
    s,
    at,
    [
      { f, decay: 0.75, gain: gain * 0.6 },
      { f: f * 3.93, decay: 0.12, gain: gain * 0.22 },
      { f: f * 9.2, decay: 0.03, gain: gain * 0.05 }
    ].filter((m) => m.f < 15000),
    dest,
    0.002
  );
  noise(s, at, { attack: 0.0004, decay: 0.01, gain: gain * 0.12, filter: { type: 'bandpass', freq: Math.min(f * 2, 9000), q: 1.5 }, dest });
}

export function glock(s: Synth, at: number, f: number, gain: number, dest?: AudioNode): void {
  strike(
    s,
    at,
    [
      { f, decay: 1.4, gain: gain * 0.5 },
      { f: f * 2.76, decay: 0.45, gain: gain * 0.16 },
      { f: f * 5.4, decay: 0.18, gain: gain * 0.07 }
    ].filter((m) => m.f < 16000),
    dest,
    0.001
  );
}

/** Soft electric piano: FM tine whose brightness fades as the note rings. */
export function epiano(s: Synth, at: number, f: number, dur: number, gain: number, dest?: AudioNode): void {
  tone(s, at, {
    freq: f,
    attack: 0.004,
    hold: dur * 0.5,
    decay: 0.9 + dur * 0.5,
    gain: gain * 0.5,
    fm: { ratio: 1, index: 1.1, decay: 0.5, floor: 0.12 },
    dest
  });
  tone(s, at, { freq: f * 4, attack: 0.002, decay: 0.12, gain: gain * 0.04, dest });
}

export function pluckBass(s: Synth, at: number, f: number, dur: number, gain: number, dest?: AudioNode): void {
  tone(s, at, {
    type: 'sawtooth',
    freq: f,
    attack: 0.005,
    hold: dur * 0.5,
    decay: 0.25,
    gain: gain * 0.35,
    filter: { type: 'lowpass', freq: 1500, q: 2, sweep: [[0.12, 320]] },
    dest
  });
  tone(s, at, { freq: f, attack: 0.006, hold: dur * 0.55, decay: 0.2, gain: gain * 0.55, dest });
}

export function pad(s: Synth, at: number, notes: readonly number[], dur: number, gain: number, dest?: AudioNode): void {
  for (const f of notes) {
    for (const detune of [-7, 7]) {
      tone(s, at, {
        type: 'sawtooth',
        freq: f,
        detune,
        attack: Math.min(0.9, dur * 0.4),
        hold: Math.max(dur - 0.9, 0.1),
        decay: 1.4,
        gain: (gain * 0.12) / notes.length,
        filter: { type: 'lowpass', freq: 900, q: -1, sweep: [[dur * 0.5, 1400], [dur, 700]] },
        dest
      });
    }
  }
}

/** Short brassy stab: detuned saws with a filter swell. */
export function brass(s: Synth, at: number, f: number, dur: number, gain: number, dest?: AudioNode): void {
  for (const detune of [-6, 6]) {
    tone(s, at, {
      type: 'sawtooth',
      freq: f,
      detune,
      attack: 0.025,
      hold: dur,
      decay: 0.35,
      gain: gain * 0.22,
      filter: { type: 'lowpass', freq: 500, q: 1, sweep: [[0.06, 2600], [dur + 0.2, 1100]] },
      dest
    });
  }
}

export function kick(s: Synth, at: number, gain: number, dest?: AudioNode): void {
  thump(s, at, { from: 150, to: 48, glide: 0.07, decay: 0.35, gain, dest });
  noise(s, at, { attack: 0.0002, decay: 0.006, gain: gain * 0.15, filter: { type: 'highpass', freq: 3000, q: 0 }, dest });
}

export function clap(s: Synth, at: number, gain: number, dest?: AudioNode): void {
  for (const dt of [0, 0.009, 0.018]) {
    noise(s, at + dt, { attack: 0.0005, decay: 0.014, gain: gain * 0.5, filter: { type: 'bandpass', freq: 1250, q: 1.1 }, dest });
  }
  noise(s, at + 0.024, { attack: 0.0005, decay: 0.16, gain: gain * 0.55, filter: { type: 'bandpass', freq: 1400, q: 0.9 }, dest });
  tone(s, at, { freq: 200, decay: 0.06, gain: gain * 0.25, dest });
}

export function hat(s: Synth, at: number, gain: number, open: boolean, dest?: AudioNode): void {
  noise(s, at, {
    attack: 0.0004,
    decay: open ? 0.24 : 0.04 * vary(s, 0.2),
    gain,
    filter: [
      { type: 'highpass', freq: 7000, q: 0 },
      { type: 'peaking', freq: 10000, q: 1, gain: 4 }
    ],
    dest
  });
}

export function shaker(s: Synth, at: number, gain: number, dest?: AudioNode): void {
  noise(s, at, { attack: 0.012, decay: 0.05, gain, filter: { type: 'bandpass', freq: 6200, q: 1 }, dest });
}

/** Plastic block: the toy percussion signature. */
export function block(s: Synth, at: number, pitch: number, gain: number, dest?: AudioNode): void {
  clack(s, at, { pitch, gain, decay: 0.05, dest });
}

export function crash(s: Synth, at: number, gain: number, dest?: AudioNode): void {
  noise(s, at, {
    attack: 0.001,
    decay: 1.6,
    gain,
    filter: [
      { type: 'highpass', freq: 4000, q: 0 },
      { type: 'peaking', freq: 7500, q: 0.8, gain: 5 }
    ],
    dest
  });
}
