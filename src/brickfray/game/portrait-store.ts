/**
 * Portrait shots kept between visits in the browser's Cache Storage, so a returning player's picker fills at once.
 * A stored shot belongs to one build of the game and one bake of the showroom extras (`version`) and one pixel width.
 */
const NAME = 'brickfray-portraits';

export type ShotKind = 'portrait' | 'bust';

/** FNV-1a over the text, as a short base-36 tag. */
export function versionTag(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** Where a shot is kept: a made-up address on this origin that is never fetched. */
const shotAddress = (version: string, id: string, kind: ShotKind, width: number) => `${location.origin}/__portraits/${version}/${id}-${kind}-${width}.png`;

/** The store, or null where the browser keeps none (an insecure origin, storage turned off): shots are then drawn every visit. */
export async function openShots(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(NAME);
  } catch {
    return null;
  }
}

export async function readShot(store: Cache, version: string, id: string, kind: ShotKind, width: number) {
  const hit = await store.match(shotAddress(version, id, kind, width));
  return hit ? hit.blob() : null;
}

export async function keepShot(store: Cache, version: string, id: string, kind: ShotKind, width: number, shot: Blob) {
  await store.put(shotAddress(version, id, kind, width), new Response(shot, { headers: { 'content-type': 'image/png' } }));
}

const printsAddress = (version: string) => `${location.origin}/__portraits/${version}/models.json`;

/** The fingerprints of the models each kept shot was drawn from, by character. */
export async function readPrints(store: Cache, version: string): Promise<Record<string, string>> {
  const hit = await store.match(printsAddress(version));
  return hit ? ((await hit.json()) as Record<string, string>) : {};
}

export async function keepPrints(store: Cache, version: string, prints: Record<string, string>) {
  await store.put(printsAddress(version), new Response(JSON.stringify(prints), { headers: { 'content-type': 'application/json' } }));
}

/** Drops the shots of every other build. Each width of this build's stays, for a window that changes size between visits. */
export async function pruneShots(store: Cache, version: string) {
  const kept = `${location.origin}/__portraits/${version}/`;
  for (const request of await store.keys()) if (!request.url.startsWith(kept)) await store.delete(request);
}

