import { WEAPON_IDS, WEAPONS, type WeaponId } from '../weapons/defs';
import type { Grenade } from '../sim/grenades';
import type { MoveState } from '../sim/movement';
import type { ArmsState, Command, HostPlayer, PlayerState, ShotTrace } from '../sim/types';
import { noUpgrades, UPGRADE_IDS, upgradeStats, type UpgradeLevels } from '../sim/upgrades';
import { Reader, Writer } from './bytes';

export const PACKET = { input: 1, snapshot: 2 } as const;
/** Seconds of a melee swing the snapshot's progress byte spans (longer than every tool's swing). */
export const MELEE_SPAN = 0.6;

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
  /** Melee swing progress over `MELEE_SPAN` seconds, or -1. */
  melee: number;
  grenade: number;
  sliding?: boolean;
  /**
   * Weapon switch, -1 when none: 0…0.5 while the gun in hand (the loadout's other one, `weapon` being the one wanted)
   * is put away, 0.5…1 while `weapon` is drawn.
   */
  swap?: number;
}

export interface SelfState {
  move: MoveState;
  arms: ArmsState;
  health: number;
  alive: boolean;
  life: number;
  maxHealth: number;
  armor: number;
  upgrades: UpgradeLevels;
}

export interface Snapshot {
  time: number;
  ack: number;
  self: SelfState | null;
  players: RemoteSnapshotPlayer[];
  grenades: { id: number; owner: number; x: number; y: number; z: number; bounces: number; fuse: number }[];
  traces: ShotTrace[];
}

const SURFACES = ['none', 'body', 'plastic', 'metal', 'wood', 'glass', 'foliage', 'water', 'stone'];

function writeSelf(w: Writer, p: HostPlayer) {
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
  w.u8(a.burstLeft);
  w.f32(a.reload);
  w.f32(a.reloadTotal);
  w.u8(a.burst);
  w.f32(Math.min(a.sinceShot, 100));
  w.f32(a.sprintRecovery);
  w.f32(a.meleeCooldown);
  w.f32(a.meleeTime);
  w.u8(a.grenades);
  w.u8(a.grenadeMax);
  w.f32(a.grenadeRefill);
  w.f32(a.grenadeTimer);
  w.f32(a.cook);
  w.f32(a.throwTime);
  w.f32(a.ads);
  w.f32(a.queuedFire);
  w.u16(a.prevButtons);
  w.u16(a.shots & 0xffff);
  w.u16(Math.ceil(p.health));
  w.u8(p.life);
  w.u16(p.maxHealth);
  w.u16(Math.ceil(p.armor));
  for (const id of UPGRADE_IDS) w.u8(p.upgrades[id]);
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
    burstLeft: r.u8(),
    reload: r.f32(),
    reloadTotal: r.f32(),
    reloadEmpty: (flags & 16) !== 0,
    burst: r.u8(),
    sinceShot: r.f32(),
    sprintRecovery: r.f32(),
    meleeCooldown: r.f32(),
    meleeTime: r.f32(),
    grenades: r.u8(),
    grenadeMax: r.u8(),
    grenadeRefill: r.f32(),
    grenadeTimer: r.f32(),
    cook: r.f32(),
    throwTime: r.f32(),
    ads: r.f32(),
    queuedFire: r.f32(),
    prevButtons: r.u16(),
    shots: r.u16(),
    magScale: 1,
    reloadScale: 1
  };
  const health = r.u16();
  const life = r.u8();
  const maxHealth = r.u16();
  const armor = r.u16();
  const upgrades = noUpgrades();
  for (const id of UPGRADE_IDS) upgrades[id] = r.u8();
  // The modifiers come from the levels, so prediction runs on the very numbers the host does.
  const stats = upgradeStats(upgrades);
  arms.magScale = stats.magScale;
  arms.reloadScale = stats.reloadScale;
  move.pace = stats.pace;
  return { move, arms, health, alive: (flags & 8) !== 0, life, maxHealth, armor, upgrades };
}

export function encodeSnapshot(time: number, ack: number, self: HostPlayer | null, players: Iterable<PlayerState>, grenades: readonly Grenade[], traces: readonly ShotTrace[]): ArrayBuffer {
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
    w.u8((p.alive ? 1 : 0) | (m.grounded ? 2 : 0) | (m.sprinting ? 4 : 0) | (m.slide > 0 ? 8 : 0));
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
    w.u8(a.meleeTime >= 0 ? Math.min(1, a.meleeTime / MELEE_SPAN) * 254 + 1 : 0);
    w.u8(a.cook >= 0 ? 1 : a.throwTime > 0 ? 2 + (1 - a.throwTime / 0.45) * 253 : 0);
    w.u8(encodeSwap(a));
  }
  w.u8(grenades.length);
  for (const g of grenades) {
    w.u16(g.id);
    w.u16(g.owner);
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
      grenade: decodeGrenade(r.u8()),
      sliding: (flags & 8) !== 0,
      swap: decodeSwap(r.u8())
    });
  }
  const grenades: Snapshot['grenades'] = [];
  const g = r.u8();
  for (let i = 0; i < g; i++) grenades.push({ id: r.u16(), owner: r.u16(), x: r.f32(), y: r.f32(), z: r.f32(), bounces: r.u8(), fuse: r.u8() / 50 });
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

/** 0 none, 1…127 putting the old gun away, 128…255 drawing the new one. */
function encodeSwap(a: ArmsState) {
  if (a.switchTime <= 0) return 0;
  if (a.next) {
    const draw = WEAPONS[a.next].drawTime;
    const holster = Math.max(1e-3, WEAPONS[a.weapon].holsterTime);
    return 1 + Math.round(Math.min(1, Math.max(0, 1 - (a.switchTime - draw) / holster)) * 126);
  }
  return 128 + Math.round(Math.min(1, Math.max(0, 1 - a.switchTime / Math.max(1e-3, WEAPONS[a.weapon].drawTime))) * 127);
}

const decodeSwap = (v: number) => (v === 0 ? -1 : v < 128 ? ((v - 1) / 126) * 0.5 : 0.5 + ((v - 128) / 127) * 0.5);
/** -1 none, 0.25 cooking (holds at wind-up), 0.25…1 throwing. */
const decodeGrenade = (v: number) => (v === 0 ? -1 : v === 1 ? 0.25 : 0.25 + ((v - 2) / 253) * 0.75);

