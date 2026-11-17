import type { MapId } from '../world/types';

/** Lobby map cards: a sky-to-ground gradient with each map's palette. */
export const MAP_PREVIEW: Record<MapId, string> = {
  plaza:
    'radial-gradient(circle at 78% 22%, #fff6c9 0 9%, transparent 10%), linear-gradient(180deg, #6fb7ff 0%, #bfe3ff 46%, #e9524a 46% 58%, #ffd34d 58% 66%, #3a86ff 66% 72%, #48b05a 72% 100%)',
  fortress:
    'radial-gradient(circle at 22% 24%, #ffe7b0 0 9%, transparent 10%), linear-gradient(180deg, #7fb0e8 0%, #f2d3a2 44%, #8f8a80 44% 70%, #6b665e 70% 74%, #3b8ad1 74% 82%, #4d9a46 82% 100%)',
  docks:
    'radial-gradient(circle at 70% 52%, #ffd08a 0 10%, transparent 11%), linear-gradient(180deg, #ff9e6b 0%, #ffcf8a 50%, #e85d3a 50% 60%, #2f6fd0 60% 66%, #1f8a8a 66% 70%, #1d4d7a 70% 100%)'
};
