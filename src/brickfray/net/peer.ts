import type { DataConnection, Peer as PeerType, PeerOptions } from 'peerjs';
import type { Channel } from './channel';
import { netConditions } from './channel';

const PREFIX = import.meta.env.DEV ? 'bfxdev2-' : 'bfx2-';
export const PUBLIC_SLOTS = 12;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FAST_CHANNEL_ID = 9;

export const publicPeerId = (slot: number) => `${PREFIX}pub-${slot}`;
export const privatePeerId = (code: string) => `${PREFIX}${code.toUpperCase()}`;

export function randomCode(length = 5) {
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

async function peerOptions(): Promise<PeerOptions> {
  const { util } = await import('peerjs');
  return {
    debug: 0,
    config: { iceServers: [...util.defaultConfig.iceServers, { urls: 'stun:stun.cloudflare.com:3478' }] }
  };
}

export type PeerFailure = 'taken' | 'network' | 'unavailable' | 'unsupported';

/** Open a Peer under `id` (or a random one); rejects with a PeerFailure. */
export async function openPeer(id?: string): Promise<PeerType> {
  const { Peer } = await import('peerjs');
  const options = await peerOptions();
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, options) : new Peer(options);
    const fail = (err: { type?: string }) => {
      peer.destroy();
      reject(err.type === 'unavailable-id' ? 'taken' : err.type === 'browser-incompatible' ? 'unsupported' : 'network');
    };
    peer.once('open', () => {
      peer.off('error', fail);
      resolve(peer);
    });
    peer.once('error', fail);
  });
}

/** Connect to a host peer and wrap the link; rejects with 'unavailable' if nobody is there. */
export function connectTo(peer: PeerType, hostId: string, timeoutMs = 8000): Promise<Channel> {
  return new Promise((resolve, reject) => {
    const conn = peer.connect(hostId, { reliable: true, serialization: 'json' });
    const timer = setTimeout(() => {
      cleanup();
      conn.close();
      reject('unavailable' satisfies PeerFailure);
    }, timeoutMs);
    const onError = (err: { type?: string }) => {
      if (err.type === 'peer-unavailable' && String((err as Error).message ?? '').endsWith(hostId)) {
        cleanup();
        reject('unavailable' satisfies PeerFailure);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      peer.off('error', onError);
    };
    peer.on('error', onError);
    conn.once('open', () => {
      cleanup();
      resolve(wrapConnection(conn));
    });
    conn.once('error', () => {
      cleanup();
      reject('network' satisfies PeerFailure);
    });
  });
}

/**
 * PeerJS gives one ordered reliable channel. Snapshots and inputs want a lossy,
 * unordered lane, so both sides add a pre-negotiated RTCDataChannel on the same
 * RTCPeerConnection; until it opens, binary rides the reliable channel.
 */
export function wrapConnection(conn: DataConnection): Channel {
  let fast: RTCDataChannel | null = null;
  try {
    fast = conn.peerConnection.createDataChannel('fast', { negotiated: true, id: FAST_CHANNEL_ID, ordered: false, maxRetransmits: 0 });
    fast.binaryType = 'arraybuffer';
  } catch {
    fast = null;
  }
  const channel: Channel = {
    onReliable: null,
    onFast: null,
    onClose: null,
    sendReliable(message) {
      later(() => conn.open && conn.send(message), false);
    },
    sendFast(data) {
      later(() => {
        if (fast?.readyState === 'open') {
          if (fast.bufferedAmount < 256 * 1024) fast.send(data);
        } else if (conn.open) {
          conn.send({ t: '#', d: Array.from(new Uint8Array(data)) });
        }
      }, true);
    },
    close() {
      conn.close();
    }
  };
  if (fast) fast.onmessage = (e) => channel.onFast?.(e.data as ArrayBuffer);
  conn.on('data', (data) => {
    const message = data as { t?: string; d?: number[] };
    if (message?.t === '#' && Array.isArray(message.d)) channel.onFast?.(new Uint8Array(message.d).buffer);
    else channel.onReliable?.(data);
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    channel.onClose?.();
  };
  conn.on('close', close);
  conn.on('error', close);
  conn.peerConnection?.addEventListener('connectionstatechange', () => {
    const state = conn.peerConnection?.connectionState;
    if (state === 'failed' || state === 'closed') close();
  });
  return channel;
}

/** Simulated latency/loss also applies to real links when the dev panel sets it. */
function later(fn: () => void, lossy: boolean) {
  const { latency, jitter, loss } = netConditions;
  if (latency === 0 && jitter === 0 && loss === 0) return fn();
  if (lossy && Math.random() < loss) return;
  setTimeout(fn, latency / 2 + (lossy ? Math.random() * jitter : 0));
}
