import type { CharacterId } from '../characters/types';
import type { Command, GameEvent, MatchSettings } from '../sim/types';
import type { UpgradeId } from '../sim/upgrades';
import type { Channel } from './channel';
import { Reader } from './bytes';
import { decodeSnapshot, encodeInput, PACKET, type Snapshot } from './codec';
import { PROTOCOL_VERSION, type Board, type HostMessage, type LobbyState, type RosterEntry } from './protocol';

export type CloseReason = 'hostLeft' | 'full' | 'version' | 'network';

export interface ClientListener {
  lobby?(lobby: LobbyState): void;
  start?(settings: MatchSettings): void;
  events?(events: GameEvent[]): void;
  snapshot?(snapshot: Snapshot): void;
  roster?(): void;
  board?(board: Board): void;
  lobbyReturn?(): void;
  closed?(reason: CloseReason): void;
}

/** A game client's view of the host: lobby, roster, clock and the snapshot stream. */
export class ClientSession {
  linkId = 0;
  you = 0;
  lobby: LobbyState | null = null;
  settings: MatchSettings | null = null;
  roster = new Map<number, RosterEntry>();
  board: Board | null = null;
  snapshots: Snapshot[] = [];
  rtt = 0;
  closed: CloseReason | null = null;
  listener: ClientListener = {};
  private offset: number | null = null;
  private samples: { rtt: number; offset: number }[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly channel: Channel,
    name: string,
    character: CharacterId,
    token: string
  ) {
    channel.onReliable = (m) => this.onMessage(m as HostMessage);
    channel.onFast = (data) => this.onFast(data);
    channel.onClose = () => this.fail('hostLeft');
    channel.sendReliable({ t: 'hello', v: PROTOCOL_VERSION, name, character, token });
    this.pingTimer = setInterval(() => this.ping(), 1000);
    for (let i = 1; i <= 4; i++) setTimeout(() => this.ping(), i * 120);
  }

  /** Host-clock time now (seconds). */
  hostNow() {
    return performance.now() / 1000 + (this.offset ?? 0);
  }

  private ping() {
    if (!this.closed) this.channel.sendReliable({ t: 'ping', c: performance.now() / 1000, rtt: Math.round(this.rtt * 1000) });
  }

  private onMessage(m: HostMessage) {
    switch (m.t) {
      case 'welcome':
        this.linkId = m.id;
        this.lobby = m.lobby;
        this.listener.lobby?.(m.lobby);
        return;
      case 'refused':
        this.fail(m.reason === 'version' ? 'version' : m.reason === 'full' ? 'full' : 'network');
        return;
      case 'lobby':
        this.lobby = m.lobby;
        this.listener.lobby?.(m.lobby);
        return;
      case 'start':
        this.settings = m.settings;
        this.you = m.you;
        this.setRoster(m.roster);
        this.board = null;
        this.snapshots = [];
        this.samples = [];
        this.offset = m.time - performance.now() / 1000 + this.rtt / 2;
        this.listener.start?.(m.settings);
        this.ping();
        return;
      case 'roster':
        this.setRoster(m.roster);
        return;
      case 'events':
        this.listener.events?.(m.events);
        return;
      case 'board':
        this.board = m.board;
        this.listener.board?.(m.board);
        return;
      case 'pong': {
        const now = performance.now() / 1000;
        const rtt = Math.max(0, now - m.c);
        this.rtt = this.rtt ? this.rtt * 0.8 + rtt * 0.2 : rtt;
        if (m.h > 0) this.addClockSample(rtt, m.h + rtt / 2 - now);
        return;
      }
      case 'lobbyReturn':
        this.settings = null;
        this.roster.clear();
        this.snapshots = [];
        this.listener.lobbyReturn?.();
        return;
      case 'closing':
        this.fail('hostLeft');
        return;
      case 'info':
        return;
    }
  }

  /** After the host clock stood still (solo pause), forget old samples and measure again. */
  resyncClock() {
    this.samples = [];
    this.ping();
  }

  /** Trust the lowest-latency recent samples and slew toward them so time never jumps far. */
  private addClockSample(rtt: number, offset: number) {
    this.samples.push({ rtt, offset });
    if (this.samples.length > 10) this.samples.shift();
    const best = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, 3);
    const target = best.reduce((s, x) => s + x.offset, 0) / best.length;
    if (this.offset === null || Math.abs(target - this.offset) > 0.25) this.offset = target;
    else this.offset += (target - this.offset) * 0.3;
  }

  private setRoster(list: RosterEntry[]) {
    this.roster = new Map(list.map((r) => [r.id, r]));
    this.listener.roster?.();
  }

  private onFast(data: ArrayBuffer) {
    const r = new Reader(data);
    if (r.u8() !== PACKET.snapshot) return;
    const snapshot = decodeSnapshot(r);
    const list = this.snapshots;
    // Drop duplicates and out-of-order stragglers.
    if (list.length && snapshot.time <= list[list.length - 1]!.time) return;
    list.push(snapshot);
    while (list.length > 40) list.shift();
    this.listener.snapshot?.(snapshot);
  }

  sendCommands(commands: readonly Command[]) {
    this.channel.sendFast(encodeInput(commands));
  }

  chat(text: string) {
    this.channel.sendReliable({ t: 'chat', text });
  }

  setCharacter(character: CharacterId) {
    this.channel.sendReliable({ t: 'character', character });
  }

  pickUpgrade(id: UpgradeId) {
    this.channel.sendReliable({ t: 'upgrade', id });
  }

  private fail(reason: CloseReason) {
    if (this.closed) return;
    this.closed = reason;
    this.dispose();
    this.listener.closed?.(reason);
  }

  dispose() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.channel.onClose = null;
    this.channel.close();
  }
}
