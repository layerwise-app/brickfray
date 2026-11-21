import { describe, expect, it } from 'vitest';
import { CueSounds } from './cue-sounds';
import type { AudioEngine, SoundId } from './types';

function setup() {
  const played: SoundId[] = [];
  const clock = { t: 10 };
  const audio = { play: (id: SoundId) => void played.push(id) } as unknown as AudioEngine;
  return { played, clock, cues: new CueSounds(audio, () => clock.t) };
}

describe('CueSounds', () => {
  it('plays one clack when a rifle reports the bolt and the carrier going home together', () => {
    const { played, clock, cues } = setup();
    cues.play('boltBack');
    clock.t += 0.07;
    cues.play('boltForward');
    clock.t += 0.005;
    cues.play('slideForward');
    expect(played).toEqual(['cue:boltBack', 'cue:boltForward']);
  });

  it('keeps a slide that runs home on its own', () => {
    const { played, clock, cues } = setup();
    cues.play('slideBack');
    clock.t += 0.06;
    cues.play('slideForward');
    clock.t += 2;
    cues.play('boltForward');
    clock.t += 0.3;
    cues.play('slideForward');
    expect(played).toEqual(['cue:slideBack', 'cue:slideForward', 'cue:boltForward', 'cue:slideForward']);
  });
});
