import {
  COLORS,
  DEFAULT_SETTINGS,
  RULES,
  WEAPONS,
  type Action,
  type MapId,
  type Mode,
  type Settings,
  type WeaponId,
} from "./config";
import { Controls } from "./input";
import { Sound } from "./audio";
import { Renderer } from "./render";
import {
  Simulation,
  bulletDirections,
  moveBody,
  rayPlayer,
} from "./simulation";
import { Network, unpackBody, type Packet } from "./network";
import { aimDir, eye, traceWorld } from "./world";
import {
  createBody,
  type Body,
  type Command,
  type Feed,
  type GameEvent,
  type HudState,
  type Room,
  type Shot,
  type V3,
} from "./types";
export type Screen = "home" | "lobby" | "playing" | "pause" | "results";
export interface Callbacks {
  hud: (h: HudState) => void;
  screen: (s: Screen) => void;
  room: (r: Room | null) => void;
  notice: (key: string) => void;
  chat: (name: string, text: string) => void;
}
const now = () => performance.now() / 1000;
export class BrickfrayGame {
  readonly renderer: Renderer;
  readonly input: Controls;
  readonly audio: Sound;
  readonly network: Network;
  sim: Simulation;
  settings: Settings;
  screen: Screen = "home";
  room: Room | null = null;
  localId = "local";
  name = "Builder";
  color = 0;
  accessory = 0;
  map: MapId = "plaza";
  mode: Mode = "solo";
  private laboratory = false;
  private connectionError = "";
  private connectionAttempt = 0;
  private frame = 0;
  private previous = now();
  private accumulator = 0;
  private uiAt = 0;
  private seq = 0;
  private tick = 0;
  private shotId = 0;
  private actionId = 0;
  private shotReady = 0;
  private trigger = false;
  private fireEdge = false;
  private pending: Command[] = [];
  private commands = new Map<string, Command[]>();
  private held = new Map<string, Command>();
  private inputAt = new Map<string, number>();
  private peerBodies = new Map<string, string>();
  private tokens = new Map<string, string>();
  private disconnected = new Map<string, number>();
  private actionSeq = new Map<string, number>();
  private cooldownChat = new Map<string, number>();
  private base: { id: number; rows: Record<string, number[]> } | null = null;
  private snapshotTick = -1;
  private samples: { time: number; players: Body[] }[] = [];
  private correction: V3 = [0, 0, 0];
  private clock = 0;
  private clockReceived = 0;
  private ping = 0;
  private pingAt = 0;
  private lastHostPacket = 0;
  private reconnecting = false;
  private feeds: Feed[] = [];
  private hitUntil = 0;
  private hitType: HudState["hit"] = "";
  private hitShot = -1;
  private damageFlash = 0;
  private damageAngle = 0;
  private damageText = "";
  private damageUntil = 0;
  private killer = "";
  private killerId = "";
  private deathAt = 0;
  private replay: { at: number; players: Body[] }[] = [];
  private cameraKick: V3 = [0, 0, 0];
  private recoilRecovery = 0;
  private yawRecovery = 0;
  private lastLocalFire = 0;
  private footsteps = 0;
  private wasGrounded = true;
  private breath = 0;
  private breathUsed = 0;
  private fps = 60;
  private predictedShots = new Map<number, WeaponId>();
  private remoteShotIds = new Map<string, number>();
  private actorSteps = new Map<
    string,
    { pos: V3; distance: number; grounded: boolean }
  >();
  private abort = new AbortController();
  private disposed = false;
  private backgroundClock: Worker;
  constructor(
    canvas: HTMLCanvasElement,
    settings: Settings,
    private cb: Callbacks,
  ) {
    this.settings = settings;
    this.renderer = new Renderer(canvas, settings);
    this.sim = new Simulation(this.renderer.arena);
    this.sim.add(this.localId, this.name);
    this.audio = new Sound(settings);
    this.renderer.onFragment = (p) => this.audio.fragment(p);
    this.input = new Controls(canvas, settings);
    this.network = new Network(settings);
    this.backgroundClock = new Worker(
      new URL("./clock.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.backgroundClock.onmessage = () => {
      if (!document.hidden || this.disposed) return;
      cancelAnimationFrame(this.frame);
      this.loop();
    };
    document.addEventListener(
      "visibilitychange",
      () => {
        this.backgroundClock.postMessage(document.hidden);
        this.audio.mix();
      },
      { signal: this.abort.signal },
    );
    this.backgroundClock.postMessage(document.hidden);
    this.input.onAction = (a, d) => this.action(a, d);
    this.input.onWheel = (d) =>
      this.switchWeapon(((this.self.weapon + d + 4) % 4) as WeaponId);
    this.input.onPause = () => {
      if (this.screen === "playing") this.pause();
    };
    this.input.onHint = (key) => cb.notice(key);
    this.network.onPacket = (p, from) => this.packet(p, from);
    this.network.onJoin = () => {};
    this.network.onLeave = (peer) => {
      const id = this.peerBodies.get(peer);
      if (id) this.disconnected.set(id, now() + 30);
      if (this.room && !this.room.started) {
        this.room.players = this.room.players.filter((p) => p.id !== id);
        if (id) this.sim.players.delete(id);
        this.broadcastRoom();
      }
    };
    this.network.onDisconnect = () => {
      if (this.room?.started) {
        this.cb.notice("reconnecting");
        void this.reconnect();
      } else {
        this.network.close();
        this.room = null;
        cb.room(null);
        this.setScreen("home");
        cb.notice("hostLeft");
      }
    };
    window.addEventListener(
      "pagehide",
      () => {
        if (this.network.net.isHost)
          this.network.send({ k: "ended", reason: "hostLeft" });
      },
      { signal: this.abort.signal },
    );
    this.frame = requestAnimationFrame(this.loop);
  }
  get self() {
    return (
      this.sim.players.get(this.localId) || [...this.sim.players.values()][0]
    );
  }
  private setScreen(s: Screen) {
    this.screen = s;
    this.input.active = s === "playing";
    if (s !== "playing") {
      this.trigger = false;
      this.fireEdge = false;
      this.input.reset();
      if (this.input.locked) document.exitPointerLock();
    }
    this.cb.screen(s);
  }
  setMap(map: MapId) {
    this.map = map;
    this.renderer.setMap(map);
    this.sim.arena = this.renderer.arena;
    if (this.room && this.network.net.isHost) {
      this.room.map = map;
      this.network.net.map = map;
      this.broadcastRoom();
    }
  }
  profile(name: string, color: number, accessory: number) {
    this.name = name.trim().slice(0, 14) || "Builder";
    this.color = color;
    this.accessory = accessory;
    if (this.self) {
      this.self.name = this.name;
      this.self.color = color;
      this.self.accessory = accessory;
    }
  }
  applySettings() {
    Object.assign(this.renderer.settings, this.settings);
    Object.assign(this.input["settings"], this.settings);
    this.renderer.resize();
    this.renderer.setMap(this.map);
    this.sim.arena = this.renderer.arena;
    this.audio.mix();
    try {
      localStorage.setItem("brickfray.settings", JSON.stringify(this.settings));
    } catch {}
  }
  solo() {
    this.network.close();
    this.room = null;
    this.cb.room(null);
    this.laboratory = false;
    this.mode = "solo";
    this.localId = "local";
    this.reset();
    this.sim.mode = "solo";
    this.audio.unlock();
    this.setScreen("playing");
    if (!this.laboratory) void this.input.lock();
  }
  private reset() {
    this.sim = new Simulation(this.renderer.arena);
    const b = this.sim.add(this.localId, this.name, this.color);
    b.accessory = this.accessory;
    this.seq = 0;
    this.tick = 0;
    this.shotId = 0;
    this.shotReady = 0;
    this.actionId = 0;
    this.pending = [];
    this.predictedShots.clear();
    this.remoteShotIds.clear();
    this.actorSteps.clear();
    this.base = null;
    this.snapshotTick = -1;
    this.samples = [];
    this.feeds = [];
    this.replay = [];
    this.held.clear();
    this.commands.clear();
    this.inputAt.clear();
    this.input.yaw = 0;
    this.input.pitch = 0;
    this.input.reset();
    this.correction = [0, 0, 0];
    this.accumulator = 0;
    this.cameraKick = [0, 0, 0];
    this.recoilRecovery = 0;
    this.killer = "";
    this.killerId = "";
    this.breathUsed = 0;
    this.breath = 0;
    this.damageFlash = 0;
  }
  pause() {
    if (this.screen !== "playing") return;
    if (this.mode === "solo" && this.self.cook >= 0) this.sim.throw(this.self);
    this.setScreen("pause");
  }
  resume() {
    this.audio.unlock();
    this.setScreen("playing");
    if (!this.laboratory) void this.input.lock();
  }
  leave() {
    this.connectionAttempt++;
    if (this.network.net.isHost)
      this.network.send({ k: "ended", reason: "hostLeft" });
    this.network.close();
    this.room = null;
    this.cb.room(null);
    this.localId = "local";
    this.mode = "solo";
    this.reset();
    this.setScreen("home");
  }
  async connect(kind: "quick" | "public" | "private" | "join", code = "") {
    this.audio.unlock();
    this.network.close();
    this.peerBodies.clear();
    this.tokens.clear();
    this.disconnected.clear();
    this.actionSeq.clear();
    const attempt = ++this.connectionAttempt;
    this.cb.notice("connecting");
    try {
      if (kind === "quick") {
        try {
          await this.network.net.quickJoin({ name: this.name });
        } catch {
          if (attempt !== this.connectionAttempt || this.disposed) return;
          await this.network.net.host({ isPublic: true });
        }
      } else if (kind === "join")
        await this.network.net.join(code, { name: this.name });
      else await this.network.net.host({ isPublic: kind === "public" });
      if (this.disposed || attempt !== this.connectionAttempt) return;
      if (this.network.net.isHost) {
        this.localId = this.network.net.id!;
        this.reset();
        this.mode = "ffa";
        this.room = {
          code: this.network.net.code!,
          host: this.localId,
          public: this.network.net.isPublic,
          map: this.map,
          mode: "ffa",
          minutes: 10,
          players: [
            {
              id: this.localId,
              name: this.name,
              color: this.color,
              accessory: this.accessory,
              team: 0,
            },
          ],
          started: false,
        };
        this.network.net.hostName = this.name;
        this.network.net.map = this.map;
        this.cb.room(this.room);
        this.setScreen("lobby");
      } else {
        this.lastHostPacket = now();
        this.network.send({
          k: "hello",
          token: this.network.token,
          name: this.name,
          color: this.color,
          accessory: this.accessory,
        });
        this.setScreen("lobby");
      }
      this.cb.notice("");
    } catch (e) {
      if (attempt !== this.connectionAttempt || this.disposed) return;
      this.network.close();
      this.setScreen("home");
      this.cb.notice("connectionFailed");
      this.connectionError = String(e);
      console.warn("Brickfray connection:", e);
    }
  }
  listLobbies() {
    return this.network.net.listLobbies();
  }
  updateRoom(mode: Mode, minutes: number) {
    if (!this.room || !this.network.net.isHost) return;
    this.room.mode = mode === "tdm" ? "tdm" : "ffa";
    this.room.minutes = Math.max(3, Math.min(20, minutes));
    this.broadcastRoom();
  }
  private broadcastRoom() {
    if (!this.room) return;
    this.cb.room({ ...this.room, players: [...this.room.players] });
    for (const peer of this.network.net.peerIds)
      this.network.send(
        { k: "room", room: this.room, self: this.peerBodies.get(peer) || peer },
        peer,
      );
  }
  startMatch() {
    if (!this.room || !this.network.net.isHost) return;
    this.room.started = true;
    this.network.net.inMatch = true;
    this.network.send({ k: "begin", room: this.room });
    this.begin(this.room);
  }
  private begin(room: Room) {
    this.room = room;
    this.setMap(room.map);
    this.mode = room.mode;
    this.reset();
    this.sim.mode = this.mode;
    this.sim.remaining = room.minutes * 60;
    for (const p of room.players) {
      const b =
        this.sim.players.get(p.id) || this.sim.add(p.id, p.name, p.color);
      Object.assign(b, {
        name: p.name,
        color: p.color,
        accessory: p.accessory,
        team: p.team,
      });
      b.pos = this.sim.arena.spawns[
        (room.players.indexOf(p) * 3) % this.sim.arena.spawns.length
      ].slice() as V3;
    }
    this.clock = 0;
    this.clockReceived = now();
    this.lastHostPacket = now();
    this.cb.room({ ...room });
    this.audio.unlock();
    this.setScreen("playing");
    if (!this.laboratory) void this.input.lock();
  }
  chat(text: string) {
    const message = text.trim().slice(0, 160);
    if (!message) return;
    if (this.mode === "solo") {
      this.cb.chat(this.name, message);
      return;
    }
    if (this.network.net.isHost) {
      this.cb.chat(this.name, message);
      this.network.send({ k: "chat", name: this.name, text: message });
    } else this.network.send({ k: "chat", text: message });
  }
  private async reconnect() {
    if (this.reconnecting || !this.room) return;
    this.reconnecting = true;
    const room = this.room,
      until = now() + 30;
    this.trigger = false;
    this.input.reset();
    while (!this.disposed && this.room === room && now() < until) {
      try {
        await this.network.net.join(room.code, {
          name: this.name,
          prev: this.network.token,
        });
        this.network.send({
          k: "hello",
          token: this.network.token,
          name: this.name,
          color: this.color,
          accessory: this.accessory,
        });
        this.lastHostPacket = now();
        this.cb.notice("reconnected");
        this.reconnecting = false;
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    this.reconnecting = false;
    if (this.room === room) {
      this.leave();
      this.cb.notice("hostLeft");
    }
  }
  private packet(p: Packet, from: string) {
    const host = this.network.net.isHost;
    if (!host) this.lastHostPacket = now();
    if (host) {
      const id = this.peerBodies.get(from),
        b = id ? this.sim.players.get(id) : undefined;
      if (p.k === "hello") {
        const existing = this.tokens.get(p.token),
          expires = existing ? this.disconnected.get(existing) : undefined;
        let body: Body | undefined;
        if (existing && expires && expires > now()) {
          body = this.sim.players.get(existing);
          this.disconnected.delete(existing);
          this.sim.reconnect(existing);
          this.commands.delete(existing);
          this.held.delete(existing);
          this.actionSeq.delete(existing);
        }
        if (!body) {
          if (!this.room || this.room.players.length >= 10) {
            this.network.send({ k: "ended", reason: "roomFull" }, from);
            return;
          }
          const used = this.room.players.map((b) => b.color);
          const color = used.includes(p.color)
            ? COLORS.findIndex((_, i) => !used.includes(i))
            : p.color;
          body = this.sim.add(from, p.name, color);
          body.accessory = p.accessory;
          this.room.players.push({
            id: body.id,
            name: body.name,
            color,
            accessory: p.accessory,
            team: body.team,
          });
          this.tokens.set(p.token, body.id);
          if (this.room.started) this.sim.respawn(body);
        }
        this.peerBodies.set(from, body.id);
        this.network.invalidate(from);
        this.broadcastRoom();
        if (this.room?.started)
          this.network.send({ k: "begin", room: this.room }, from);
        return;
      }
      if (p.k === "resync") {
        this.network.invalidate(from);
        return;
      }
      if (p.k === "ping") {
        if (b && Number.isFinite(p.rtt))
          b.ping = Math.min(3000, Math.max(0, Math.round(p.rtt!)));
        this.network.send(
          { k: "ping", sent: p.sent, time: this.sim.time },
          from,
        );
        return;
      }
      if (!b) return;
      if (p.k === "input") {
        const q = this.commands.get(b.id) || [];
        for (const c of p.commands) {
          if (
            c.seq <= b.ack ||
            q.some((x) => x.seq === c.seq) ||
            c.seq > b.ack + 180
          )
            continue;
          if (q.length < 90) q.push(c);
        }
        q.sort((a, b) => a.seq - b.seq);
        this.commands.set(b.id, q);
        this.inputAt.set(b.id, now());
      } else if (p.k === "shot") this.sim.fire(b, p.shot);
      else if (p.k === "action") {
        if (p.seq <= (this.actionSeq.get(b.id) || 0)) return;
        this.actionSeq.set(b.id, p.seq);
        this.authorityAction(b, p.action, p.value);
      } else if (p.k === "chat") {
        if (now() - (this.cooldownChat.get(b.id) || -10) < 0.7) return;
        this.cooldownChat.set(b.id, now());
        this.cb.chat(b.name, p.text);
        this.network.send({ k: "chat", name: b.name, text: p.text });
      }
      return;
    }
    if (p.k === "room") {
      this.localId = p.self;
      this.room = p.room;
      this.map = p.room.map;
      this.mode = p.room.mode;
      if (!p.room.started) this.setMap(p.room.map);
      this.cb.room({ ...p.room });
      this.setScreen(p.room.started ? this.screen : "lobby");
    } else if (p.k === "begin") {
      this.begin(p.room);
    } else if (p.k === "snapshot") this.receiveSnapshot(p);
    else if (p.k === "event") p.events.forEach((e) => this.event(e));
    else if (p.k === "ping" && p.time !== undefined) {
      this.ping = (now() - p.sent) * 1000;
      this.clock = p.time + this.ping / 2000;
      this.clockReceived = now();
    } else if (p.k === "chat") this.cb.chat(p.name || "Snapbot", p.text);
    else if (p.k === "ended") {
      if (p.reason === "hostLeft" || p.reason === "roomFull") {
        this.leave();
        this.cb.notice(p.reason);
      } else {
        this.setScreen("results");
        this.cb.notice("matchEnded");
      }
    }
  }
  private receiveSnapshot(p: Extract<Packet, { k: "snapshot" }>) {
    if (p.tick <= this.snapshotTick) return;
    if (p.full) {
      const rows: Record<string, number[]> = {};
      for (const [id, a] of Object.entries(p.rows)) {
        if (a[0] !== -1 || a.length !== 34) return;
        rows[id] = a.slice(1);
      }
      this.base = { id: p.base, rows };
    }
    if (!this.base || this.base.id !== p.base) {
      this.network.send({ k: "resync" });
      return;
    }
    this.snapshotTick = p.tick;
    const rows: Record<string, number[]> = Object.fromEntries(
      Object.entries(this.base.rows).map(([id, a]) => [id, [...a]]),
    );
    for (const [id, a] of Object.entries(p.rows)) {
      if (a[0] === -1) rows[id] = a.slice(1);
      else if (rows[id]) {
        for (let i = 0; i < a.length; i += 2)
          if (a[i] >= 0 && a[i] < 33) rows[id][a[i]] = a[i + 1];
      }
    }
    p.removed.forEach((id) => delete rows[id]);
    const bodies: Body[] = [];
    for (const [id, a] of Object.entries(rows)) {
      if (a.length !== 33) continue;
      const profile = this.room?.players.find((p) => p.id === id);
      const old =
        this.sim.players.get(id) ||
        createBody(id, profile?.name || "Snapbot", [0, 0, 0]);
      const b = unpackBody(a, old);
      bodies.push(b);
      if (id === this.localId) {
        for (const [id, w] of this.predictedShots) {
          if (id <= b.shotAck) this.predictedShots.delete(id);
          else b.mags[w] = Math.max(0, b.mags[w] - 1);
        }
        const before = this.self?.pos.slice() as V3 | undefined;
        this.pending = this.pending.filter((c) => c.seq > b.ack);
        for (const c of this.pending) moveBody(b, c, this.sim.arena);
        if (before && old.hp > 0 && b.hp > 0) {
          const error = before.map((n, i) => n - b.pos[i]) as V3;
          if (Math.hypot(...error) < 2) this.correction = error;
          else this.correction = [0, 0, 0];
        }
        this.sim.players.set(id, b);
      } else this.sim.players.set(id, b);
    }
    this.samples.push({ time: p.time, players: bodies });
    while (this.samples.length > 12) this.samples.shift();
    this.sim.remaining = p.left;
    this.sim.teamScores = p.score;
    this.sim.time = p.time + this.ping / 2000;
    this.clock = p.time + this.ping / 2000;
    this.clockReceived = now();
  }
  private authorityAction(
    b: Body,
    action: string,
    value: number,
    prediction = false,
  ) {
    if (action === "reload") this.sim.reload(b);
    if (
      action === "switch" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 3
    )
      this.sim.switch(b, value as WeaponId);
    if (action === "cook") this.sim.cook(b);
    if (action === "throw") this.sim.throw(b, !!value);
    if (action === "melee") this.sim.melee(b, prediction);
  }
  private sendAction(
    action: Extract<Packet, { k: "action" }>["action"],
    value = 0,
  ) {
    if (this.mode === "solo" || this.network.net.isHost)
      this.authorityAction(this.self, action, value);
    else {
      this.network.send({ k: "action", action, value, seq: ++this.actionId });
      this.authorityAction(this.self, action, value, true);
      this.sim.events = [];
    }
  }
  private action(a: Action, down: boolean) {
    if (this.screen !== "playing" || !this.self || this.self.hp <= 0) return;
    this.audio.unlock();
    if (a === "fire") {
      this.trigger = down;
      if (down) {
        this.fireEdge = true;
        this.fire();
      }
    }
    if (!down && a === "grenade") {
      this.sendAction("throw", this.input.down("sprint") ? 1 : 0);
      return;
    }
    if (!down) return;
    if (a === "reload") this.sendAction("reload");
    if (a === "grenade") this.sendAction("cook");
    if (a === "melee") {
      this.sendAction("melee");
      this.audio.melee();
    }
    if (a.startsWith("weapon"))
      this.switchWeapon((Number(a.slice(-1)) - 1) as WeaponId);
  }
  private switchWeapon(w: WeaponId) {
    if (this.screen !== "playing") return;
    this.sendAction("switch", w);
    this.shotReady = now() + WEAPONS[w].draw;
  }
  private fire() {
    const b = this.self;
    if (!b || b.hp <= 0 || this.screen !== "playing" || this.reconnecting)
      return;
    const w = WEAPONS[b.weapon];
    if (
      now() < this.shotReady ||
      b.sprint ||
      b.sprintLock > 0 ||
      b.cook >= 0 ||
      b.melee > 0.45
    )
      return;
    if (b.reload > 0) {
      if (b.weapon === 1 && b.mags[1] > 0) b.reload = 0;
      else return;
    }
    if (b.mags[b.weapon] <= 0) {
      this.sendAction("reload");
      return;
    }
    if (w.kind !== "auto" && !this.fireEdge) return;
    this.fireEdge = false;
    const time =
      this.mode === "solo" || this.network.net.isHost
        ? this.sim.time
        : this.clock + now() - this.clockReceived;
    const s: Shot = {
      id: ++this.shotId,
      time,
      weapon: b.weapon,
      yaw: this.input.yaw,
      pitch: this.input.pitch,
      aim: b.aim,
    };
    const interval = 60 / w.rpm;
    this.shotReady =
      w.kind === "auto" && now() - this.lastLocalFire <= 0.28
        ? Math.max(this.shotReady + interval, now() + interval - RULES.tick)
        : now() + interval;
    const from = eye(b);
    let localHit = false,
      head = false;
    const index = now() - this.lastLocalFire > 0.28 ? 0 : b.shotIndex;
    // Mousedown invokes this directly: visual, audio and predicted hit happen before network send.
    for (const dir of bulletDirections(s, index)) {
      const wall = traceWorld(this.sim.arena, from, dir);
      let dist = wall.dist;
      for (const target of this.sim.players.values()) {
        if (
          target.id === b.id ||
          target.hp <= 0 ||
          target.protection > 0 ||
          (this.mode === "tdm" && target.team === b.team)
        )
          continue;
        const hit = rayPlayer(target, from, dir, dist);
        if (hit && hit.dist < dist) {
          dist = hit.dist;
          localHit = true;
          head = hit.head;
        }
      }
      const end = from.map((v, i) => v + dir[i] * dist) as V3;
      this.renderer.tracer(from, end);
      if (wall.solid && dist === wall.dist) {
        this.renderer.impact(wall.point, wall.normal, wall.solid.color);
        this.audio.impact(wall.solid.material, wall.point);
      }
    }
    if (localHit) {
      this.hitType = head ? "head" : "body";
      this.hitUntil = now() + 0.16;
      this.hitShot = s.id;
      this.audio.hit(head);
    }
    this.renderer.fire(b);
    this.audio.shot(b.weapon);
    this.input.rumble();
    const pattern = w.recoil[index % w.recoil.length],
      kick = pattern[0] * this.settings.recoil,
      side = pattern[1] * this.settings.recoil;
    this.input.pitch = Math.min(1.5, this.input.pitch + kick);
    this.input.yaw += side;
    this.recoilRecovery += kick * 0.7;
    this.yawRecovery += side * 0.7;
    this.lastLocalFire = now();
    // Flush the HUD on the next rendered frame, including immediate predicted hits.
    this.uiAt = 0;
    if (this.mode === "solo" || this.network.net.isHost) this.sim.fire(b, s);
    else {
      b.mags[b.weapon]--;
      b.lastShot = this.sim.time;
      b.shotIndex = index + 1;
      b.action = "shot";
      b.actionTime = 0.2;
      this.predictedShots.set(s.id, b.weapon);
      this.network.send({ k: "shot", shot: s });
    }
  }
  private event(e: GameEvent) {
    const local = e.by === this.localId,
      target = e.target ? this.sim.players.get(e.target) : undefined,
      shooter = this.sim.players.get(e.by);
    if (
      e.type === "grenade" &&
      this.mode !== "solo" &&
      !this.network.net.isHost
    )
      this.sim.receiveGrenade(
        e,
        this.clock + now() - this.clockReceived - (e.time ?? this.clock),
      );
    if (e.type === "shot" && !local) {
      const from = shooter ? eye(shooter) : e.pos;
      this.renderer.tracer(from, e.pos);
      if (e.shot !== this.remoteShotIds.get(e.by)) {
        this.remoteShotIds.set(e.by, e.shot ?? -1);
        this.audio.shot(
          e.weapon || 0,
          from,
          Math.hypot(...from.map((v, i) => v - eye(this.self)[i])),
        );
        if (shooter) {
          shooter.action = "shot";
          shooter.actionTime = 0.2;
          this.renderer.eject(shooter);
        }
      }
      if (e.dir) {
        const start = e.pos.map((v, i) => v - e.dir![i] * 0.03) as V3;
        const wall = traceWorld(this.sim.arena, start, e.dir, 0.06);
        if (wall.solid && wall.dist < 0.06) {
          this.renderer.impact(wall.point, wall.normal, wall.solid.color);
          this.audio.impact(wall.solid.material, wall.point);
        }
      }
    }
    if (e.type === "hit") {
      if (local && e.accepted === false && e.shot !== undefined)
        this.predictedShots.delete(e.shot);
      if (
        local &&
        (e.accepted === false || (e.accepted === true && e.amount === 0)) &&
        this.hitShot === e.shot
      ) {
        this.hitUntil = 0;
        this.hitType = "";
      }
      if (e.target && target) {
        target.action = "hit";
        target.actionTime = 0.12;
        if (local) {
          this.hitType = e.head ? "head" : "body";
          this.hitUntil = now() + 0.17;
          if (this.hitShot !== e.shot) this.audio.hit(e.head);
          if (this.settings.damageNumbers) {
            this.damageText = String(Math.round(e.amount || 0));
            this.damageUntil = now() + 0.5;
          }
        }
        if (e.target === this.localId) {
          this.damageFlash = Math.min(1, 0.3 + (e.amount || 0) / 100);
          const b = this.self;
          this.damageAngle =
            Math.atan2(e.pos[0] - b.pos[0], -(e.pos[2] - b.pos[2])) + b.yaw;
          this.renderer.land += Math.min(0.07, (e.amount || 0) * 0.001);
        }
      }
    }
    if (e.type === "death" && target) {
      this.renderer.shatter(target, e.dir);
      target.hp = 0;
      target.dead = 3;
      this.feeds.unshift({
        id: performance.now() + Math.random(),
        killer: shooter?.name || "Snapbot",
        victim: target.name,
        weapon: e.weapon || 0,
        head: !!e.head,
        source: e.source || "gun",
      });
      this.feeds = this.feeds.slice(0, 5);
      if (local) {
        this.hitType = "kill";
        this.hitUntil = now() + 0.35;
        this.audio.kill();
      }
      if (e.target === this.localId) {
        this.killer = shooter?.name || "Snapbot";
        this.killerId = e.by;
        this.deathAt = now();
        this.trigger = false;
        this.input.reset();
        if (this.mode === "solo") this.cb.notice("soloOver");
      }
    }
    if (e.type === "explosion") {
      this.sim.grenades = this.sim.grenades.filter((g) => g.id !== e.object);
      this.renderer.explosion(e.pos);
      this.audio.explosion(e.pos);
    }
    if (e.type === "bounce") this.audio.fragment(e.pos);
    if (e.type === "melee" && !local) this.audio.melee(e.pos);
    if (e.type === "reload")
      this.audio.reload(e.value || 0, local ? undefined : e.pos);
  }
  private displayPlayers() {
    const list = [...this.sim.players.values()];
    if (
      this.mode === "solo" ||
      this.network.net.isHost ||
      this.samples.length < 2
    )
      return list;
    const time = this.clock + now() - this.clockReceived - 0.1;
    let a = this.samples[0],
      b = this.samples[this.samples.length - 1];
    for (let i = 1; i < this.samples.length; i++)
      if (this.samples[i].time >= time) {
        a = this.samples[i - 1];
        b = this.samples[i];
        break;
      }
    const frac = Math.max(
      0,
      Math.min(1, (time - a.time) / Math.max(0.001, b.time - a.time)),
    );
    return list.map((p) => {
      if (p.id === this.localId) return p;
      const aa = a.players.find((t) => t.id === p.id),
        bb = b.players.find((t) => t.id === p.id);
      if (!aa || !bb) return p;
      let pos = aa.pos.map((v, i) => v + (bb.pos[i] - v) * frac) as V3;
      if (time > b.time) {
        const extra = Math.min(0.1, time - b.time);
        pos = bb.pos.map((v, i) => v + bb.vel[i] * extra) as V3;
      }
      const delta = Math.atan2(
        Math.sin(bb.yaw - aa.yaw),
        Math.cos(bb.yaw - aa.yaw),
      );
      return {
        ...p,
        pos,
        yaw: aa.yaw + delta * frac,
        pitch: aa.pitch + (bb.pitch - aa.pitch) * frac,
      };
    });
  }
  private remoteFootsteps(players: Body[]) {
    for (const p of players) {
      if (p.id === this.localId || p.hp <= 0) continue;
      const old = this.actorSteps.get(p.id);
      if (old) {
        const moved = Math.hypot(p.pos[0] - old.pos[0], p.pos[2] - old.pos[2]);
        if (moved < 2) old.distance += moved;
        else old.distance = 0;
        const land = p.grounded && !old.grounded;
        if (p.grounded && (land || old.distance > (p.sprint ? 1.9 : 1.5))) {
          const floor = traceWorld(
            this.sim.arena,
            [p.pos[0], p.pos[1] + 0.1, p.pos[2]],
            [0, -1, 0],
            1,
          );
          this.audio.step(
            floor.solid?.material,
            p.sprint,
            p.crouch,
            land,
            p.pos,
          );
          old.distance = 0;
        }
      }
      this.actorSteps.set(p.id, {
        pos: [...p.pos],
        distance: old?.distance ?? 0,
        grounded: p.grounded,
      });
    }
    for (const id of this.actorSteps.keys())
      if (!players.some((p) => p.id === id && p.hp > 0))
        this.actorSteps.delete(id);
  }
  private loop = () => {
    if (this.disposed) return;
    const current = now(),
      elapsed = current - this.previous,
      dt = Math.min(0.05, elapsed);
    this.previous = current;
    if (!document.hidden)
      this.fps += (1 / Math.max(0.001, elapsed) - this.fps) * 0.04;
    this.audio.mix();
    let b = this.self;
    const playing =
      this.screen === "playing" ||
      (this.screen === "pause" && this.mode !== "solo");
    if (playing && b) {
      this.input.poll(dt, b, [...this.sim.players.values()], this.sim.arena);
      this.accumulator += dt;
      if (now() - this.lastLocalFire > 0.16 && this.recoilRecovery > 0) {
        const r = Math.min(this.recoilRecovery, this.recoilRecovery * dt * 8);
        this.input.pitch -= r;
        this.recoilRecovery -= r;
        const yr = this.yawRecovery * (1 - Math.exp(-dt * 8));
        this.input.yaw -= yr;
        this.yawRecovery -= yr;
      }
      if (
        b.weapon === 2 &&
        b.aim &&
        this.input.down("sprint") &&
        this.breathUsed < 3
      ) {
        this.breath = 3 - this.breathUsed;
        this.breathUsed += dt;
      } else {
        this.breath = 0;
        if (!b.aim) this.breathUsed = Math.max(0, this.breathUsed - dt * 0.6);
      }
      while (this.accumulator >= RULES.tick) {
        this.accumulator -= RULES.tick;
        this.tick++;
        const c =
          this.screen === "playing"
            ? this.input.command(++this.seq)
            : {
                seq: ++this.seq,
                x: 0,
                z: 0,
                yaw: b.yaw,
                pitch: b.pitch,
                jump: false,
                crouch: b.crouch,
                sprint: false,
                aim: false,
              };
        if (this.mode === "solo" || this.network.net.isHost) {
          const inputs =
            this.mode === "solo" && !this.laboratory
              ? this.sim.bots(RULES.tick)
              : new Map<string, Command>();
          inputs.set(this.localId, c);
          for (const [id, q] of this.commands) {
            const next = q.shift();
            if (next) this.held.set(id, next);
            const held = this.held.get(id);
            if (held) {
              const stale = current - (this.inputAt.get(id) || 0) > 0.3;
              inputs.set(
                id,
                next || {
                  ...held,
                  x: stale ? 0 : held.x,
                  z: stale ? 0 : held.z,
                  jump: false,
                },
              );
            }
          }
          this.sim.tick(inputs);
          if (this.mode === "solo" && !this.laboratory) this.sim.waves();
          for (const [id, until] of this.disconnected)
            if (current > until) {
              this.sim.players.delete(id);
              this.disconnected.delete(id);
              if (this.room) {
                this.room.players = this.room.players.filter(
                  (p) => p.id !== id,
                );
                this.broadcastRoom();
              }
            }
        } else if (!this.reconnecting) {
          moveBody(b, c, this.sim.arena);
          this.pending.push(c);
          if (this.pending.length > 180) this.pending.shift();
          this.sim.time += RULES.tick;
          b.actionTime = Math.max(0, b.actionTime - RULES.tick);
          if (b.actionTime === 0) b.action = "idle";
          b.dead = Math.max(0, b.dead - RULES.tick);
          b.melee = Math.max(0, b.melee - RULES.tick);
          b.reload = Math.max(0, b.reload - RULES.tick);
          if (b.cook >= 0) {
            b.cook += RULES.tick;
            if (b.cook >= RULES.maxCook) this.sendAction("throw");
          }
          this.sim.advanceGrenades(RULES.tick, false);
        }
        if (this.tick % 2 === 0 && this.mode !== "solo") {
          if (this.network.net.isHost)
            this.network.snapshot(
              [...this.sim.players.values()],
              this.tick,
              this.sim.time,
              this.sim.remaining,
              this.sim.teamScores,
            );
          else
            this.network.send({ k: "input", commands: this.pending.slice(-6) });
        }
      }
      if (this.trigger && (WEAPONS[b.weapon].kind === "auto" || this.fireEdge))
        this.fire();
      const events = this.sim.events.splice(0);
      events.forEach((e) => this.event(e));
      if (this.network.net.isHost && events.length)
        this.network.send({ k: "event", events: events.slice(-128) });
      if (this.sim.ended) {
        if (this.network.net.isHost)
          this.network.send({ k: "ended", reason: "score" });
        this.setScreen("results");
      }
      if (this.mode === "solo" && b.hp <= 0 && now() - this.deathAt > 3)
        this.setScreen("results");
      if (
        this.mode !== "solo" &&
        !this.network.net.isHost &&
        current - this.pingAt > 1
      ) {
        this.pingAt = current;
        this.network.send({ k: "ping", sent: current, rtt: this.ping });
      }
      if (
        this.mode !== "solo" &&
        !this.network.net.isHost &&
        !this.reconnecting &&
        current - this.lastHostPacket > 6
      )
        void this.reconnect();
      const distance = Math.hypot(b.vel[0], b.vel[2]) * dt;
      if (b.grounded && !this.wasGrounded)
        this.audio.step("plate", false, b.crouch, true);
      this.wasGrounded = b.grounded;
      this.footsteps += distance;
      if (b.grounded && this.footsteps > (b.sprint ? 1.9 : 1.5)) {
        this.footsteps = 0;
        const hit = traceWorld(
          this.sim.arena,
          [b.pos[0], b.pos[1] + 0.1, b.pos[2]],
          [0, -1, 0],
          1,
        );
        this.audio.step(hit.solid?.material, b.sprint, b.crouch);
      }
      this.audio.update(eye(b), b.yaw, b.pitch, b.hp, dt, false);
    } else this.audio.update([18, 12, 23], 0, 0, 100, dt, true);
    if (document.hidden) {
      this.frame = requestAnimationFrame(this.loop);
      return;
    }
    b = this.self;
    let players = this.displayPlayers();
    if (playing && b.hp > 0) this.remoteFootsteps(players);
    const menu = ["home", "lobby"].includes(this.screen);
    if (menu) {
      const hero = createBody("hero", this.name, [7, 0, 12], this.color);
      hero.yaw = 0.3;
      hero.accessory = this.accessory;
      const second = createBody("friend", "Snapbot", [-9, 0, -5], 1);
      second.yaw = 2;
      second.accessory = 2;
      players = [hero, second];
    }
    let view = b;
    if (b.hp <= 0 && this.killerId && this.replay.length) {
      const targetTime = this.deathAt - 2 + (now() - this.deathAt) * 0.7;
      const record =
        this.replay.find((r) => r.at >= targetTime) ||
        this.replay[this.replay.length - 1];
      const killer = record.players.find((p) => p.id === this.killerId);
      if (killer) {
        players = record.players;
        view = killer;
      }
    }
    if (b.hp > 0 && !menu) {
      this.replay.push({
        at: current,
        players: players.map((p) => ({
          ...p,
          pos: [...p.pos],
          vel: [...p.vel],
        })),
      });
      while (
        this.replay.length > 600 ||
        (this.replay.length > 1 && this.replay[0].at < current - 3)
      )
        this.replay.shift();
    }
    this.correction = this.correction.map((n) => n * Math.exp(-dt * 14)) as V3;
    const stats = this.renderer.render(
      dt,
      view,
      players,
      menu,
      this.correction,
      this.input.mouse,
      this.breath,
      this.sim.grenades,
    );
    this.input.currentFov = this.renderer.camera.fov;
    this.input.mouse = [0, 0, 0];
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.3);
    if (current - this.uiAt > 0.08) {
      this.uiAt = current;
      this.cb.hud({
        hp: b.hp,
        ammo: b.mags[b.weapon],
        grenades: b.grenades,
        weapon: b.weapon,
        reload: b.reload,
        kills: b.kills,
        wave: this.sim.wave,
        enemies: [...this.sim.players.values()].filter((p) => p.bot && p.hp > 0)
          .length,
        time: this.sim.remaining,
        teamScores: this.sim.teamScores,
        dead: b.dead,
        killer: this.killer,
        scope: b.aim && b.weapon === 2,
        sprint: b.sprint,
        cook: b.cook,
        breath: this.breath,
        spread:
          Math.max(0, 0.12 - (current - this.lastLocalFire)) * 70 +
          (b.aim ? 0 : Math.hypot(b.vel[0], b.vel[2]) * 0.6),
        hit: current < this.hitUntil ? this.hitType : "",
        damageAngle: this.damageAngle,
        damageFlash: this.damageFlash,
        feed: this.feeds,
        scoreboard: [...this.sim.players.values()].filter((p) => !p.bot),
        metrics: {
          fps: Math.round(this.fps),
          ...stats,
          ping: Math.round(this.ping),
        },
        message: "",
        damageText: current < this.damageUntil ? this.damageText : "",
      });
    }
    this.frame = requestAnimationFrame(this.loop);
  };
  startRange(map: MapId) {
    if (!import.meta.env.DEV) return;
    this.setMap(map);
    this.solo();
    this.laboratory = true;
    this.labArrange();
  }
  labWeapon(w: WeaponId) {
    if (!import.meta.env.DEV) return;
    this.switchWeapon(w);
  }
  labFire(down: boolean) {
    if (import.meta.env.DEV) this.action("fire", down);
  }
  labAim() {
    if (import.meta.env.DEV) {
      this.settings.toggleAim = true;
      this.input.aimToggle = !this.input.aimToggle;
    }
  }
  labReload() {
    if (import.meta.env.DEV) this.sendAction("reload");
  }
  labArrange() {
    if (
      !import.meta.env.DEV ||
      (this.mode !== "solo" && !this.network.net.isHost)
    )
      return;
    const x = this.map === "plaza" ? -19 : this.map === "docks" ? 8 : 0;
    const local = this.self;
    local.pos = [x, 0, 21];
    local.yaw = 0;
    local.pitch = -0.03;
    local.hp = 100;
    local.protection = 0;
    local.dead = 0;
    local.nextShot = 0;
    local.reload = 0;
    this.input.yaw = 0;
    this.input.pitch = -0.03;
    if (this.mode === "solo") {
      for (const [id, b] of this.sim.players)
        if (b.bot) this.sim.players.delete(id);
      const target = this.sim.add("target", "Range Snapbot", 1);
      target.bot = "grunt";
      target.pos = [x, 0, 6];
      target.protection = 0;
      target.hp = 100;
      target.yaw = Math.PI;
    } else {
      let i = 0;
      for (const b of this.sim.players.values())
        if (b.id !== this.localId) {
          b.pos = [x + i++ * 2, 0, 6];
          b.hp = 100;
          b.dead = 0;
          b.protection = 0;
          b.vel = [0, 0, 0];
        }
      for (const p of this.network.net.peerIds) this.network.invalidate(p);
    }
    this.sim.history = [];
    this.sim.ended = false;
    this.trigger = false;
    this.shotReady = 0;
  }
  labAimPeer(head = false) {
    if (!import.meta.env.DEV) return;
    const target = [...this.sim.players.values()].find(
      (p) => p.id !== this.localId && p.hp > 0,
    );
    if (!target) return;
    const from = eye(this.self),
      to = eye(target);
    to[1] -= head ? 0 : 0.45;
    const dx = to[0] - from[0],
      dy = to[1] - from[1],
      dz = to[2] - from[2];
    this.input.yaw = Math.atan2(-dx, -dz);
    this.input.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.recoilRecovery = 0;
    this.yawRecovery = 0;
  }
  labDisconnect() {
    if (!import.meta.env.DEV || this.network.net.isHost) return;
    for (const c of this.network.net.conns.values()) c.close();
  }
  labState() {
    return JSON.stringify({
      connectionError: this.connectionError,
      network: this.network.net.diagnostics,
      screen: this.screen,
      host: this.network.net.isHost,
      id: this.localId,
      time: +this.sim.time.toFixed(2),
      pending: this.pending.length,
      correction: this.correction,
      violations: this.sim.violations.length,
      players: [...this.sim.players.values()].map((b) => ({
        id: b.id,
        hp: b.hp,
        ammo: b.mags[b.weapon],
        weapon: b.weapon,
        kills: b.kills,
        pos: b.pos.map((n) => +n.toFixed(2)),
        ack: b.ack,
      })),
      ping: Math.round(this.ping),
    });
  }
  dispose() {
    this.connectionAttempt++;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.backgroundClock.terminate();
    this.network.close();
    this.input.dispose();
    this.renderer.dispose();
    this.audio.dispose();
  }
}
