import type { Peer as PeerType } from 'peerjs';
import type { CharacterId } from '../characters/types';
import { MATCH, TICK } from '../sim/constants';
import { Match } from '../sim/match';
import type { MatchSettings, ShotTrace } from '../sim/types';
import { cleanName, DEFAULT_NAME } from '../../lib/board/names';
import { MAPS } from '../world';
import type { Channel } from './channel';
import { loopbackPair } from './channel';
import { Reader } from './bytes';
import { decodeInput, encodeSnapshot, PACKET } from './codec';
import { privatePeerId, publicPeerId, PUBLIC_SLOTS, randomCode, openPeer, wrapConnection } from './peer';
import { PROTOCOL_VERSION, type Board, type ClientMessage, type HostMessage, type LobbyState, type RosterEntry } from './protocol';
import { startTicker } from './ticker';

interface Link {
  id: number;
  channel: Channel;
  name: string;
  character: CharacterId;
  token: string;
  host: boolean;
  playerId: number | null;
  budget: number;
  ping: number;
}

interface Away {
  playerId: number;
  until: number;
}

export type HostKind = 'solo' | 'private' | 'public';

/**
 * The host's side of a game: owns the lobby, the authoritative Match and every
 * client link (the host's own client included, over a loopback channel).
 */
export class HostSession {
  lobby: LobbyState;
  match: Match | null = null;
  onChange: (() => void) | null = null;
  private peer: PeerType | null = null;
  private links = new Map<number, Link>();
  private away = new Map<string, Away>();
  private nextLink = 1;
  private stopTicker: (() => void) | null = null;
  private tickCount = 0;
  private pendingTraces: ShotTrace[] = [];

  constructor(
    readonly kind: HostKind,
    hostName: string,
    settings: MatchSettings
  ) {
    this.lobby = { code: null, isPublic: kind === 'public', hostName, settings, players: [], phase: 'lobby', count: 0 };
  }

  /** Claim a peer id: a public slot, or a fresh private code. Solo needs no network. */
  async open(): Promise<void> {
    if (this.kind === 'solo') return;
    if (this.kind === 'public') {
      const order = [...Array(PUBLIC_SLOTS).keys()];
      for (const slot of order) {
        try {
          this.peer = await openPeer(publicPeerId(slot));
          break;
        } catch (e) {
          if (e !== 'taken') throw e;
        }
      }
      if (!this.peer) throw 'full';
    } else {
      for (let attempt = 0; attempt < 5 && !this.peer; attempt++) {
        const code = randomCode();
        try {
          this.peer = await openPeer(privatePeerId(code));
          this.lobby.code = code;
        } catch (e) {
          if (e !== 'taken') throw e;
        }
      }
      if (!this.peer) throw 'network';
    }
    this.peer.on('connection', (conn) => {
      conn.once('open', () => this.accept(wrapConnection(conn), false));
    });
    this.peer.on('disconnected', () => this.peer?.reconnect());
  }

  /** The channel the host's own game client talks through. */
  localChannel(): Channel {
    const [hostSide, clientSide] = loopbackPair();
    this.accept(hostSide, true);
    return clientSide;
  }

  private accept(channel: Channel, host: boolean) {
    const link: Link = { id: this.nextLink++, channel, name: '', character: 'rivet', token: '', host, playerId: null, budget: 10, ping: 0 };
    channel.onReliable = (m) => this.onMessage(link, m as ClientMessage);
    channel.onFast = (data) => this.onFast(link, data);
    channel.onClose = () => this.drop(link);
  }

  private send(link: Link, message: HostMessage) {
    link.channel.sendReliable(message);
  }

  private broadcast(message: HostMessage) {
    for (const link of this.links.values()) this.send(link, message);
  }

  private humanCount() {
    return this.links.size;
  }

  private onMessage(link: Link, m: ClientMessage) {
    switch (m.t) {
      case 'probe':
        this.send(link, { t: 'info', lobby: this.lobbyState() });
        setTimeout(() => link.channel.close(), 200);
        return;
      case 'hello': {
        if (m.v !== PROTOCOL_VERSION) return this.send(link, { t: 'refused', reason: 'version' });
        if (this.humanCount() >= MATCH.maxPlayers) return this.send(link, { t: 'refused', reason: 'full' });
        link.name = cleanName(m.name) ?? DEFAULT_NAME;
        link.character = m.character;
        link.token = String(m.token).slice(0, 64);
        this.links.set(link.id, link);
        this.send(link, { t: 'welcome', id: link.id, lobby: this.lobbyState() });
        if (this.match) this.joinMatch(link);
        this.changed();
        return;
      }
      case 'ping':
        link.ping = Math.round(Number(m.rtt) || 0);
        this.send(link, { t: 'pong', c: m.c, h: this.match?.time ?? 0 });
        return;
      case 'chat': {
        const text = String(m.text).slice(0, 120).trim();
        if (text && link.playerId !== null && this.match) this.match.sim.events.push({ type: 'chat', player: link.playerId, text });
        return;
      }
      case 'character':
        link.character = m.character;
        this.changed();
        return;
      case 'upgrade':
        // Only one of the cards this player was dealt is accepted, which also validates the id.
        if (link.playerId !== null) this.match?.pickUpgrade(link.playerId, m.id);
        return;
    }
  }

  private onFast(link: Link, data: ArrayBuffer) {
    if (!this.match || link.playerId === null) return;
    const r = new Reader(data);
    if (r.u8() !== PACKET.input) return;
    for (const cmd of decodeInput(r)) {
      // A token bucket refills one command per tick, so speed hacks can't run ahead.
      if (link.budget < 1) break;
      const player = this.match.sim.players.get(link.playerId);
      if (!player || cmd.seq <= player.lastSeq) continue;
      link.budget--;
      this.match.sim.applyCommand(link.playerId, cmd);
    }
  }

  private drop(link: Link) {
    if (!this.links.delete(link.id)) return;
    if (this.match && link.playerId !== null) {
      const player = this.match.sim.players.get(link.playerId);
      if (player) {
        player.alive = false;
        player.respawnAt = Infinity;
        this.away.set(link.token, { playerId: link.playerId, until: this.match.time + MATCH.reconnectGrace });
        this.match.sim.events.push({ type: 'leave', player: link.playerId, name: link.name });
      }
    }
    this.changed();
  }

  private joinMatch(link: Link) {
    const match = this.match!;
    const back = this.away.get(link.token);
    if (back && match.sim.players.has(back.playerId)) {
      this.away.delete(link.token);
      link.playerId = back.playerId;
      match.sim.spawn(match.sim.players.get(back.playerId)!);
    } else {
      link.playerId = match.addHuman(link.name, link.character).id;
      match.sim.events.push({ type: 'join', player: link.playerId, name: link.name });
    }
    this.send(link, { t: 'start', settings: match.settings, you: link.playerId, roster: this.roster(), time: match.time });
    this.broadcast({ t: 'roster', roster: this.roster() });
  }

  private paused = false;

  /** Solo only: nobody else is waiting, so the whole match can stop. */
  setPaused(paused: boolean) {
    if (this.kind === 'solo') this.paused = paused;
  }

  setSettings(settings: Partial<MatchSettings>) {
    this.lobby.settings = { ...this.lobby.settings, ...settings };
    this.changed();
  }

  start() {
    this.match = new Match(MAPS[this.lobby.settings.map].layout(), this.lobby.settings);
    for (const link of this.links.values()) link.playerId = this.match.addHuman(link.name, link.character).id;
    this.match.start();
    this.lobby.phase = 'playing';
    const roster = this.roster();
    for (const link of this.links.values()) {
      this.send(link, { t: 'start', settings: this.match.settings, you: link.playerId!, roster, time: this.match.time });
    }
    this.tickCount = 0;
    this.stopTicker?.();
    this.stopTicker = startTicker(TICK, () => this.step());
    this.changed();
  }

  private step() {
    const match = this.match;
    if (!match) return;
    this.tickCount++;
    // A paused solo match still sends snapshots, so the frozen view shows the spawn.
    if (!this.paused) {
      for (const link of this.links.values()) link.budget = Math.min(15, link.budget + 1);
      const before = match.sim.players.size;
      match.tick(TICK);
      const { events, traces } = match.sim.drain();
      this.pendingTraces.push(...traces);
      if (events.length) this.broadcast({ t: 'events', events });
      if (match.sim.players.size !== before || events.some((e) => e.type === 'join' || e.type === 'leave')) {
        this.broadcast({ t: 'roster', roster: this.roster() });
      }
    }
    if (this.tickCount % 2 === 0) {
      for (const link of this.links.values()) {
        const self = link.playerId !== null ? (match.sim.players.get(link.playerId) ?? null) : null;
        link.channel.sendFast(encodeSnapshot(match.time, self?.lastSeq ?? 0, self, match.sim.players.values(), match.sim.grenades, this.pendingTraces));
      }
      this.pendingTraces = [];
    }
    if (this.tickCount % 30 === 0) this.broadcast({ t: 'board', board: this.board() });
    for (const [token, away] of this.away) {
      if (match.time > away.until) {
        this.away.delete(token);
        match.remove(away.playerId);
      }
    }
    if (match.resultsOver) this.returnToLobby();
  }

  returnToLobby() {
    this.stopTicker?.();
    this.stopTicker = null;
    this.match = null;
    this.away.clear();
    this.lobby.phase = 'lobby';
    for (const link of this.links.values()) link.playerId = null;
    this.broadcast({ t: 'lobbyReturn' });
    this.changed();
  }

  private roster(): RosterEntry[] {
    if (!this.match) return [];
    return [...this.match.sim.players.values()].map((p) => ({ id: p.id, name: p.name, character: p.character, team: p.team, bot: p.bot }));
  }

  private board(): Board {
    const match = this.match!;
    const pings = new Map<number, number>();
    for (const link of this.links.values()) if (link.playerId !== null) pings.set(link.playerId, link.ping);
    return {
      match: { ...match.state, teamScore: [...match.state.teamScore] },
      rows: [...match.sim.players.values()].map((p) => ({ id: p.id, kills: p.kills, deaths: p.deaths, assists: p.assists, score: p.score, ping: pings.get(p.id) ?? 0 }))
    };
  }

  private lobbyState(): LobbyState {
    this.lobby.players = [...this.links.values()].map((l) => ({ id: l.id, name: l.name, character: l.character, host: l.host }));
    this.lobby.count = this.links.size;
    return { ...this.lobby, players: [...this.lobby.players] };
  }

  private changed() {
    if (this.lobby.phase === 'lobby') this.broadcast({ t: 'lobby', lobby: this.lobbyState() });
    else this.lobbyState();
    this.onChange?.();
  }

  close() {
    this.broadcast({ t: 'closing' });
    this.stopTicker?.();
    this.match = null;
    const peer = this.peer;
    this.peer = null;
    setTimeout(() => {
      for (const link of this.links.values()) link.channel.close();
      this.links.clear();
      peer?.destroy();
    }, 150);
  }
}
