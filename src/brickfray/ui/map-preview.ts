import type { MapId } from '../world/types';

/** Each map's palette as a sky-to-ground gradient: what a lobby map card shows until its picture has loaded. */
const PALETTE: Record<MapId, string> = {
  plaza:
    'radial-gradient(circle at 78% 22%, #fff6c9 0 9%, transparent 10%), linear-gradient(180deg, #6fb7ff 0%, #bfe3ff 46%, #e9524a 46% 58%, #ffd34d 58% 66%, #3a86ff 66% 72%, #48b05a 72% 100%)',
  fortress:
    'radial-gradient(circle at 22% 24%, #ffe7b0 0 9%, transparent 10%), linear-gradient(180deg, #7fb0e8 0%, #f2d3a2 44%, #8f8a80 44% 70%, #6b665e 70% 74%, #3b8ad1 74% 82%, #4d9a46 82% 100%)',
  docks:
    'radial-gradient(circle at 70% 52%, #ffd08a 0 10%, transparent 11%), linear-gradient(180deg, #ff9e6b 0%, #ffcf8a 50%, #e85d3a 50% 60%, #2f6fd0 60% 66%, #1f8a8a 66% 70%, #1d4d7a 70% 100%)',
  temple:
    'radial-gradient(circle at 72% 20%, #fff3c4 0 8%, transparent 9%), linear-gradient(180deg, #4f9ad6 0%, #cfe6d0 42%, #2f7a48 42% 52%, #8fa394 52% 70%, #e0b040 70% 74%, #5c9a3e 74% 100%)'
};

/** Lobby map cards: a view of the map itself (public/maps, captured by the harness), with a shade under the name. */
export const mapPreview = (map: MapId) => `linear-gradient(180deg, transparent 55%, rgba(8, 12, 24, 0.7) 100%), url(/maps/${map}.jpg) center / cover, ${PALETTE[map]}`;
