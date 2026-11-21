import { K } from '../world/keep';
import { ARCADE, TOWER } from '../world/plaza-parts';
import { T } from '../world/temple-layout';
import { WH } from '../world/warehouse';
import type { MapId } from '../world/types';
import { mulberry32 } from './synth';

type Vec3 = [number, number, number];
/** One value per side of a box: [-x, +x, -y, +y, -z, +z]. */
type Sides = readonly [number, number, number, number, number, number];

export interface RoomDef {
  /** Where the room is, for `roomAt`. */
  min: Vec3;
  max: Vec3;
  /** Cross-fade depth in metres at each side: an opening fades the room in, a wall (0) does not. */
  fade: Sides;
  /** Inside dimensions in metres; the ear sits mid-floor, 1.6 m up. */
  size: Vec3;
  /** Pressure kept per bounce off each side (0: an opening). */
  walls: Sides;
  /** Level of the first reflections (impulse units at 1 m of path). */
  early: number;
  /** Seconds to -60 dB of the diffuse tail, and its energy. */
  t60: number;
  tail: number;
  /** Tail brightness: low-pass cutoff in Hz at the start and the end. */
  bright: [number, number];
  /** Share of the map's outdoor response that still reaches in through the openings. */
  outdoor: number;
  /** The outdoor ambience bed inside: its level and the cutoff the walls leave it. */
  bed: { gain: number; cutoff: number };
}

const OPEN = 1.2;
const EAR = 1.6;
const SPEED_OF_SOUND = 343;
/** Image sources are traced this far; the diffuse tail carries on from there. */
const EARLY_UNTIL = 0.11;

/** A temple room's twin on the other half of the map (the layout turns half a turn about the centre). */
function turned(r: RoomDef): RoomDef {
  const swap = (s: Sides): Sides => [s[1], s[0], s[2], s[3], s[5], s[4]];
  return { ...r, min: [-r.max[0], r.min[1], -r.max[2]], max: [-r.min[0], r.max[1], -r.min[2]], fade: swap(r.fade), walls: swap(r.walls) };
}

const SHRINE = T.shrine - 0.8;
const VAULT = T.roofTop - 0.48;
const TEMPLE_HALVES: RoomDef[] = [
  {
    min: [-20.8, -0.5, -17.6],
    max: [-5.6, T.roofTop, -11.2],
    fade: [OPEN, OPEN, 0, 0, OPEN, OPEN],
    size: [15.2, T.roofTop, 6.4],
    walls: [0.88, 0.88, 0.82, 0.9, 0.88, 0.88],
    early: 7,
    t60: 2,
    tail: 2.6,
    bright: [6000, 1600],
    outdoor: 0.2,
    bed: { gain: 0.3, cutoff: 1100 }
  },
  {
    min: [-4.8, -0.5, -T.row],
    max: [-2.4, VAULT, -T.shrine],
    fade: [0, 0, 0, 0, OPEN, OPEN],
    size: [2.4, VAULT, T.row - T.shrine],
    walls: [0.9, 0.9, 0.85, 0.92, 0, 0],
    early: 4,
    t60: 1.3,
    tail: 2.2,
    bright: [7500, 2200],
    outdoor: 0.45,
    bed: { gain: 0.5, cutoff: 2500 }
  },
  {
    min: [-1.6, -0.5, -17.6],
    max: [7.2, T.roofTop, -11.2],
    fade: [0, 0, 0, 0, OPEN, OPEN],
    size: [8.8, T.roofTop, 6.4],
    walls: [0.88, 0.88, 0.82, 0.9, 0.88, 0.88],
    early: 6.5,
    t60: 1.8,
    tail: 2.4,
    bright: [6500, 1700],
    outdoor: 0.25,
    bed: { gain: 0.35, cutoff: 1200 }
  },
  {
    min: [8.8, -0.5, -17.6],
    max: [17.6, T.high - T.slab, -11.2],
    fade: [0, 0, 0, 0, OPEN, OPEN],
    size: [8.8, T.high - T.slab, 6.4],
    walls: [0.86, 0.86, 0.82, 0.88, 0.86, 0.86],
    early: 6,
    t60: 1.3,
    tail: 2,
    bright: [7000, 2000],
    outdoor: 0.3,
    bed: { gain: 0.35, cutoff: 1400 }
  },
  {
    min: [-T.galleryOut + 0.8, -0.5, -T.row],
    max: [-T.galleryIn, VAULT, T.row],
    fade: [0, OPEN, 0, 0, OPEN, OPEN],
    size: [T.galleryOut - 0.8 - T.galleryIn, VAULT, 2 * T.row],
    walls: [0.92, 0.3, 0.85, 0.9, 0, 0],
    early: 5,
    t60: 1.1,
    tail: 1.9,
    bright: [7000, 2100],
    outdoor: 0.6,
    bed: { gain: 0.7, cutoff: 4500 }
  }
];

const TEMPLE_ROOMS: RoomDef[] = [
  {
    min: [-SHRINE, -0.5, -SHRINE],
    max: [SHRINE, T.high - T.slab, SHRINE],
    fade: [OPEN, OPEN, 0, 0, OPEN, OPEN],
    size: [2 * SHRINE, T.high - T.slab, 2 * SHRINE],
    walls: [0.84, 0.84, 0.82, 0.9, 0.84, 0.84],
    early: 6,
    t60: 1.7,
    tail: 2.4,
    bright: [6500, 1800],
    outdoor: 0.25,
    bed: { gain: 0.3, cutoff: 1200 }
  },
  ...TEMPLE_HALVES.flatMap((r) => [r, turned(r)])
];

/**
 * Enclosed spaces with their own response, the first of each map the one a fresh mixer starts with. Each is a box of
 * hard walls with its openings: the first reflections come from its real size (image sources), so the 2.4 m tower
 * passage flutters every ~7 ms, the keep's walls answer at ~28 ms and the warehouse's gable ends at ~85 ms. Every
 * room is louder in its first 50 ms than the open air and rings at least as long, and still hears the map's outdoor
 * response through its doors.
 */
export const ROOMS: Record<MapId, readonly RoomDef[]> = {
  docks: [
    {
      min: [WH.x0, -0.5, WH.z0],
      max: [WH.x1, WH.height, WH.z1],
      fade: [OPEN, OPEN, OPEN, OPEN, OPEN, OPEN],
      size: [WH.x1 - WH.x0, WH.height, WH.z1 - WH.z0],
      walls: [0.88, 0.88, 0.8, 0.9, 0.85, 0.8],
      early: 7.5,
      t60: 2,
      tail: 2.2,
      bright: [5000, 1600],
      outdoor: 0.3,
      bed: { gain: 0.4, cutoff: 1600 }
    }
  ],
  fortress: [
    {
      min: [-(K.half - K.wall), -0.5, -(K.half - K.wall)],
      max: [K.half - K.wall, K.roof - K.slab, K.half - K.wall],
      fade: [OPEN, OPEN, 0, 0, OPEN, OPEN],
      size: [2 * (K.half - K.wall), K.roof - K.slab, 2 * (K.half - K.wall)],
      walls: [0.86, 0.86, 0.82, 0.9, 0.86, 0.86],
      early: 6.5,
      t60: 2.2,
      tail: 2.8,
      bright: [6500, 1700],
      outdoor: 0.25,
      bed: { gain: 0.3, cutoff: 1200 }
    }
  ],
  plaza: [
    {
      min: [TOWER.x0, -0.5, -TOWER.tunnel],
      max: [TOWER.x1, TOWER.tunnelTop, TOWER.tunnel],
      fade: [OPEN, OPEN, 0, 0, 0, 0],
      size: [TOWER.x1 - TOWER.x0, TOWER.tunnelTop - 0.16, 2 * TOWER.tunnel],
      walls: [0, 0, 0.85, 0.92, 0.92, 0.92],
      early: 3,
      t60: 1.05,
      tail: 2.2,
      bright: [8000, 2400],
      outdoor: 0.55,
      bed: { gain: 0.6, cutoff: 3500 }
    },
    {
      min: [ARCADE.x0, -0.5, ARCADE.z0],
      max: [ARCADE.x1, ARCADE.deck - ARCADE.slab, ARCADE.z1],
      fade: [OPEN, 0, 0, 0, OPEN, OPEN],
      size: [ARCADE.x1 - ARCADE.x0, ARCADE.deck - ARCADE.slab, ARCADE.z1 - ARCADE.z0],
      walls: [0.25, 0.92, 0.85, 0.92, 0, 0],
      early: 5.5,
      t60: 1,
      tail: 1.9,
      bright: [7000, 2100],
      outdoor: 0.65,
      bed: { gain: 0.7, cutoff: 5000 }
    }
  ],
  temple: TEMPLE_ROOMS
};

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
