import { grains, noise, rand, strike, tone, vary, type Synth } from '../synth';

/** Plastic-on-plastic slide with ridge chatter (mags, pumps, shells). */
export function slide(s: Synth, at: number, o: { from: number; to: number; dur: number; gain: number }): void {
  noise(s, at, {
    attack: o.dur * 0.3,
    hold: o.dur * 0.5,
    decay: 0.04,
    gain: o.gain,
    filter: { type: 'bandpass', freq: o.from * vary(s, 0.05), q: 2.2, sweep: [[o.dur, o.to]] }
  });
  grains(s, at, { count: 5, spread: o.dur, gain: o.gain * 0.9, freq: (o.from + o.to) * 0.6, q: 3, decay: 0.008 });
}

/** Metal on metal: narrow, bright friction noise. */
export function scrape(s: Synth, at: number, o: { freq: number; dur: number; gain: number }): void {
  noise(s, at, {
    attack: o.dur * 0.25,
    hold: o.dur * 0.6,
    decay: 0.03,
    gain: o.gain,
    filter: [
      { type: 'bandpass', freq: o.freq * vary(s, 0.05), q: 5, sweep: [[o.dur, o.freq * 1.25]] },
      { type: 'highpass', freq: 1200 }
    ]
  });
}

/** Inharmonic bar-like partials: clinks, clanks, pings. */
export function metal(s: Synth, at: number, o: { base: number; gain: number; decay: number; dest?: AudioNode }): void {
  const b = o.base * vary(s, 0.03);
  const ratios = [1, 2.76, 5.4, 8.93];
  const weights = [0.5, 0.32, 0.2, 0.12];
  strike(
    s,
    at,
    ratios
      .map((r, i) => ({ f: b * r * vary(s, 0.01), decay: o.decay / (1 + i * 0.6), gain: o.gain * weights[i]! }))
      .filter((m) => m.f < s.ctx.sampleRate / 2 - 500),
    o.dest
  );
  noise(s, at, {
    attack: 0.0002,
    decay: 0.006,
    gain: o.gain * 0.5,
    filter: { type: 'highpass', freq: Math.min(b * 2, 8000), q: 0 },
    dest: o.dest
  });
}

/** Air movement: band-passed noise sweeping up then down. */
export function whoosh(s: Synth, at: number, o: { from: number; peak: number; to: number; dur: number; gain: number }): void {
  const p = o.peak * vary(s, 0.08);
  noise(s, at, {
    attack: o.dur * 0.45,
    decay: o.dur * 0.9,
    gain: o.gain,
    filter: { type: 'bandpass', freq: o.from, q: 1.4, sweep: [[o.dur * 0.45, p], [o.dur, o.to]] }
  });
  noise(s, at, {
    attack: o.dur * 0.5,
    decay: o.dur * 0.7,
    gain: o.gain * 0.5,
    filter: { type: 'lowpass', freq: p * 0.5, q: 0 }
  });
}

/** Fabric rustle: dense high grains over a soft bed. */
export function rustle(s: Synth, at: number, o: { dur: number; gain: number }): void {
  noise(s, at, {
    attack: o.dur * 0.3,
    hold: o.dur * 0.3,
    decay: o.dur * 0.5,
    gain: o.gain * 0.35,
    filter: { type: 'bandpass', freq: 2600 * vary(s, 0.1), q: 0.7 }
  });
  grains(s, at, {
    count: Math.round(o.dur * 110),
    spread: o.dur,
    gain: o.gain,
    freq: 3400,
    q: 0.9,
    decay: 0.018
  });
}

/** Bubbly water: rising sine chirps plus spray. */
export function splash(s: Synth, at: number, o: { gain: number; size: number }): void {
  noise(s, at, {
    attack: 0.004,
    decay: 0.18 * o.size,
    gain: o.gain * 0.7,
    filter: { type: 'bandpass', freq: 1100, q: 0.8, sweep: [[0.15 * o.size, 450]] }
  });
  noise(s, at + 0.01, {
    attack: 0.01,
    decay: 0.16 * o.size,
    gain: o.gain * 0.3,
    filter: { type: 'highpass', freq: 3000, q: 0 }
  });
  const bubbles = 2 + Math.floor(s.rng() * 3 * o.size);
  for (let i = 0; i < bubbles; i++) {
    const f = rand(s, 380, 900) / Math.sqrt(o.size);
    tone(s, at + rand(s, 0.005, 0.12 * o.size), {
      freq: f,
      sweep: [[0.035, f * 2.4]],
      attack: 0.002,
      decay: 0.045,
      gain: o.gain * rand(s, 0.12, 0.25)
    });
  }
}

/** Small bricks bouncing: each piece hits a few times with shrinking gaps. */
export function bounces(
  s: Synth,
  at: number,
  o: { pieces: number; spread: number; pitch: [number, number]; gain: number; hops?: number; dest?: AudioNode },
  hit: (t: number, pitch: number, gain: number) => void
): void {
  for (let i = 0; i < o.pieces; i++) {
    let t = at + o.spread * s.rng() ** 1.6;
    let gap = rand(s, 0.06, 0.16);
    let g = o.gain * rand(s, 0.45, 1);
    const pitch = rand(s, o.pitch[0], o.pitch[1]);
    const hops = o.hops ?? 3;
    for (let h = 0; h < hops && g > o.gain * 0.06; h++) {
      hit(t, pitch * vary(s, 0.02), g);
      t += gap;
      gap *= rand(s, 0.45, 0.65);
      g *= rand(s, 0.35, 0.55);
    }
  }
}
