import { K } from '../world/keep';
import { ARCADE, TOWER } from '../world/plaza-parts';
import { WH } from '../world/warehouse';
import type { MapId } from '../world/types';
import { WORLD_IMPULSE, makeImpulse, type ImpulseOptions } from './impulse';

interface SpaceDef {
  /** Seconds between the dry sound and the first reflection. */
  predelay: number;
  /** Energy of the whole response relative to the other maps. */
  wet: number;
  /** Generated stand-in when the recording fails to load. */
  fallback: { t60: number; bright: [number, number] };
}

/**
 * One impulse response per map, cut from real outdoor gunshot tails (public/audio/space, see CREDITS-ambience.md):
 * plaza is a short slap off nearby buildings, fortress a long dense stone courtyard, docks a late echo across
 * open water with a metal colour.
 */
export const SPACES: Record<MapId, SpaceDef> = {
  plaza: { predelay: 0.045, wet: 1, fallback: { t60: 0.75, bright: [9000, 2600] } },
  fortress: { predelay: 0.022, wet: 1.3, fallback: { t60: 1.65, bright: [11000, 1800] } },
  docks: { predelay: 0.12, wet: 0.5, fallback: { t60: 1.05, bright: [12000, 2400] } }
};

interface RoomDef {
  min: [number, number, number];
  max: [number, number, number];
  /** Cross-fade depth in metres at each side [-x, +x, -y, +y, -z, +z]: an opening fades the room in, a wall (0) does not. */
  fade: readonly [number, number, number, number, number, number];
  /** Generated response: the space's first reflections, then a diffuse tail. */
  impulse: Omit<ImpulseOptions, 'seed' | 'gain'>;
  wet: number;
}

const OPEN = 1.2;

/**
 * Enclosed spaces with their own reverb, the first of each map the one a fresh mixer starts with. Docks: the
 * 29 x 14 x 7 m corrugated-metal warehouse (floor ~9 ms, roof and mezzanine 25-35 ms, long walls ~40 ms, gable ends
 * ~85 ms); its late tail stays ~4 dB over the open pier's after 300 ms. Fortress: the keep, a 9.6 x 9.6 x 4.3 m
 * stone hall with three doorways and a stair hole (wall flutter every ~28 ms, ceiling ~16 ms, Sabine about 1.7 s).
 * Plaza: the 8 m passage through the clock tower, 2.4 m wide and 2.7 m high, open at both ends (side walls a
 * flutter every ~7 ms, short tail), and the arcade under the terrace, open to the square on its colonnade side.
 */
export const ROOMS: Record<MapId, readonly RoomDef[]> = {
  docks: [
    {
      min: [WH.x0, -0.5, WH.z0],
      max: [WH.x1, WH.height, WH.z1],
      fade: [OPEN, OPEN, OPEN, OPEN, OPEN, OPEN],
      impulse: {
        seconds: 2.6,
        t60: 2,
        early: [
          [0.009, 0.35],
          [0.021, 0.22],
          [0.027, 0.21],
          [0.034, 0.18],
          [0.041, 0.2],
          [0.052, 0.13],
          [0.068, 0.1],
          [0.084, 0.11],
          [0.097, 0.07]
        ],
        bright: [5000, 1600]
      },
      wet: 2
    }
  ],
  fortress: [
    {
      min: [-(K.half - K.wall), -0.5, -(K.half - K.wall)],
      max: [K.half - K.wall, K.roof - K.slab, K.half - K.wall],
      fade: [OPEN, OPEN, 0, 0, OPEN, OPEN],
      impulse: {
        seconds: 2.4,
        t60: 1.7,
        early: [
          [0.007, 0.34],
          [0.012, 0.22],
          [0.016, 0.3],
          [0.024, 0.2],
          [0.028, 0.26],
          [0.035, 0.18],
          [0.042, 0.17],
          [0.056, 0.14],
          [0.063, 0.1],
          [0.084, 0.09],
          [0.112, 0.06]
        ],
        bright: [6500, 1700]
      },
      wet: 1.8
    }
  ],
  plaza: [
    {
      min: [TOWER.x0, -0.5, -TOWER.tunnel],
      max: [TOWER.x1, TOWER.tunnelTop, TOWER.tunnel],
      fade: [OPEN, OPEN, 0, 0, 0, 0],
      impulse: {
        seconds: 1.1,
        t60: 0.8,
        early: [
          [0.0045, 0.4],
          [0.007, 0.42],
          [0.0105, 0.3],
          [0.014, 0.34],
          [0.0175, 0.22],
          [0.021, 0.24],
          [0.028, 0.18],
          [0.035, 0.14],
          [0.042, 0.11],
          [0.049, 0.08],
          [0.056, 0.06]
        ],
        bright: [8000, 2400]
      },
      wet: 1.5
    },
    {
      min: [ARCADE.x0, -0.5, ARCADE.z0],
      max: [ARCADE.x1, ARCADE.deck - ARCADE.slab, ARCADE.z1],
      fade: [OPEN, 0, 0, 0, OPEN, OPEN],
      impulse: {
        seconds: 1.1,
        t60: 0.75,
        early: [
          [0.006, 0.32],
          [0.0105, 0.38],
          [0.017, 0.3],
          [0.021, 0.2],
          [0.028, 0.18],
          [0.034, 0.12],
          [0.045, 0.1],
          [0.062, 0.06]
        ],
        bright: [7000, 2100]
      },
      wet: 1.2
    }
  ]
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

export function roomSpace(ctx: BaseAudioContext, map: MapId, index = 0): AudioBuffer | null {
  const room = ROOMS[map][index];
  return room ? shape(ctx, makeImpulse(ctx, { ...room.impulse, gain: 1, seed: 23 + index }), 0, room.wet) : null;
}

/**
 * The surfaces right around the player (ground, nearby walls): decorrelated left and right from the first
 * millisecond, gone by ~80 ms, so the player's own shot is wide before the map's reverb arrives.
 */
export function nearSpace(ctx: BaseAudioContext): AudioBuffer {
  const early: [number, number][] = [
    [0.0016, 0.5],
    [0.0031, 0.42],
    [0.0052, 0.36],
    [0.0076, 0.4],
    [0.0104, 0.28],
    [0.0139, 0.24],
    [0.0183, 0.18],
    [0.0236, 0.14],
    [0.031, 0.1]
  ];
  return shape(ctx, makeImpulse(ctx, { seconds: 0.12, t60: 0.09, early, bright: [9000, 4000], gain: 1, seed: 41 }), 0, 1);
}

/** Menus and the time before a map's response has loaded: short and neutral. */
export function neutralSpace(ctx: BaseAudioContext): AudioBuffer {
  return shape(ctx, makeImpulse(ctx, { ...WORLD_IMPULSE, seed: 3 }), 0, 0.6);
}

export async function loadSpace(ctx: BaseAudioContext, map: MapId): Promise<AudioBuffer> {
  const def = SPACES[map];
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}audio/space/${map}.mp3`);
    if (!response.ok) throw new Error(`audio/space/${map}.mp3: HTTP ${response.status}`);
    return shape(ctx, await ctx.decodeAudioData(await response.arrayBuffer()), def.predelay, def.wet);
  } catch (error) {
    console.error(`Space ${map} falls back to a generated impulse`, error);
    const { t60, bright } = def.fallback;
    return shape(ctx, makeImpulse(ctx, { seconds: t60 * 1.15, t60, early: [], bright, gain: 1, seed: 11 }), def.predelay, def.wet);
  }
}

/**
 * Drops the lead-in (encoder padding), delays the response by `predelay` and scales each channel to an energy of
 * `wet`², so a category's send level means the same tail level on every map. The convolver must not normalize.
 */
function shape(ctx: BaseAudioContext, source: AudioBuffer, predelay: number, wet: number): AudioBuffer {
  const channels = [0, 1].map((ch) => source.getChannelData(Math.min(ch, source.numberOfChannels - 1)));
  let peak = 0;
  for (const data of channels) for (const v of data) peak = Math.max(peak, Math.abs(v));
  let start = 0;
  while (start < source.length && channels.every((data) => Math.abs(data[start]!) < peak * 0.05)) start++;
  start = Math.max(0, Math.min(start, source.length - 1) - 32);
  const pad = Math.round(predelay * source.sampleRate);
  const out = ctx.createBuffer(2, pad + source.length - start, source.sampleRate);
  channels.forEach((data, ch) => {
    let energy = 0;
    for (let i = start; i < data.length; i++) energy += data[i]! * data[i]!;
    const gain = wet / Math.sqrt(energy || 1);
    const target = out.getChannelData(ch);
    for (let i = start; i < data.length; i++) target[pad + i - start] = data[i]! * gain;
  });
  return out;
}
