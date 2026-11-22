import type { SoundId } from './types';

/**
 * Where a sound's loudest moment must land, in seconds after it is triggered. The loader shifts every recorded
 * variant so its peak sits there (render.ts), so all variants of a sound hit on the same frame; a trigger that knows
 * when the moment comes starts the sound that much earlier (a whiz peaks as the bullet passes, bullet-sounds.ts).
 *
 * Handling strokes: the view model cues a stroke as the part starts to move; the gap is the time until the clip
 * shows the part at its stop (weapons/view/clips-*.ts, at each gun's clip length). A mag-out lands on the rip.
 * Whizzes: the swell of the approach up to the pass (a supersonic crack is the pass itself). Swings: the whoosh
 * crests on the shown contact, which the view model cues 42-54 ms ahead. Reload layers: the pouch's knock and the
 * magazine's scrape at the well's mouth (reload-layers.ts). Distant blasts: every take booms at the same moment.
 */
export const PEAK_AT: Partial<Record<SoundId, number>> = {
  'cue:slideBack': 0.02,
  'foley:smgBoltBack': 0.02,
  'cue:pumpBack': 0.03,
  'cue:boltBack': 0.04,
  'foley:driverBack': 0.035,
  'foley:chargeUp': 0.042,
  'foley:boltOpen': 0.097,
  'cue:magOut': 0.02,
  'foley:boltMagOut': 0.01,
  'foley:pistolMagOut': 0.012,
  'foley:smgMagOut': 0.012,
  'foley:stripOut': 0.018,
  'foley:cellOut': 0.021,
  'cue:throw': 0.012,
  'meleeSwing:blunt': 0.045,
  'meleeSwing:blade': 0.045,
  'meleeSwing:sword': 0.045,
  'meleeSwing:heavy': 0.045,
  'foley:pouch': 0.03,
  'foley:pouchSmall': 0.03,
  'foley:pouchTool': 0.03,
  'foley:magScrape': 0.06,
  'foley:magScrapeSmall': 0.06,
  'foley:magScrapeTool': 0.06,
  'whiz:small': 0.045,
  'whiz:rifle': 0.06,
  'whiz:crack': 0.01,
  'whiz:energy': 0.07,
  'whiz:spear': 0.12,
  explosionFar: 0.03
};

/** Moves a recording so its loudest 2 ms lands `at` seconds in: a longer lead-in is cut behind a short fade-in, a shorter one padded. */
export function alignPeak(data: Float32Array<ArrayBuffer>, sampleRate: number, at: number): Float32Array<ArrayBuffer> {
  const block = Math.max(1, Math.round(0.002 * sampleRate));
  let loudest = -1;
  let peak = 0;
  for (let i = 0; i + block <= data.length; i += block) {
    let energy = 0;
    for (let j = i; j < i + block; j++) energy += data[j]! * data[j]!;
    if (energy > loudest) {
      loudest = energy;
      peak = i;
    }
  }
  const shift = peak - Math.round(at * sampleRate);
  if (shift <= 0) {
    const out = new Float32Array(data.length - shift);
    out.set(data, -shift);
    return out;
  }
  const out = data.slice(shift);
  const fade = Math.min(Math.round(0.004 * sampleRate), out.length);
  for (let i = 0; i < fade; i++) out[i]! *= Math.sin(((i / fade) * Math.PI) / 2) ** 2;
  return out;
}
