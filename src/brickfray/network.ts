import { Net, type PeerMeta } from "../game/net/net";
import type { Settings } from "./config";
import type { Body } from "./types";
import { packBody, validPacket, type Packet } from "./protocol";
export { packBody, unpackBody, validPacket, type Packet } from "./protocol";
export class Network {
  readonly net = new Net();
  token: string;
  onPacket: (p: Packet, from: string) => void = () => {};
  onJoin: (id: string, meta: PeerMeta) => void = () => {};
  onLeave: (id: string) => void = () => {};
  onDisconnect: () => void = () => {};
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private bases = new Map<
    string,
    { tick: number; rows: Record<string, number[]> }
  >();
  private rate = new Map<string, { at: number; n: number }>();
  private reliableDeadline = new Map<string, number>();
  generation = 0;
  constructor(private settings: Settings) {
    try {
      this.token =
        sessionStorage.getItem("brickfray.identity") || crypto.randomUUID();
      sessionStorage.setItem("brickfray.identity", this.token);
    } catch {
      this.token = crypto.randomUUID();
    }
    this.net.on("bf", (p, from) => {
      if (!validPacket(p)) return;
      const now = performance.now(),
        rate = this.rate.get(from);
      if (!rate || now - rate.at > 1000) this.rate.set(from, { at: now, n: 1 });
      else if (++rate.n > 220) return;
      this.onPacket(p, from);
    });
    this.net.onPeerJoin = (id, m) => this.onJoin(id, m);
    this.net.onPeerLeave = (id) => this.onLeave(id);
    this.net.onDisconnect = () => this.onDisconnect();
  }
  send(p: Packet, to?: string) {
    const game = [
        "input",
        "shot",
        "snapshot",
        "ping",
        "action",
        "event",
      ].includes(p.k),
      reliable = p.k === "action" || p.k === "shot" || p.k === "event";
    if (game && !reliable && Math.random() < this.settings.loss / 100) return;
    const gen = this.generation;
    const send = () => {
      if (gen !== this.generation) return;
      if (to) this.net.sendTo(to, "bf", p);
      else this.net.send("bf", p);
    };
    let delay = game
      ? Math.max(
          0,
          this.settings.latency +
            (Math.random() - 0.5) * this.settings.jitter * 2,
        )
      : 0;
    if (game && reliable) {
      // Match the ordered data channel: jitter can delay reliable messages but
      // must not send a shot before its preceding weapon switch or grenade cook.
      const at = performance.now(),
        key = to || "broadcast";
      const deadline = Math.max(
        at + delay,
        (this.reliableDeadline.get(key) || 0) + 0.01,
      );
      this.reliableDeadline.set(key, deadline);
      delay = deadline - at;
    }
    if (delay) {
      const t = setTimeout(() => {
        this.timers.delete(t);
        send();
      }, delay);
      this.timers.add(t);
    } else send();
  }
  snapshot(
    players: Body[],
    tick: number,
    time: number,
    left: number,
    score: number[],
  ) {
    const rows = Object.fromEntries(
      players.filter((b) => !b.bot).map((b) => [b.id, packBody(b)]),
    );
    for (const id of this.net.peerIds) {
      let base = this.bases.get(id);
      const full = !base || tick - base.tick >= 60;
      if (full) {
        base = { tick, rows };
        this.bases.set(id, base);
      }
      const delta: Record<string, number[]> = {};
      for (const [pid, row] of Object.entries(rows)) {
        const old = base!.rows[pid];
        if (full || !old) delta[pid] = [-1, ...row];
        else {
          const changes: number[] = [];
          row.forEach((v, i) => {
            if (v !== old[i]) changes.push(i, v);
          });
          if (changes.length) delta[pid] = changes;
        }
      }
      this.send(
        {
          k: "snapshot",
          tick,
          time,
          left,
          score,
          base: base!.tick,
          full,
          rows: delta,
          removed: Object.keys(base!.rows).filter((k) => !rows[k]),
        },
        id,
      );
    }
  }
  invalidate(id: string) {
    this.bases.delete(id);
  }
  close() {
    this.generation++;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.bases.clear();
    this.reliableDeadline.clear();
    this.rate.clear();
    this.net.leave();
  }
}
