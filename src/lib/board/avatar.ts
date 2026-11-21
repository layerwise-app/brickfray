import { eq } from 'drizzle-orm';
import { boardAvatar, boardProfile } from '~/db/schema';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, BoardError } from './contract';
import { inOrder, newId, type BoardDb } from './db';
import type { PlayerRef } from './players';

type AvatarType = (typeof AVATAR_TYPES)[number];

/** Width and height from the file's own header, or null when the bytes are not that format. */
export function imageSize(bytes: Uint8Array, type: AvatarType): [number, number] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at: number, text: string) => [...text].every((c, i) => bytes[at + i] === c.charCodeAt(0));
  if (type === 'image/png') {
    if (bytes.length < 24 || view.getUint32(0) !== 0x89504e47 || !ascii(12, 'IHDR')) return null;
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (type === 'image/webp') {
    if (bytes.length < 30 || !ascii(0, 'RIFF') || !ascii(8, 'WEBP')) return null;
    if (ascii(12, 'VP8 ')) return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
    if (ascii(12, 'VP8L')) {
      const b = view.getUint32(21, true);
      return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
    }
    if (ascii(12, 'VP8X')) {
      const w = bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16);
      const h = bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16);
      return [w + 1, h + 1];
    }
    return null;
  }
  // JPEG: walk the segments to the first start-of-frame.
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    const length = view.getUint16(at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [view.getUint16(at + 7), view.getUint16(at + 5)];
    }
    at += 2 + length;
  }
  return null;
}

/** Checks an uploaded picture: one of the accepted types, small, square-ish, its header matching its type. */
export function checkAvatar(type: string, bytes: Uint8Array): AvatarType {
  if (!AVATAR_TYPES.includes(type as AvatarType)) throw new BoardError('invalid', 'avatar type');
  if (bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) throw new BoardError('invalid', 'avatar size');
  const size = imageSize(bytes, type as AvatarType);
  if (!size) throw new BoardError('invalid', 'avatar header');
  const [w, h] = size;
  if (w < 16 || h < 16 || w > 256 || h > 256 || Math.abs(w - h) > 2) throw new BoardError('invalid', 'avatar dimensions');
  return type as AvatarType;
}

function base64(bytes: Uint8Array) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** Replaces the profile's picture; the old one is deleted so its URL stops resolving. */
export async function saveAvatar(db: BoardDb, player: PlayerRef, type: AvatarType, bytes: Uint8Array, now: number) {
  const id = newId();
  await inOrder(db, [
    db.delete(boardAvatar).where(eq(boardAvatar.profileId, player.profileId)),
    db.insert(boardAvatar).values({ id, profileId: player.profileId, mime: type, data: base64(bytes), createdAt: now }),
    db.update(boardProfile).set({ avatarImage: id, avatarHero: null, updatedAt: now }).where(eq(boardProfile.id, player.profileId))
  ]);
  return id;
}

export async function readAvatar(db: BoardDb, id: string) {
  const row = await db.select({ mime: boardAvatar.mime, data: boardAvatar.data }).from(boardAvatar).where(eq(boardAvatar.id, id)).get();
  if (!row) return null;
  return { mime: row.mime, bytes: Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0)) };
}
