export const COLORS = [
  "#ff813a",
  "#28a9ce",
  "#f5c845",
  "#8d78cd",
  "#64b97b",
  "#ed7097",
  "#e65545",
  "#42c4b5",
  "#698fe8",
  "#bd9768",
];
export type MapId = "plaza" | "fortress" | "docks";
export type Mode = "solo" | "ffa" | "tdm";
export type WeaponId = 0 | 1 | 2 | 3;
export const RULES = {
  health: 100,
  protection: 1.5,
  respawn: 3,
  maxPlayers: 10,
  ffaKills: 30,
  teamKills: 50,
  minutes: 10,
  tick: 1 / 60,
  snapshot: 1 / 30,
  interpolation: 100,
  rewind: 200,
  reconnect: 30000,
  sprintOut: 0.12,
  grenadeFuse: 3,
  maxCook: 2.5,
  grenadeRadius: 5,
  meleeCooldown: 0.8,
} as const;
export const WEAPONS = [
  {
    name: "Clicker AR",
    kind: "auto",
    body: 22,
    head: 40,
    rpm: 660,
    mag: 30,
    tactical: 1.9,
    empty: 2.4,
    ads: 0.22,
    draw: 0.3,
    zoom: 1.45,
    pellets: 1,
    spread: 0.018,
    fallStart: 20,
    fallEnd: 40,
    minDamage: 16,
    kick: 0.025,
    recoil: [
      [0.006, 0],
      [0.007, -0.001],
      [0.008, -0.002],
      [0.008, 0.001],
      [0.009, 0.002],
      [0.008, 0.003],
      [0.007, -0.002],
      [0.008, -0.003],
    ],
    color: "#f7b83d",
  },
  {
    name: "Snapgun",
    kind: "pump",
    body: 14,
    head: 20,
    rpm: 70,
    mag: 6,
    tactical: 0.5,
    empty: 0.5,
    ads: 0.25,
    draw: 0.38,
    zoom: 1.35,
    pellets: 8,
    spread: 0.055,
    fallStart: 12,
    fallEnd: 25,
    minDamage: 3,
    kick: 0.08,
    recoil: [[0.032, 0.001]],
    color: "#e56c4d",
  },
  {
    name: "Longstud",
    kind: "bolt",
    body: 85,
    head: 150,
    rpm: 45,
    mag: 5,
    tactical: 2.6,
    empty: 3.2,
    ads: 0.35,
    draw: 0.45,
    zoom: 8,
    pellets: 1,
    spread: 0.04,
    fallStart: 90,
    fallEnd: 150,
    minDamage: 65,
    kick: 0.1,
    recoil: [[0.042, 0.002]],
    color: "#54bba0",
  },
  {
    name: "Peg Pistol",
    kind: "semi",
    body: 28,
    head: 50,
    rpm: 400,
    mag: 12,
    tactical: 1.4,
    empty: 1.7,
    ads: 0.15,
    draw: 0.2,
    zoom: 1.3,
    pellets: 1,
    spread: 0.016,
    fallStart: 25,
    fallEnd: 50,
    minDamage: 20,
    kick: 0.04,
    recoil: [
      [0.014, 0.001],
      [0.016, -0.002],
      [0.018, 0.001],
    ],
    color: "#51a4d1",
  },
] as const;
// Fixed eight-pellet pattern; no random seed or client/server disagreement.
export const PELLETS = [
  [0, 0],
  [-0.65, -0.4],
  [0.65, -0.4],
  [-0.8, 0.3],
  [0.8, 0.3],
  [0, 0.85],
  [-0.35, -0.9],
  [0.35, 0.7],
] as const;
export const QUALITY = {
  low: { scale: 0.65, studs: 6, debris: 96 },
  medium: { scale: 0.85, studs: 8, debris: 192 },
  high: { scale: 1, studs: 12, debris: 320 },
} as const;
export const DEFAULT_BINDS = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  sprint: "ShiftLeft",
  jump: "Space",
  crouch: "ControlLeft",
  crouchAlt: "KeyC",
  fire: "Mouse0",
  aim: "Mouse2",
  reload: "KeyR",
  grenade: "KeyG",
  melee: "KeyF",
  weapon1: "Digit1",
  weapon2: "Digit2",
  weapon3: "Digit3",
  weapon4: "Digit4",
  scoreboard: "Tab",
  menu: "Escape",
};
export type Action = keyof typeof DEFAULT_BINDS;
export interface Settings {
  language: string;
  sensitivity: number;
  adsSensitivity: number;
  fov: number;
  invertY: boolean;
  toggleAim: boolean;
  aimAssist: number;
  quality: keyof typeof QUALITY;
  resolution: number;
  studSegments: number;
  debris: number;
  master: number;
  effects: number;
  music: number;
  ui: number;
  crossColor: string;
  crossSize: number;
  crossGap: number;
  damageNumbers: boolean;
  performance: boolean;
  recoil: number;
  stiffness: number;
  adsTime: number;
  latency: number;
  jitter: number;
  loss: number;
  binds: Record<Action, string>;
}
export const DEFAULT_SETTINGS: Settings = {
  language: "en",
  sensitivity: 1,
  adsSensitivity: 1,
  fov: 95,
  invertY: false,
  toggleAim: false,
  aimAssist: 0.35,
  quality: "medium",
  resolution: 0.85,
  studSegments: 8,
  debris: 192,
  master: 0.7,
  effects: 0.8,
  music: 0.15,
  ui: 0.5,
  crossColor: "#ffffff",
  crossSize: 7,
  crossGap: 5,
  damageNumbers: false,
  performance: false,
  recoil: 1,
  stiffness: 180,
  adsTime: 1,
  latency: 0,
  jitter: 0,
  loss: 0,
  binds: { ...DEFAULT_BINDS },
};
export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem("brickfray.settings") || "{}");
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      binds: { ...DEFAULT_BINDS, ...s.binds },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, binds: { ...DEFAULT_BINDS } };
  }
}
export const damageAt = (w: WeaponId, distance: number, head: boolean) => {
  const s = WEAPONS[w];
  return (
    (head ? s.head : s.body) *
    (1 -
      (1 - s.minDamage / s.body) *
        Math.max(
          0,
          Math.min(1, (distance - s.fallStart) / (s.fallEnd - s.fallStart)),
        ))
  );
};
