import type { MapId, Mode, WeaponId } from "./config";
export type V3 = [number, number, number];
export interface Command {
  seq: number;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  aim: boolean;
}
export interface Body {
  id: string;
  name: string;
  pos: V3;
  vel: V3;
  yaw: number;
  pitch: number;
  hp: number;
  grounded: boolean;
  crouch: boolean;
  sprint: boolean;
  aim: boolean;
  slide: number;
  sprintLock: number;
  weapon: WeaponId;
  mags: number[];
  reload: number;
  reloadEmpty: boolean;
  nextShot: number;
  lastShot: number;
  shotIndex: number;
  shotAck: number;
  grenades: number;
  cook: number;
  melee: number;
  protection: number;
  dead: number;
  kills: number;
  deaths: number;
  assists: number;
  team: number;
  color: number;
  accessory: number;
  ack: number;
  ping: number;
  action: string;
  actionTime: number;
  lastDeath: V3;
  damageBy: Record<string, number>;
  bot?: "grunt" | "rusher" | "sniper" | "boss";
}
export interface Room {
  code: string;
  host: string;
  public: boolean;
  map: MapId;
  mode: Mode;
  minutes: number;
  players: {
    id: string;
    name: string;
    color: number;
    accessory: number;
    team: number;
  }[];
  started: boolean;
}
export interface Shot {
  id: number;
  time: number;
  weapon: WeaponId;
  yaw: number;
  pitch: number;
  aim: boolean;
}
export interface GameEvent {
  type:
    | "shot"
    | "hit"
    | "death"
    | "explosion"
    | "bounce"
    | "reload"
    | "melee"
    | "grenade";
  by: string;
  target?: string;
  pos: V3;
  dir?: V3;
  weapon?: WeaponId;
  amount?: number;
  head?: boolean;
  shot?: number;
  accepted?: boolean;
  source?: string;
  value?: number;
  object?: string;
  time?: number;
}
export interface Feed {
  id: number;
  killer: string;
  victim: string;
  weapon: number;
  head: boolean;
  source: string;
}
export interface Metrics {
  fps: number;
  calls: number;
  triangles: number;
  ping: number;
}
export interface HudState {
  hp: number;
  ammo: number;
  grenades: number;
  weapon: WeaponId;
  reload: number;
  kills: number;
  wave: number;
  enemies: number;
  time: number;
  teamScores: number[];
  dead: number;
  killer: string;
  scope: boolean;
  sprint: boolean;
  cook: number;
  breath: number;
  spread: number;
  hit: "body" | "head" | "kill" | "";
  damageAngle: number;
  damageFlash: number;
  feed: Feed[];
  scoreboard: Body[];
  metrics: Metrics;
  message: string;
  damageText: string;
}
export function createBody(id: string, name: string, pos: V3, color = 0): Body {
  return {
    id,
    name,
    pos: [...pos],
    vel: [0, 0, 0],
    yaw: 0,
    pitch: 0,
    hp: 100,
    grounded: true,
    crouch: false,
    sprint: false,
    aim: false,
    slide: 0,
    sprintLock: 0,
    weapon: 0,
    mags: [30, 6, 5, 12],
    reload: 0,
    reloadEmpty: false,
    nextShot: 0,
    lastShot: -10,
    shotIndex: 0,
    shotAck: 0,
    grenades: 2,
    cook: -1,
    melee: 0,
    protection: 1.5,
    dead: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    team: 0,
    color,
    accessory: 0,
    ack: 0,
    ping: 0,
    action: "idle",
    actionTime: 0,
    lastDeath: [1000, 0, 1000],
    damageBy: {},
  };
}
