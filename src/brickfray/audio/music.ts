import type { MusicTrack } from './types';

export interface TrackDef {
  /** public/audio/music/<file>, composed from recorded instruments (CREDITS-music.md). */
  file: string;
  /**
   * The repeating stretch, seconds into the decoded file: the music from `loop[0]` on repeats with period
   * `loop[1] - loop[0]`, and the file runs a few seconds past `loop[1]`, so a decoder's lead-in shifts both ends
   * alike and the seam stays inside the repeating music.
   */
  loop: readonly [number, number];
  /** Playback level against the menu theme (the files are levelled to the same loudness). */
  level: number;
}

/** Each map's own music while the match is fought: quiet, and kept under footsteps at 15 m. */
const PLAY_LEVEL = 0.08;

export const TRACKS: Record<MusicTrack, TrackDef> = {
  menu: { file: 'menu.mp3', loop: [7.89, 120.39], level: 1 },
  match: { file: 'warmup.mp3', loop: [2.085, 17.085], level: 0.55 },
  intermission: { file: 'intermission.mp3', loop: [3.125, 41.525], level: 0.6 },
  final: { file: 'final.mp3', loop: [1.805, 27.405], level: 0.42 },
  plaza: { file: 'map-plaza.mp3', loop: [3.269146, 40.192229], level: PLAY_LEVEL },
  fortress: { file: 'map-fortress.mp3', loop: [3.075833, 44.814979], level: PLAY_LEVEL },
  docks: { file: 'map-docks.mp3', loop: [2.722542, 35.826], level: PLAY_LEVEL },
  temple: { file: 'map-temple.mp3', loop: [4.000354, 49.714646], level: PLAY_LEVEL }
};

/** In-match tracks, fetched once the menu theme has loaded so each is ready when its state comes. */
export const MATCH_TRACKS: readonly MusicTrack[] = ['match', 'intermission', 'final'];

/** Fetches and decodes one track's file. */
export async function fetchTrack(ctx: BaseAudioContext, track: MusicTrack): Promise<AudioBuffer> {
  const file = `audio/music/${TRACKS[track].file}`;
  const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return ctx.decodeAudioData(await response.arrayBuffer());
}
