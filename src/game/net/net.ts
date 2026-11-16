// Peer-to-peer networking over WebRTC, using the public PeerJS signalling service.
// Nothing runs on a server of ours: the host player's browser is the authority, every other
// player connects straight to it. That is what lets multiplayer work from a static Vercel deploy.
//
// Lobby codes are just peer ids. A private lobby takes a random 5 letter code; a public lobby
// claims one of a handful of well-known ids (PUB0..PUB7) so quick play can find it by knocking on
// every slot at once - a directory with no directory server. A connection only counts once the
// host has answered with a welcome, so a full or closed lobby can be skipped for the next one.

import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { DamageSource } from '../context';
import type { PlayerSnapshot } from '../entities/remote-player';
import { t } from '../core/i18n';

// a local dev server gets its own namespace so testing can never wander into a live lobby
const LOCAL = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const PREFIX = LOCAL ? 'doodledev-' : 'doodledistrict-';
const PUBLIC_SLOTS = 16;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A random 5 letter private lobby code. */
export const makeCode = (): string =>
  Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

const PEER_OPTS: PeerOptions = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};
const JOIN_TIMEOUT = 14000;
const QUICK_TIMEOUT = 11000;
const SIGNAL_TIMEOUT = 12000;

type Timer = ReturnType<typeof setTimeout>;

// ---- message protocol ----

/** A row of the FFA scoreboard as sent over the wire. */
export interface ScoreRow {
  id: string;
  name: string;
  kills: number;
  deaths: number;
}

/** What a host tells a knocking peer when it lets it in (or, for a probe, would let it in). */
export interface WelcomeInfo {
  hostId: string | null;
  code: string | null;
  isPublic: boolean;
  players: number;
  max: number;
  inMatch: boolean;
  hostName: string;
  map?: string;
}

/** What a full or closed host answers instead of a welcome. */
export interface RefusedInfo {
  reason: string;
  code: string | null;
  players: number;
  max: number;
  inMatch: boolean;
  hostName: string;
  map?: string;
}

/** Connection metadata a joining peer introduces itself with. */
export interface PeerMeta {
  name?: string;
  /** The id this player had before a host transfer, so the host can carry its score over. */
  prev?: string | null;
  /** Set by quick play / lobby listing: only seat this peer once it sends `stay`. */
  probe?: boolean;
}

/** One public lobby as seen by {@link Net.listLobbies}. */
export interface LobbyInfo {
  id: string;
  code: string;
  players: number;
  max: number;
  inMatch: boolean;
  hostName: string;
  full: boolean;
  map?: string;
}

type EmptyPayload = Record<string, never>;
/** A Vector3 sent as `[x, y, z]`. */
type Vec3Array = number[];

/** Payload (`d`) of every message type, keyed by the message's `t`. */
export interface NetPayloads {
  // connection handshake (handled inside Net, except `refused` which the game also listens to)
  welcome: WelcomeInfo;
  refused: RefusedInfo;
  stay: undefined;
  leave: { id: string };
  kick: { reason: string };
  // lobby / match flow
  lobby: {
    players: { id: string; name: string }[];
    hostId: string | null;
    isPublic: boolean;
    map: string;
    shown: string | null;
  };
  start: {
    late?: boolean;
    spawn?: number;
    spawns?: Record<string, number>;
    map?: string;
    broken?: number[];
  };
  end: { id: string | null; name: string };
  backtolobby: EmptyPayload;
  clock: { left: number; on: boolean };
  score: ScoreRow[];
  feed: { text: string };
  fell: EmptyPayload;
  // gameplay
  /** Packed local player state (see `encodeLocal`). */
  /** A player's pose, see entities/remote-player encodeLocal(). */
  ps: PlayerSnapshot;
  shots: { k: string; e: number[] };
  nade: { pos: Vec3Array; vel: Vec3Array };
  pdmg: { amount: number; from: Vec3Array | null; by: string | null; crit?: boolean; src?: DamageSource };
  pdead: { killer: string | null; dir: Vec3Array | null; over: boolean; how: string | null; crit: boolean };
  parry: { ret: boolean; by: string | null };
  cut: EmptyPayload;
  brk: { id: number };
  pickup: { id: number; kind: string; pos: Vec3Array };
  take: { id: number };
  taken: { id: number };
}

export type NetMessageType = keyof NetPayloads;

/**
 * The wire envelope. `from` is stamped by the sender (or by the host when relaying), `to`
 * addresses one client through the host, `relay` asks the host to pass a client message on.
 */
export type NetEnvelope = {
  [K in NetMessageType]: {
    t: K;
    d?: NetPayloads[K];
    from?: string | null;
    to?: string;
    relay?: boolean;
  };
}[NetMessageType];

/** A handler for one message type; `from` is the peer id the message originated from. */
export type NetHandler<K extends NetMessageType> = (data: NetPayloads[K], from: string) => void;
/** Handlers as stored: wire data is trusted to match its `t`, exactly as the game always has. */
type WireHandler = (data: unknown, from: string) => void;

/** Anything that is a non-null object is treated as an envelope (the original trust model). */
const isEnvelope = (msg: unknown): msg is NetEnvelope => !!msg && typeof msg === 'object';

/** PeerJS error type (`'unavailable-id'`, `'peer-unavailable'`, ...) if the value carries one. */
const errorType = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string' ? err.type : undefined;

const idFromError = (err: { message?: string } | null | undefined): string | null => {
  const m = /peer\s+(\S+)/.exec(String((err && err.message) || ''));
  return m ? m[1] : null;
};

const closeQuietly = (closable: { close(): void } | null | undefined): void => {
  try {
    closable?.close();
  } catch {
    /* ignore */
  }
};

interface Attempt {
  conn: DataConnection;
  hostId: string;
  done: boolean;
}

interface Offer {
  conn: DataConnection;
  hostId: string;
  welcome: WelcomeInfo | undefined;
}

/** Ids of every public slot, including the generation codes a slot moves to after a host change. */
const publicIds = (): string[] => {
  const ids: string[] = [];
  for (let i = 0; i < PUBLIC_SLOTS; i++) {
    for (const suf of ['', '-1', '-2', '-3']) ids.push(PREFIX + 'PUB' + i + suf);
  }
  return ids;
};

/** Lobby hosting/joining and message passing between the host and its clients. */
export class Net {
  peer: Peer | null = null;
  readonly conns = new Map<string, DataConnection>();
  isHost = false;
  id: string | null = null;
  code: string | null = null;
  hostId: string | null = null;
  connected = false;
  onPeerJoin: ((pid: string, meta: PeerMeta) => void) | null = null;
  onPeerLeave: ((pid: string) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  /** Host only: called once the original lobby code has been re-claimed as an alias. */
  onAlias: ((code: string) => void) | null = null;
  maxPlayers = 10;
  accepting = true;
  hostName = '';
  map = 'district';
  /** Host only: whether a match is running, reported to anyone knocking. Set by the game. */
  inMatch = false;
  readonly stats = { sent: 0, recv: 0 };
  isPublic = false;
  /** Second peer listening on the original lobby code after a host transfer. */
  alias: Peer | null = null;
  aliasCode: string | null = null;

  private readonly handlers = new Map<string, WireHandler>();
  private leaving = false;
  private aliasTimer: Timer | undefined = undefined;
  private connection = new AbortController();

  get active(): boolean {
    return !!this.peer && this.connected;
  }

  get peerIds(): string[] {
    return [...this.conns.keys()];
  }

  /** Register the (single) handler for a message type, replacing any previous one. */
  on<K extends NetMessageType>(type: K, fn: NetHandler<K>): void {
    // The one trust boundary: incoming data is assumed to match the payload of its type.
    this.handlers.set(type, fn as WireHandler);
  }

  private emit(type: string, data: unknown, from: string): void {
    const h = this.handlers.get(type);
    if (h) h(data, from);
  }

  private newPeer(id: string | null, signal = this.connection.signal): Promise<Peer> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      // no id: the signalling server assigns one
      const peer = id === null ? new Peer(PEER_OPTS) : new Peer(id, PEER_OPTS);
      let settled = false;
      const abort = (): void => {
        const pending = !settled;
        settled = true;
        clearTimeout(timer);
        peer.destroy();
        if (pending) reject(signal.reason);
      };
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          signal.removeEventListener('abort', abort);
          peer.destroy();
          reject(new Error('signalling server timed out'));
        }
      }, SIGNAL_TIMEOUT);
      signal.addEventListener('abort', abort, { once: true });
      peer.on('open', () => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        clearTimeout(timer);
        resolve(peer);
      });
      peer.on('error', (err) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        clearTimeout(timer);
        peer.destroy();
        reject(err);
      });
    });
  }

  private wire(conn: DataConnection): void {
    conn.on('data', (msg) => {
      if (this.conns.get(conn.peer) !== conn) return;
      this.stats.recv++;
      if (!isEnvelope(msg)) return;
      this.route(msg, conn.peer);
    });
    const drop = (): void => {
      if (this.conns.get(conn.peer) === conn) this.drop(conn.peer);
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  private drop(pid: string): void {
    if (this.leaving || !this.conns.has(pid)) return;
    this.conns.delete(pid);
    if (this.isHost) {
      if (this.onPeerLeave) this.onPeerLeave(pid);
      this.broadcast('leave', { id: pid });
    } else if (pid === this.hostId) {
      this.connected = false;
      if (this.onDisconnect) this.onDisconnect();
    }
  }

  private route(msg: NetEnvelope, from: string): void {
    // clients can address each other; the host forwards those
    if (this.isHost && msg.to && msg.to !== this.id) {
      const c = this.conns.get(msg.to);
      if (c && c.open) c.send(msg);
      return;
    }
    if (this.isHost && msg.relay) {
      for (const [pid, c] of this.conns) {
        if (pid !== from && c.open) c.send({ t: msg.t, d: msg.d, from });
      }
    }
    this.emit(msg.t, msg.d, msg.from || from);
  }

  private keepAlive(peer: Peer): void {
    peer.on('disconnected', () => {
      if (this.peer === peer && !peer.destroyed) {
        try {
          peer.reconnect();
        } catch {
          /* ignore */
        }
      }
    });
  }

  /** The connection to the host (clients only). */
  private hostConn(): DataConnection | undefined {
    return this.hostId === null ? undefined : this.conns.get(this.hostId);
  }

  // ---- lobby creation / joining ----

  /** Open a lobby. Returns its code. */
  async host({ isPublic = false, code = null }: { isPublic?: boolean; code?: string | null } = {}): Promise<string | null> {
    this.leave();
    const signal = this.connection.signal;
    let opened: Peer | null = null;
    let openedCode = code ? String(code).toUpperCase() : null;
    this.isHost = true;
    this.isPublic = isPublic;
    if (code) {
      opened = await this.newPeer(PREFIX + openedCode, signal);
    } else if (isPublic) {
      for (let slot = 0; slot < PUBLIC_SLOTS; slot++) {
        try {
          opened = await this.newPeer(PREFIX + 'PUB' + slot, signal);
          openedCode = 'PUB' + slot;
          break;
        } catch (e) {
          if (errorType(e) !== 'unavailable-id') throw e;
        }
      }
      if (!opened) throw new Error('all public lobbies are busy - host a private one');
    } else {
      for (let tries = 0; tries < 3 && !opened; tries++) {
        openedCode = makeCode();
        try {
          opened = await this.newPeer(PREFIX + openedCode, signal);
        } catch (e) {
          if (errorType(e) !== 'unavailable-id' || tries === 2) throw e;
        }
      }
    }
    if (signal.aborted) {
      opened?.destroy();
      signal.throwIfAborted();
    }
    const peer = opened;
    this.peer = peer;
    this.code = openedCode;
    // unreachable: every branch above either opened a peer or threw
    if (!peer) throw new Error('could not open a lobby');
    this.id = peer.id;
    this.hostId = this.id;
    this.connected = true;
    this.accepting = true;
    peer.on('connection', (conn) => {
      if (this.peer === peer) this.incoming(conn);
      else closeQuietly(conn);
    });
    this.keepAlive(peer);
    return this.code;
  }

  // someone knocking: a quick-play probe is told how full we are and only seated once it says it is staying
  private incoming(conn: DataConnection): void {
    const signal = this.connection.signal;
    conn.on('open', () => {
      if (signal.aborted) { closeQuietly(conn); return; }
      // a full lobby still says who it is, so the lobby list can show it
      if (!this.accepting || this.conns.size >= this.maxPlayers - 1) {
        const refused: RefusedInfo = {
          reason: this.accepting ? 'that lobby is full' : 'that lobby is closed',
          code: this.aliasCode || this.code,
          players: this.conns.size + 1,
          max: this.maxPlayers,
          inMatch: !!this.inMatch,
          hostName: this.hostName,
          map: this.map,
        };
        conn.send({ t: 'refused', d: refused });
        setTimeout(() => closeQuietly(conn), 600);
        return;
      }
      const meta: PeerMeta | undefined = conn.metadata;
      const seat = (): void => {
        if (signal.aborted) { closeQuietly(conn); return; }
        if (this.conns.has(conn.peer)) return;
        this.conns.set(conn.peer, conn);
        this.wire(conn);
        if (this.onPeerJoin) this.onPeerJoin(conn.peer, meta || {});
      };
      const welcome: WelcomeInfo = {
        hostId: this.id,
        code: this.aliasCode || this.code,
        isPublic: this.isPublic,
        players: this.conns.size + 1,
        max: this.maxPlayers,
        inMatch: !!this.inMatch,
        hostName: this.hostName,
        map: this.map,
      };
      if (meta && meta.probe) {
        conn.send({ t: 'welcome', d: welcome, from: this.id });
        const onData = (msg: unknown): void => {
          if (isEnvelope(msg) && msg.t === 'stay') {
            conn.off('data', onData);
            seat();
          }
        };
        conn.on('data', onData);
      } else {
        conn.send({ t: 'welcome', d: welcome, from: this.id });
        seat();
      }
    });
  }

  // after a host transfer the lobby lives on a generation code; keep trying to open the original code
  // as a second front door so it stays the code people know
  claimAlias(code: string, tries = 20): void {
    if (!this.isHost || this.alias || this.aliasTimer) return;
    const signal = this.connection.signal;
    const attempt = async (): Promise<void> => {
      this.aliasTimer = undefined;
      if (signal.aborted || !this.isHost || this.alias) return;
      try {
        const peer = await this.newPeer(PREFIX + code, signal);
        if (signal.aborted || !this.isHost) {
          peer.destroy();
          return;
        }
        this.alias = peer;
        this.aliasCode = code;
        peer.on('connection', (conn) => {
          if (this.alias === peer) this.incoming(conn);
          else closeQuietly(conn);
        });
        if (this.onAlias) this.onAlias(code);
      } catch {
        if (!signal.aborted && --tries > 0) this.aliasTimer = setTimeout(attempt, 6000);
      }
    };
    this.aliasTimer = setTimeout(attempt, 1500);
  }

  /** Join a lobby by code. Returns the code the lobby reports. */
  async join(code: string | null | undefined, meta: PeerMeta = {}): Promise<string> {
    this.leave();
    const signal = this.connection.signal;
    this.isHost = false;
    code = String(code || '').trim().toUpperCase();
    if (!code) throw new Error('enter a lobby code');
    const peer = await this.newPeer(null, signal);
    if (signal.aborted) { peer.destroy(); signal.throwIfAborted(); }
    this.peer = peer;
    this.id = peer.id;
    this.keepAlive(peer);
    // a lobby that changed hosts lives on a generation code; the plain code still finds it
    const base = code.replace(/-\d+$/, '');
    const ids = [code, ...['-1', '-2', '-3'].map((suf) => base + suf).filter((c) => c !== code)].map((c) => PREFIX + c);
    let res: Offer;
    try {
      res = await this.knockAny(peer, ids, meta, JOIN_TIMEOUT, signal);
    } catch (e) {
      if (!signal.aborted) this.leave();
      throw e;
    }
    signal.throwIfAborted();
    const { hostId, conn, welcome } = res;
    this.adopt(hostId, conn, welcome);
    this.code = (welcome && welcome.code) || hostId.slice(PREFIX.length);
    return this.code;
  }

  // try every public slot at the same time and take the first host that says welcome
  async quickJoin(meta: PeerMeta = {}, onStatus: ((status: string) => void) | null = null): Promise<string> {
    this.leave();
    const signal = this.connection.signal;
    this.isHost = false;
    const peer = await this.newPeer(null, signal);
    if (signal.aborted) { peer.destroy(); signal.throwIfAborted(); }
    this.peer = peer;
    this.id = peer.id;
    this.keepAlive(peer);
    if (onStatus) onStatus(t('looking'));
    const ids = publicIds();
    const winner = await new Promise<Offer | null>((resolve) => {
      let pending = ids.length;
      let done = false;
      const attempts: Attempt[] = [];
      const offers: Offer[] = [];
      let gather: Timer | undefined = undefined;
      const pick = (): Offer | null => {
        if (!offers.length) return null;
        offers.sort((a, b) => ((b.welcome && b.welcome.players) || 0) - ((a.welcome && a.welcome.players) || 0));
        return offers[0];
      };
      const settle = (): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(gather);
        signal.removeEventListener('abort', settle);
        peer.off('error', onErr);
        const val = pick();
        for (const a of attempts) {
          if (!val || a.conn !== val.conn) closeQuietly(a.conn);
        }
        resolve(val);
      };
      const failOne = (a: Attempt): void => {
        if (a.done) return;
        a.done = true;
        pending--;
        if (pending <= 0) settle();
      };
      const onErr = (err: Error): void => {
        if (errorType(err) === 'peer-unavailable') {
          const a = attempts.find((x) => x.hostId === idFromError(err));
          if (a) failOne(a);
        }
      };
      peer.on('error', onErr);
      const timer = setTimeout(settle, QUICK_TIMEOUT);
      signal.addEventListener('abort', settle, { once: true });
      const probeMeta: PeerMeta = { ...meta, probe: true };
      for (const hostId of ids) {
        let conn: DataConnection;
        try {
          conn = peer.connect(hostId, { reliable: true, serialization: 'json', metadata: probeMeta });
        } catch {
          pending--;
          continue;
        }
        const a: Attempt = { conn, hostId, done: false };
        attempts.push(a);
        conn.on('data', (msg) => {
          if (!isEnvelope(msg) || a.done) return;
          if (msg.t === 'welcome') {
            a.done = true;
            pending--;
            offers.push({ conn, hostId, welcome: msg.d });
            if (onStatus) onStatus(t('foundLobbies', { count: offers.length }));
            if (pending <= 0) settle();
            else if (!gather) gather = setTimeout(settle, 1500);
          } else if (msg.t === 'refused') {
            failOne(a);
          }
        });
        conn.on('error', () => failOne(a));
        conn.on('close', () => failOne(a));
      }
      if (pending <= 0) settle();
    });
    signal.throwIfAborted();
    if (!winner) {
      this.leave();
      throw new Error('no open public lobbies');
    }
    winner.conn.send({ t: 'stay' });
    this.adopt(winner.hostId, winner.conn, winner.welcome);
    this.code = (winner.welcome && winner.welcome.code) || winner.hostId.slice(PREFIX.length);
    return this.code;
  }

  // a look at every public lobby: who is hosting, how full, whether a match is on. Nothing is joined.
  async listLobbies(meta: PeerMeta = {}, onStatus: ((status: string) => void) | null = null): Promise<LobbyInfo[]> {
    if (this.active) throw new Error('leave the lobby first');
    const signal = this.connection.signal;
    const peer = await this.newPeer(null, signal);
    if (signal.aborted) { peer.destroy(); signal.throwIfAborted(); }
    const ids = publicIds();
    const found = await new Promise<LobbyInfo[]>((resolve) => {
      let pending = ids.length;
      let done = false;
      const attempts: Attempt[] = [];
      const offers: LobbyInfo[] = [];
      let gather: Timer | undefined = undefined;
      const settle = (): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(gather);
        signal.removeEventListener('abort', settle);
        peer.off('error', onErr);
        for (const a of attempts) closeQuietly(a.conn);
        resolve(offers);
      };
      const failOne = (a: Attempt): void => {
        if (a.done) return;
        a.done = true;
        pending--;
        if (pending <= 0) settle();
      };
      const onErr = (err: Error): void => {
        if (errorType(err) === 'peer-unavailable') {
          const a = attempts.find((x) => x.hostId === idFromError(err));
          if (a) failOne(a);
        }
      };
      peer.on('error', onErr);
      const timer = setTimeout(settle, QUICK_TIMEOUT);
      signal.addEventListener('abort', settle, { once: true });
      const probeMeta: PeerMeta = { ...meta, probe: true };
      for (const hostId of ids) {
        let conn: DataConnection;
        try {
          conn = peer.connect(hostId, { reliable: true, serialization: 'json', metadata: probeMeta });
        } catch {
          pending--;
          continue;
        }
        const a: Attempt = { conn, hostId, done: false };
        attempts.push(a);
        conn.on('data', (msg) => {
          if (!isEnvelope(msg) || a.done) return;
          if (msg.t === 'welcome' || msg.t === 'refused') {
            a.done = true;
            pending--;
            const d: Partial<WelcomeInfo | RefusedInfo> = msg.d || {};
            offers.push({
              id: hostId.slice(PREFIX.length),
              code: d.code || hostId.slice(PREFIX.length),
              players: d.players || 0,
              max: d.max || 10,
              inMatch: !!d.inMatch,
              hostName: d.hostName || '',
              full: msg.t === 'refused',
              map: d.map,
            });
            if (onStatus) onStatus(t('foundCount', { count: offers.length }));
            if (pending <= 0) settle();
            else if (!gather) gather = setTimeout(settle, 2200);
          }
        });
        conn.on('error', () => failOne(a));
        conn.on('close', () => failOne(a));
      }
      if (pending <= 0) settle();
    });
    try {
      peer.destroy();
    } catch {
      /* ignore */
    }
    signal.throwIfAborted();
    // one lobby can answer on more than one id after a host change; keep the fuller answer per code
    const byCode = new Map<string, LobbyInfo>();
    for (const o of found) {
      const k = o.code.replace(/-\d+$/, '');
      const prev = byCode.get(k);
      if (!prev || o.players > prev.players) byCode.set(k, { ...o, code: k });
    }
    return [...byCode.values()].sort((a, b) => b.players - a.players);
  }

  // knock on several ids at once; the first welcome wins, a refusal or a missing lobby on every one fails
  private knockAny(peer: Peer, ids: string[], meta: PeerMeta, timeoutMs: number, signal: AbortSignal): Promise<Offer> {
    return new Promise((resolve, reject) => {
      let pending = ids.length;
      let done = false;
      let lastErr: Error | null = null;
      const attempts: Attempt[] = [];
      const finish = (err: Error | null, val?: Offer): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        peer.off('error', onErr);
        for (const a of attempts) {
          if (!val || a.conn !== val.conn) closeQuietly(a.conn);
        }
        if (val) resolve(val);
        else reject(err || new Error('no lobby with that code'));
      };
      const failOne = (a: Attempt, err: Error | null): void => {
        if (a.done) return;
        a.done = true;
        if (err && !/no lobby/.test(String(err.message))) lastErr = err;
        pending--;
        if (pending <= 0) finish(lastErr || new Error('no lobby with that code'));
      };
      const onErr = (err: Error): void => {
        if (errorType(err) === 'peer-unavailable') {
          const a = attempts.find((x) => x.hostId === idFromError(err));
          if (a) failOne(a, new Error('no lobby with that code'));
        }
      };
      peer.on('error', onErr);
      const timer = setTimeout(() => finish(new Error('no answer from that lobby')), timeoutMs);
      const abort = (): void => finish(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      for (const hostId of ids) {
        let conn: DataConnection;
        try {
          conn = peer.connect(hostId, { reliable: true, serialization: 'json', metadata: meta });
        } catch {
          pending--;
          continue;
        }
        const a: Attempt = { conn, hostId, done: false };
        attempts.push(a);
        conn.on('data', (msg) => {
          if (!isEnvelope(msg) || a.done) return;
          if (msg.t === 'welcome') {
            a.done = true;
            finish(null, { hostId, conn, welcome: msg.d });
          } else if (msg.t === 'refused') {
            failOne(a, new Error((msg.d && msg.d.reason) || 'the lobby turned you away'));
          }
        });
        conn.on('error', (e) => failOne(a, e instanceof Error ? e : new Error('could not connect')));
        conn.on('close', () => failOne(a, null));
      }
      if (pending <= 0) finish(lastErr || new Error('no lobby with that code'));
    });
  }

  private adopt(hostId: string, conn: DataConnection, welcome: WelcomeInfo | undefined): void {
    this.hostId = hostId;
    this.conns.set(hostId, conn);
    this.connected = true;
    this.isPublic = !!(welcome && welcome.isPublic);
    this.wire(conn);
  }

  /** Drop every connection and the peer itself. Safe to call at any time. */
  leave(): void {
    // closing our own connections must not look like other people leaving
    this.leaving = true;
    this.connection.abort();
    this.connection = new AbortController();
    clearTimeout(this.aliasTimer);
    this.aliasTimer = undefined;
    if (this.alias) {
      try {
        this.alias.destroy();
      } catch {
        /* ignore */
      }
    }
    this.alias = null;
    this.aliasCode = null;
    for (const c of this.conns.values()) closeQuietly(c);
    this.conns.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        /* ignore */
      }
    }
    this.peer = null;
    this.connected = false;
    this.isHost = false;
    this.id = null;
    this.code = null;
    this.hostId = null;
    this.leaving = false;
  }

  // ---- messaging ----

  // host: to everyone; client: to the host (and on to everyone if relay is set)
  send<K extends NetMessageType>(type: K, data: NetPayloads[K], relay = false): void {
    this.stats.sent++;
    if (this.isHost) {
      const m = { t: type, d: data, from: this.id };
      for (const c of this.conns.values()) {
        if (c.open) c.send(m);
      }
    } else {
      const c = this.hostConn();
      if (c && c.open) c.send({ t: type, d: data, relay });
    }
  }

  /** Send to everyone: the host sends directly, a client asks the host to relay. */
  broadcast<K extends NetMessageType>(type: K, data: NetPayloads[K]): void {
    this.send(type, data, true);
  }

  /** Send to one peer (through the host when we are a client). */
  sendTo<K extends NetMessageType>(pid: string, type: K, data: NetPayloads[K]): void {
    this.stats.sent++;
    if (this.isHost) {
      const c = this.conns.get(pid);
      if (c && c.open) c.send({ t: type, d: data, from: this.id });
    } else {
      const c = this.hostConn();
      if (c && c.open) c.send({ t: type, d: data, to: pid, from: this.id });
    }
  }
}
