import type { MapId } from '../world/types';
import { ROOMS, type RoomDef } from './room-defs';
import { mulberry32 } from './synth';

export { ROOMS, type RoomDef } from './room-defs';

type Vec3 = [number, number, number];

const EAR = 1.6;
const SPEED_OF_SOUND = 343;
/** Image sources are traced this far; the diffuse tail carries on from there. */
const EARLY_UNTIL = 0.11;

/** The room the listener is most inside (-1: none) and how far: 0 at an opening, 1 past its fade. */
export function roomAt(map: MapId | null, x: number, y: number, z: number): { index: number; amount: number } {
  let best = { index: -1, amount: 0 };
  const p = [x, y, z];
  (map ? ROOMS[map] : []).forEach((room, index) => {
    let amount = 1;
    for (let axis = 0; axis < 3; axis++) {
      for (const [inside, fade] of [
        [p[axis]! - room.min[axis]!, room.fade[axis * 2]!],
        [room.max[axis]! - p[axis]!, room.fade[axis * 2 + 1]!]
      ] as const) {
        amount = Math.min(amount, fade > 0 ? Math.min(Math.max(inside / fade, 0), 1) : inside >= 0 ? 1 : 0);
      }
    }
    if (amount > best.amount) best = { index, amount };
  });
  return best;
}

/** A room's stereo response: its image-source reflections over a diffuse tail that swells in behind them. */
export function roomImpulse(ctx: BaseAudioContext, room: RoomDef, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const taps = reflections(room);
  const length = Math.ceil(room.t60 * 1.15 * sr);
  const buffer = ctx.createBuffer(2, length, sr);
  const first = taps[0]?.time ?? 0.005;
  const swell = Math.max(0.02, Math.cbrt(room.size[0] * room.size[1] * room.size[2]) / SPEED_OF_SOUND);
  for (let ch = 0; ch < 2; ch++) {
    const rng = mulberry32(seed * 2 + ch);
    const data = buffer.getChannelData(ch);
    let lp = 0;
    let energy = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sr;
      const rise = Math.min(Math.max((t - first) / swell, 0), 1);
      const cutoff = room.bright[0] * (room.bright[1] / room.bright[0]) ** (t / (length / sr));
      lp += ((rng() * 2 - 1) * Math.exp((-6.9 * t) / room.t60) * rise * rise - lp) * (1 - Math.exp((-2 * Math.PI * cutoff) / sr));
      data[i] = lp;
      energy += lp * lp;
    }
    const scale = room.tail / Math.sqrt(energy || 1);
    for (let i = 0; i < length; i++) data[i]! *= scale;
    for (const { time, gain, order } of taps) {
      const at = Math.round((time + (ch ? (rng() - 0.5) * 0.0008 : 0)) * sr);
      const width = 1 + order;
      const sign = rng() < 0.5 ? -1 : 1;
      for (let j = 0; j < width && at + j < length; j++) data[at + j]! += (sign * gain * room.early) / width;
    }
  }
  return buffer;
}

interface Tap {
  time: number;
  gain: number;
  order: number;
}

/** Image sources of a box heard from where the sound starts (the player's own position, mid-floor): 1/path, walls' loss per bounce. */
function reflections(room: RoomDef): Tap[] {
  const reach = EARLY_UNTIL * SPEED_OF_SOUND;
  const ear: Vec3 = [room.size[0] / 2, Math.min(EAR, room.size[1] - 0.3), room.size[2] / 2];
  const axes = [0, 1, 2].map((a) => images(room.size[a]!, ear[a]!, room.walls[a * 2]!, room.walls[a * 2 + 1]!, reach));
  const out: Tap[] = [];
  for (const x of axes[0]!) {
    for (const y of axes[1]!) {
      for (const z of axes[2]!) {
        const order = x.order + y.order + z.order;
        const d = Math.hypot(x.offset, y.offset, z.offset);
        const gain = (x.gain * y.gain * z.gain) / Math.max(d, 1);
        if (order === 0 || d > reach || gain < 0.004) continue;
        out.push({ time: d / SPEED_OF_SOUND, gain, order });
      }
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Image positions along one axis of length `size` for a source at `at`: offset from the source, kept pressure, bounces. */
function images(size: number, at: number, low: number, high: number, reach: number): { offset: number; gain: number; order: number }[] {
  const out: { offset: number; gain: number; order: number }[] = [];
  const most = Math.ceil(reach / (2 * size)) + 1;
  for (let m = -most; m <= most; m++) {
    const n = Math.abs(m);
    out.push({ offset: 2 * m * size, gain: low ** n * high ** n, order: 2 * n });
    const [lows, highs] = m >= 1 ? [m - 1, m] : [n + 1, n];
    out.push({ offset: 2 * m * size - 2 * at, gain: low ** lows * high ** highs, order: lows + highs });
  }
  return out.filter((i) => i.gain > 0 && Math.abs(i.offset) <= reach);
}
