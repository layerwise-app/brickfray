import { describe, expect, it } from 'vitest';
import { HEART, Heartbeat } from './heartbeat';
import { SAMPLES } from './samples';
import type { AudioEngine, PlayOptions, SoundId } from './types';

function setup() {
  let clock = 0;
  const beats: { at: number; options: PlayOptions }[] = [];
  const audio = { play: (_: SoundId, options: PlayOptions = {}) => void beats.push({ at: clock + (options.delay ?? 0), options }) } as unknown as AudioEngine;
  const heart = new Heartbeat(audio, () => 0.5);
  const run = (seconds: number, health: number, alive = true) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      clock += 1 / 60;
      heart.frame(1 / 60, alive, health);
    }
  };
  const lubs = (from = 0) => beats.filter((b) => b.at >= from && (b.options.variant ?? 0) < HEART.beats);
  const dubs = (from = 0) => beats.filter((b) => b.at >= from && (b.options.variant ?? 0) >= HEART.beats);
  return { beats, run, lubs, dubs, now: () => clock };
}

describe('Heartbeat', () => {
  it('holds a lub and a dub of each recorded beat', () => {
    expect(SAMPLES.heartbeat?.length).toBe(2 * HEART.beats);
  });

  it('stays silent above the threshold and beats in lub-dub pairs below it', () => {
    const { beats, run, lubs, dubs } = setup();
    run(3, 80);
    expect(beats).toEqual([]);
    run(6, 15);
    expect(lubs()[0]!.at).toBeCloseTo(3 + HEART.rise, 1);
    expect(lubs().length).toBeGreaterThan(4);
    expect(dubs().length).toBe(lubs().length);
    for (const [i, lub] of lubs().entries()) {
      const dub = dubs()[i]!;
      expect(dub.options.variant).toBe(HEART.beats + lub.options.variant!);
      expect(dub.at - lub.at).toBeGreaterThanOrEqual(HEART.gap[1]);
      expect(dub.at - lub.at).toBeLessThanOrEqual(HEART.gap[0]);
      expect(dub.options.volume).toBeCloseTo(lub.options.volume! * HEART.dub);
    }
  });

  it('beats faster and louder as health runs out, with a tighter lub-dub', () => {
    const calm = setup();
    calm.run(12, 28);
    const racing = setup();
    racing.run(12, 1);
    const period = (h: ReturnType<typeof setup>) => {
      const l = h.lubs(8);
      return (l.at(-1)!.at - l[0]!.at) / (l.length - 1);
    };
    expect(60 / period(calm)).toBeCloseTo(HEART.bpm[0] + (HEART.bpm[1] - HEART.bpm[0]) * (2 / 30), 0);
    expect(60 / period(racing)).toBeCloseTo(HEART.bpm[1] - (HEART.bpm[1] - HEART.bpm[0]) / 30, 0);
    expect(racing.lubs(8)[0]!.options.volume).toBeGreaterThan(calm.lubs(8)[0]!.options.volume! * 2);
    const gap = (h: ReturnType<typeof setup>) => {
      const lub = h.lubs(8)[0]!;
      return h.dubs(lub.at)[0]!.at - lub.at;
    };
    expect(gap(racing)).toBeLessThan(gap(calm));
  });

  it('fades out over a few beats once health recovers, and stops at once on death', () => {
    const { run, lubs, now } = setup();
    run(6, 10);
    const healed = now();
    run(8, 100);
    const after = lubs(healed).map((b) => b.options.volume!);
    expect(after.length).toBeGreaterThan(2);
    expect(after.every((v, i) => i === 0 || v < after[i - 1]!)).toBe(true);
    expect(lubs(healed + 6)).toEqual([]);
    run(6, 10);
    const died = now();
    run(3, 10, false);
    expect(lubs(died + 0.2)).toEqual([]);
  });
});
