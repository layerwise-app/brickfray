import type { WeaponId } from "./config";
import type { Body, Command, GameEvent, Room, Shot } from "./types";
const actions = ["idle", "shot", "reload", "melee", "grenade", "hit", "switch"];
export function packBody(b: Body): number[] {
  return [
    ...b.pos.map((v) => Math.round(v * 100)),
    ...b.vel.map((v) => Math.round(v * 100)),
    Math.round(b.yaw * 1000),
    Math.round(b.pitch * 1000),
    Math.ceil(b.hp),
    (b.grounded ? 1 : 0) |
      (b.crouch ? 2 : 0) |
      (b.sprint ? 4 : 0) |
      (b.aim ? 8 : 0) |
      (b.reloadEmpty ? 16 : 0),
    b.weapon,
    ...b.mags,
    Math.round(b.reload * 1000),
    Math.round(b.dead * 1000),
    b.kills,
    b.deaths,
    b.assists,
    b.team,
    b.color,
    b.accessory,
    b.ack,
    b.ping,
    b.grenades,
    Math.round(b.protection * 1000),
    actions.indexOf(b.action),
    Math.round(b.actionTime * 1000),
    Math.round(b.slide * 1000),
    Math.round(b.sprintLock * 1000),
    Math.round(b.cook * 1000),
    b.shotAck,
  ];
}
export function unpackBody(a: number[], b: Body): Body {
  return {
    ...b,
    pos: [a[0] / 100, a[1] / 100, a[2] / 100],
    vel: [a[3] / 100, a[4] / 100, a[5] / 100],
    yaw: a[6] / 1000,
    pitch: a[7] / 1000,
    hp: a[8],
    grounded: !!(a[9] & 1),
    crouch: !!(a[9] & 2),
    sprint: !!(a[9] & 4),
    aim: !!(a[9] & 8),
    reloadEmpty: !!(a[9] & 16),
    weapon: a[10] as WeaponId,
    mags: a.slice(11, 15),
    reload: a[15] / 1000,
    dead: a[16] / 1000,
    kills: a[17],
    deaths: a[18],
    assists: a[19],
    team: a[20],
    color: a[21],
    accessory: a[22],
    ack: a[23],
    ping: a[24],
    grenades: a[25],
    protection: a[26] / 1000,
    action: actions[a[27]] || "idle",
    actionTime: a[28] / 1000,
    slide: a[29] / 1000,
    sprintLock: a[30] / 1000,
    cook: a[31] / 1000,
    shotAck: a[32],
  };
}
export type Packet =
  | {
      k: "hello";
      token: string;
      name: string;
      color: number;
      accessory: number;
    }
  | { k: "room"; room: Room; self: string }
  | { k: "begin"; room: Room }
  | { k: "input"; commands: Command[] }
  | { k: "shot"; shot: Shot }
  | {
      k: "action";
      action: "reload" | "switch" | "cook" | "throw" | "melee";
      value: number;
      seq: number;
    }
  | {
      k: "snapshot";
      tick: number;
      time: number;
      left: number;
      score: number[];
      base: number;
      full: boolean;
      rows: Record<string, number[]>;
      removed: string[];
    }
  | { k: "event"; events: GameEvent[] }
  | { k: "ping"; sent: number; time?: number; rtt?: number }
  | { k: "chat"; text: string; name?: string }
  | { k: "ended"; reason: string }
  | { k: "resync" };
function validCommand(c: Command) {
  return (
    c &&
    Number.isSafeInteger(c.seq) &&
    c.seq >= 0 &&
    [c.x, c.z, c.yaw, c.pitch].every(Number.isFinite) &&
    Math.abs(c.x) <= 2 &&
    Math.abs(c.z) <= 2 &&
    Math.abs(c.yaw) < 1e6 &&
    Math.abs(c.pitch) <= 1.6 &&
    ["jump", "crouch", "sprint", "aim"].every(
      (k) => typeof c[k as keyof Command] === "boolean",
    )
  );
}
export function validPacket(p: unknown): p is Packet {
  if (!p || typeof p !== "object" || !("k" in p)) return false;
  const a = p as Packet;
  switch (a.k) {
    case "input":
      return (
        Array.isArray(a.commands) &&
        a.commands.length <= 12 &&
        a.commands.every(validCommand)
      );
    case "shot":
      return (
        !!a.shot &&
        [a.shot.id, a.shot.time, a.shot.yaw, a.shot.pitch, a.shot.weapon].every(
          Number.isFinite,
        ) &&
        Number.isInteger(a.shot.weapon) &&
        a.shot.weapon >= 0 &&
        a.shot.weapon <= 3
      );
    case "hello":
      return (
        typeof a.token === "string" &&
        a.token.length <= 80 &&
        typeof a.name === "string" &&
        a.name.length <= 20 &&
        Number.isInteger(a.color) &&
        a.color >= 0 &&
        a.color < 10 &&
        Number.isInteger(a.accessory) &&
        a.accessory >= 0 &&
        a.accessory <= 2
      );
    case "action":
      return (
        ["reload", "switch", "cook", "throw", "melee"].includes(a.action) &&
        Number.isSafeInteger(a.seq) &&
        Number.isFinite(a.value)
      );
    case "chat":
      return typeof a.text === "string" && a.text.length <= 160;
    case "ping":
      return (
        Number.isFinite(a.sent) &&
        (a.time === undefined || Number.isFinite(a.time))
      );
    case "resync":
      return true;
    case "room":
    case "begin":
      return (
        !!a.room &&
        Array.isArray(a.room.players) &&
        a.room.players.length <= 10 &&
        ["plaza", "fortress", "docks"].includes(a.room.map) &&
        ["ffa", "tdm"].includes(a.room.mode)
      );
    case "snapshot":
      return (
        Number.isFinite(a.time) &&
        Number.isSafeInteger(a.tick) &&
        a.rows !== null &&
        typeof a.rows === "object" &&
        Object.keys(a.rows).length <= 10 &&
        Object.values(a.rows).every(
          (r) => Array.isArray(r) && r.length <= 70 && r.every(Number.isFinite),
        ) &&
        Array.isArray(a.removed)
      );
    case "event":
      return Array.isArray(a.events) && a.events.length <= 128;
    case "ended":
      return typeof a.reason === "string" && a.reason.length <= 100;
    default:
      return false;
  }
}
