import { WEAPON_IDS, type WeaponId } from '../weapons/defs';
import type { Grenade } from '../sim/grenades';
import type { MoveState } from '../sim/movement';
import type { ArmsState, Command, PlayerState, ShotTrace } from '../sim/types';

/** Growable little-endian binary writer. */
export class Writer {
  private view: DataView;
  private bytes: Uint8Array;
  offset = 0;

  constructor(size = 512) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }

  private ensure(n: number) {
    if (this.offset + n <= this.bytes.length) return;
    const next = new Uint8Array(Math.max(this.bytes.length * 2, this.offset + n));
    next.set(this.bytes);
    this.bytes = next;
    this.view = new DataView(next.buffer);
  }
  u8(v: number) {
    this.ensure(1);
    this.view.setUint8(this.offset++, Math.max(0, Math.min(255, Math.round(v))));
  }
  i8(v: number) {
    this.ensure(1);
    this.view.setInt8(this.offset++, Math.max(-128, Math.min(127, Math.round(v))));
  }
  u16(v: number) {
    this.ensure(2);
    this.view.setUint16(this.offset, Math.max(0, Math.min(65535, Math.round(v))), true);
    this.offset += 2;
  }
  i16(v: number) {
    this.ensure(2);
    this.view.setInt16(this.offset, Math.max(-32768, Math.min(32767, Math.round(v))), true);
    this.offset += 2;
  }
  u32(v: number) {
    this.ensure(4);
    this.view.setUint32(this.offset, v >>> 0, true);
    this.offset += 4;
  }
  f32(v: number) {
    this.ensure(4);
    this.view.setFloat32(this.offset, v, true);
    this.offset += 4;
  }
  f64(v: number) {
    this.ensure(8);
    this.view.setFloat64(this.offset, v, true);
    this.offset += 8;
  }
  finish(): ArrayBuffer {
    return this.bytes.slice(0, this.offset).buffer;
  }
}

export class Reader {
  private view: DataView;
  offset = 0;
  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }
  get done() {
    return this.offset >= this.view.byteLength;
  }
  u8() {
    return this.view.getUint8(this.offset++);
  }
  i8() {
    return this.view.getInt8(this.offset++);
  }
  u16() {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }
  i16() {
    const v = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return v;
  }
  u32() {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }
  f32() {
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }
  f64() {
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }
}

export const PACKET = { input: 1, snapshot: 2 } as const;

// ---------- client → host: commands (last few unacked, newest last) ----------

export function encodeInput(commands: readonly Command[]): ArrayBuffer {
  const w = new Writer(32 + commands.length * 24);
  w.u8(PACKET.input);
  w.u8(commands.length);
  for (const c of commands) {
    w.u32(c.seq);
    w.i8(c.forward * 127);
    w.i8(c.right * 127);
    w.f32(c.yaw);
    w.f32(c.pitch);
    w.u16(c.buttons);
    w.u8(c.slot);
    w.f64(c.viewTime);
    w.u8(c.life);
  }
  return w.finish();
}

export function decodeInput(r: Reader): Command[] {
  const n = r.u8();
  const out: Command[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ seq: r.u32(), forward: r.i8() / 127, right: r.i8() / 127, yaw: r.f32(), pitch: r.f32(), buttons: r.u16(), slot: r.u8(), viewTime: r.f64(), life: r.u8() });
  }
  return out;
}

// ---------- host → client: snapshot ----------

export interface RemoteSnapshotPlayer {
  id: number;
  alive: boolean;
  grounded: boolean;
  sprinting: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  crouch: number;
  weapon: WeaponId;
  health: number;
  shots: number;
  ads: number;
  reload: number;
  melee: number;
  grenade: number;
}

export interface SelfState {
  move: MoveState;
  arms: ArmsState;
  health: number;
  alive: boolean;
  life: number;
}

export interface Snapshot {
  time: number;
  ack: number;
  self: SelfState | null;
  players: RemoteSnapshotPlayer[];
  grenades: { id: number; x: number; y: number; z: number; bounces: number; fuse: number }[];
  traces: ShotTrace[];
}

const SURFACES = ['none', 'body', 'plastic', 'metal', 'wood', 'glass', 'foliage', 'water', 'stone'];

function writeSelf(w: Writer, p: PlayerState) {
  const m = p.move;
  const a = p.arms;
  w.f32(m.x);
  w.f32(m.y);
  w.f32(m.z);
  w.f32(m.vx);
  w.f32(m.vy);
  w.f32(m.vz);
  w.u8((m.grounded ? 1 : 0) | (m.sprinting ? 2 : 0) | (m.jumpLatch ? 4 : 0) | (p.alive ? 8 : 0) | (a.reloadEmpty ? 16 : 0));
  w.f32(m.crouch);
  w.f32(m.slide);
  w.u8(WEAPON_IDS.indexOf(a.weapon));
  w.u8(a.next ? WEAPON_IDS.indexOf(a.next) : 255);
  w.f32(a.switchTime);
  for (const id of WEAPON_IDS) w.u8(a.ammo[id]);
  w.f32(a.cooldown);
  w.f32(a.reload);
  w.f32(a.reloadTotal);
  w.u8(a.burst);
  w.f32(Math.min(a.sinceShot, 100));
  w.f32(a.sprintRecovery);
  w.f32(a.meleeCooldown);
  w.f32(a.meleeTime);
  w.u8(a.grenades);
  w.f32(a.cook);
  w.f32(a.throwTime);
  w.f32(a.ads);
  w.f32(a.queuedFire);
  w.u16(a.prevButtons);
  w.u16(a.shots & 0xffff);
  w.u16(Math.ceil(p.health));
  w.u8(p.life);
}

function readSelf(r: Reader): SelfState {
  const move = { x: r.f32(), y: r.f32(), z: r.f32(), vx: r.f32(), vy: r.f32(), vz: r.f32() } as MoveState;
  const flags = r.u8();
  move.grounded = (flags & 1) !== 0;
  move.sprinting = (flags & 2) !== 0;
  move.jumpLatch = (flags & 4) !== 0;
  move.crouch = r.f32();
  move.slide = r.f32();
  move.landed = 0;
  const weapon = WEAPON_IDS[r.u8()]!;
  const nextIndex = r.u8();
  const switchTime = r.f32();
  const ammo = {} as Record<WeaponId, number>;
  for (const id of WEAPON_IDS) ammo[id] = r.u8();
  const arms: ArmsState = {
    weapon,
    next: nextIndex === 255 ? null : WEAPON_IDS[nextIndex]!,
    switchTime,
    ammo,
    cooldown: r.f32(),
    reload: r.f32(),
    reloadTotal: r.f32(),
    reloadEmpty: (flags & 16) !== 0,
    burst: r.u8(),
    sinceShot: r.f32(),
    sprintRecovery: r.f32(),
    meleeCooldown: r.f32(),
    meleeTime: r.f32(),
    grenades: r.u8(),
    cook: r.f32(),
    throwTime: r.f32(),
    ads: r.f32(),
    queuedFire: r.f32(),
    prevButtons: r.u16(),
    shots: r.u16()
  };
  const health = r.u16();
  return { move, arms, health, alive: (flags & 8) !== 0, life: r.u8() };
}

export function encodeSnapshot(time: number, ack: number, self: PlayerState | null, players: Iterable<PlayerState>, grenades: readonly Grenade[], traces: readonly ShotTrace[]): ArrayBuffer {
  const w = new Writer(1024);
  w.u8(PACKET.snapshot);
  w.f64(time);
  w.u32(ack);
  w.u8(self ? 1 : 0);
  if (self) writeSelf(w, self);
  const list = [...players];
  w.u8(list.length);
  for (const p of list) {
    const m = p.move;
    const a = p.arms;
    w.u16(p.id);
    w.u8((p.alive ? 1 : 0) | (m.grounded ? 2 : 0) | (m.sprinting ? 4 : 0));
    w.f32(m.x);
    w.f32(m.y);
    w.f32(m.z);
    w.i16(m.vx * 100);
    w.i16(m.vy * 100);
    w.i16(m.vz * 100);
    w.u16(((((p.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 65535);
    w.i16(p.pitch * 10000);
    w.u8(m.crouch * 255);
    w.u8(WEAPON_IDS.indexOf(a.next ?? a.weapon));
    w.u16(Math.ceil(p.health));
    w.u16(a.shots & 0xffff);
    w.u8(a.ads * 255);
    w.u8(a.reload > 0 && a.reloadTotal > 0 ? (1 - a.reload / a.reloadTotal) * 254 + 1 : 0);
    w.u8(a.meleeTime >= 0 ? Math.min(1, a.meleeTime / 0.5) * 254 + 1 : 0);
    w.u8(a.cook >= 0 ? 1 : a.throwTime > 0 ? 2 + (1 - a.throwTime / 0.45) * 253 : 0);
  }
  w.u8(grenades.length);
  for (const g of grenades) {
    w.u16(g.id);
    w.f32(g.x);
    w.f32(g.y);
    w.f32(g.z);
    w.u8(g.bounces);
    w.u8(Math.max(0, g.fuse) * 50);
  }
  w.u8(Math.min(255, traces.length));
  for (const t of traces.slice(0, 255)) {
    w.u16(t.shooter);
    w.u8(WEAPON_IDS.indexOf(t.weapon));
    w.f32(t.origin[0]);
    w.f32(t.origin[1]);
    w.f32(t.origin[2]);
    w.u8(t.ends.length);
    for (const e of t.ends) {
      w.f32(e.point[0]);
      w.f32(e.point[1]);
      w.f32(e.point[2]);
      w.u8(Math.max(0, SURFACES.indexOf(e.surface)));
      w.u16(e.hitPlayer);
      w.i8(e.normal[0] * 127);
      w.i8(e.normal[1] * 127);
      w.i8(e.normal[2] * 127);
    }
  }
  return w.finish();
}

export function decodeSnapshot(r: Reader): Snapshot {
  const time = r.f64();
  const ack = r.u32();
  const self = r.u8() ? readSelf(r) : null;
  const players: RemoteSnapshotPlayer[] = [];
  const n = r.u8();
  for (let i = 0; i < n; i++) {
    const id = r.u16();
    const flags = r.u8();
    players.push({
      id,
      alive: (flags & 1) !== 0,
      grounded: (flags & 2) !== 0,
      sprinting: (flags & 4) !== 0,
      x: r.f32(),
      y: r.f32(),
      z: r.f32(),
      vx: r.i16() / 100,
      vy: r.i16() / 100,
      vz: r.i16() / 100,
      yaw: (r.u16() / 65535) * Math.PI * 2,
      pitch: r.i16() / 10000,
      crouch: r.u8() / 255,
      weapon: WEAPON_IDS[r.u8()] ?? 'ar',
      health: r.u16(),
      shots: r.u16(),
      ads: r.u8() / 255,
      reload: decodeProgress(r.u8()),
      melee: decodeProgress(r.u8()),
      grenade: decodeGrenade(r.u8())
    });
  }
  const grenades: Snapshot['grenades'] = [];
  const g = r.u8();
  for (let i = 0; i < g; i++) grenades.push({ id: r.u16(), x: r.f32(), y: r.f32(), z: r.f32(), bounces: r.u8(), fuse: r.u8() / 50 });
  const traces: ShotTrace[] = [];
  const t = r.u8();
  for (let i = 0; i < t; i++) {
    const shooter = r.u16();
    const weapon = WEAPON_IDS[r.u8()] ?? 'ar';
    const origin: [number, number, number] = [r.f32(), r.f32(), r.f32()];
    const count = r.u8();
    const ends: ShotTrace['ends'] = [];
    for (let k = 0; k < count; k++) {
      ends.push({ point: [r.f32(), r.f32(), r.f32()], surface: SURFACES[r.u8()] ?? 'plastic', hitPlayer: r.u16(), normal: [r.i8() / 127, r.i8() / 127, r.i8() / 127] });
    }
    traces.push({ shooter, weapon, origin, ends });
  }
  return { time, ack, self, players, grenades, traces };
}

const decodeProgress = (v: number) => (v === 0 ? -1 : (v - 1) / 254);
/** -1 none, 0.25 cooking (holds at wind-up), 0.25…1 throwing. */
const decodeGrenade = (v: number) => (v === 0 ? -1 : v === 1 ? 0.25 : 0.25 + ((v - 2) / 253) * 0.75);

