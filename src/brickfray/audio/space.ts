import type { MapId } from '../world/types';
import { WORLD_IMPULSE, makeImpulse } from './impulse';
import { ROOMS, roomImpulse } from './rooms';

export { ROOMS, roomAt } from './rooms';

interface SpaceDef {
  /** Seconds between the dry sound and the first reflection. */
  predelay: number;
  /** Energy of the whole response relative to the other maps. */
  wet: number;
  /** Generated stand-in when the recording fails to load. */
  fallback: { t60: number; bright: [number, number] };
  /** Another map's recording to reuse (public/audio/space/<file>.mp3); the map's own by default. */
  file?: MapId;
}

/**
 * One impulse response per map, cut from real outdoor gunshot tails (public/audio/space, see CREDITS-ambience.md):
 * plaza is a short slap off nearby buildings, fortress a long dense stone courtyard, docks a late echo across
 * open water with a metal colour.
 */
export const SPACES: Record<MapId, SpaceDef> = {
  plaza: { predelay: 0.045, wet: 1, fallback: { t60: 0.75, bright: [9000, 2600] } },
  fortress: { predelay: 0.022, wet: 1.3, fallback: { t60: 1.65, bright: [11000, 1800] } },
  docks: { predelay: 0.12, wet: 0.5, fallback: { t60: 1.05, bright: [12000, 2400] } },
  temple: { file: 'fortress', predelay: 0.03, wet: 1.15, fallback: { t60: 1.5, bright: [10000, 1900] } }
};

/** The listener's room response (see rooms.ts), not normalised: its reflections and tail are set against the dry sound. */
export function roomSpace(ctx: BaseAudioContext, map: MapId, index = 0): AudioBuffer | null {
  const room = ROOMS[map][index];
  return room ? roomImpulse(ctx, room, 23 + index) : null;
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
  const file = def.file ?? map;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}audio/space/${file}.mp3`);
    if (!response.ok) throw new Error(`audio/space/${file}.mp3: HTTP ${response.status}`);
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
