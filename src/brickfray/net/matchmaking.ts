import type { Peer as PeerType } from 'peerjs';
import type { Channel } from './channel';
import { connectTo, openPeer, privatePeerId, publicPeerId, PUBLIC_SLOTS } from './peer';
import { MATCH } from '../sim/constants';
import type { HostMessage, LobbyState } from './protocol';

export interface PublicLobby {
  slot: number;
  lobby: LobbyState;
}

let clientPeer: PeerType | null = null;

/** One reusable client peer for probing and joining. */
async function getClientPeer(): Promise<PeerType> {
  if (clientPeer && !clientPeer.destroyed && !clientPeer.disconnected) return clientPeer;
  clientPeer?.destroy();
  clientPeer = await openPeer();
  return clientPeer;
}

export function releaseClientPeer() {
  clientPeer?.destroy();
  clientPeer = null;
}

function probe(channel: Channel, timeoutMs: number): Promise<LobbyState | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      channel.close();
      resolve(null);
    }, timeoutMs);
    channel.onReliable = (m) => {
      const message = m as HostMessage;
      if (message.t !== 'info') return;
      clearTimeout(timer);
      channel.close();
      resolve(message.lobby);
    };
    channel.sendReliable({ t: 'probe' });
  });
}

const PROBE_BATCH = 4;

/**
 * Ask the public slots a few at a time: empty ones fail fast at the signaling
 * server, but a dozen simultaneous peer connections starve the one live host.
 */
export async function listPublicLobbies(): Promise<PublicLobby[]> {
  const peer = await getClientPeer();
  const found: PublicLobby[] = [];
  for (let start = 0; start < PUBLIC_SLOTS; start += PROBE_BATCH) {
    const batch = [...Array(Math.min(PROBE_BATCH, PUBLIC_SLOTS - start)).keys()].map((i) => start + i);
    const results = await Promise.all(
      batch.map(async (slot) => {
        try {
          const lobby = await probe(await connectTo(peer, publicPeerId(slot), 5000), 3000);
          return lobby ? { slot, lobby } : null;
        } catch {
          return null;
        }
      })
    );
    for (const r of results) if (r) found.push(r);
  }
  return found.sort((a, b) => b.lobby.count - a.lobby.count);
}

/** Best public game to drop into: most players that still has room. */
export function pickQuickMatch(lobbies: readonly PublicLobby[]): PublicLobby | null {
  return lobbies.filter((l) => l.lobby.count < MATCH.maxPlayers).sort((a, b) => b.lobby.count - a.lobby.count)[0] ?? null;
}

export async function joinPublic(slot: number): Promise<Channel> {
  // A fresh peer: reconnecting through the one that just probed this host stalls in PeerJS.
  releaseClientPeer();
  return connectTo(await getClientPeer(), publicPeerId(slot));
}

export async function joinPrivate(code: string): Promise<Channel> {
  return connectTo(await getClientPeer(), privatePeerId(code));
}
