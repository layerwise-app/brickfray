import type { BoardMode, MatchMinutes, SoloLevel } from './contract';
import { newId } from './db';

// A match ticket: the server's signed note that this player started this kind of match at this time. A report only
// counts with the ticket of its match, so a score cannot be older than its ticket, longer than the time since, or sent twice.

export interface Ticket {
  /** The match key: one stored match per ticket. */
  key: string;
  playerId: string;
  mode: BoardMode;
  map: string;
  difficulty: SoloLevel | null;
  /** Rooms: the time limit. Missing from tickets signed before it was kept. */
  minutes?: MatchMinutes | null;
  /** Server clock when the match was started (ms). */
  issuedAt: number;
}

const VERSION = 'v1';
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string) {
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function signingKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`brickfray:board-ticket:${secret}`));
  return crypto.subtle.importKey('raw', digest, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function issueTicket(secret: string, match: Omit<Ticket, 'key' | 'issuedAt'>, now: number) {
  const ticket: Ticket = { ...match, key: newId(), issuedAt: now };
  const body = toBase64Url(encoder.encode(JSON.stringify(ticket)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(`${VERSION}.${body}`));
  return { key: ticket.key, ticket: `${VERSION}.${body}.${toBase64Url(new Uint8Array(signature))}` };
}

/** The ticket's contents when this server signed it; null for anything else. */
export async function openTicket(secret: string, text: unknown): Promise<Ticket | null> {
  if (typeof text !== 'string' || text.length > 1000) return null;
  const [version, body, signature, extra] = text.split('.');
  if (version !== VERSION || !body || !signature || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await signingKey(secret), fromBase64Url(signature), encoder.encode(`${VERSION}.${body}`));
    return ok ? (JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Ticket) : null;
  } catch {
    return null;
  }
}
