/** Network order: indices go over the wire, so new guns are appended. */
export const WEAPON_IDS = ['ar', 'shotgun', 'sniper', 'pistol', 'nailer', 'pulse', 'harpoon', 'cannon', 'buzzer'] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export type FireMode = 'auto' | 'burst' | 'pump' | 'bolt' | 'semi';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  mode: FireMode;
  body: number;
  head: number;
  minDamage: number;
  rpm: number;
  mag: number;
  /** Reload seconds with rounds left / from empty. Shotgun: seconds per shell. */
  reload: number;
  reloadEmpty: number;
  adsTime: number;
  drawTime: number;
  holsterTime: number;
  /** World camera zoom while aiming (fov divisor). */
  zoom: number;
  pellets: number;
  /** Hip-fire cone half-angle in radians; ADS uses adsSpread. */
  spread: number;
  adsSpread: number;
  falloffStart: number;
  falloffEnd: number;
  /** Camera kick per shot (pitch, yaw) in radians, cycling; recovers 70% after firing stops. */
  recoil: readonly (readonly [number, number])[];
  /** Movement multiplier while holding this weapon. */
  moveScale: number;
  /** Seconds after a bolt/pump shot before the next one can fire (part of rpm). */
  cycle?: number;
  /** Burst fire: rounds per trigger pull (at rpm) and the pause before the next burst. */
  burst?: { count: number; pause: number };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  ar: {
    id: 'ar',
    name: 'Clicker AR',
    mode: 'auto',
    body: 22,
    head: 40,
    minDamage: 16,
    rpm: 560,
    mag: 30,
    reload: 1.9,
    reloadEmpty: 2.4,
    adsTime: 0.22,
    drawTime: 0.32,
    holsterTime: 0.2,
    zoom: 1.45,
    pellets: 1,
    spread: 0.022,
    adsSpread: 0.0025,
    falloffStart: 20,
    falloffEnd: 45,
    recoil: [
      [0.011, 0],
      [0.012, -0.002],
      [0.013, -0.003],
      [0.013, 0.002],
      [0.014, 0.004],
      [0.013, 0.005],
      [0.012, -0.003],
      [0.013, -0.005]
    ],
    moveScale: 0.95
  },
  shotgun: {
    id: 'shotgun',
    name: 'Snapgun',
    mode: 'pump',
    body: 16,
    head: 23,
    minDamage: 3,
    rpm: 70,
    mag: 6,
    reload: 0.5,
    reloadEmpty: 0.5,
    adsTime: 0.25,
    drawTime: 0.38,
    holsterTime: 0.24,
    zoom: 1.3,
    pellets: 8,
    spread: 0.06,
    adsSpread: 0.045,
    falloffStart: 12,
    falloffEnd: 25,
    recoil: [[0.05, 0.004]],
    moveScale: 0.92,
    cycle: 0.55
  },
  sniper: {
    id: 'sniper',
    name: 'Longstud',
    mode: 'bolt',
    body: 85,
    head: 150,
    minDamage: 65,
    rpm: 66,
    mag: 5,
    reload: 2.6,
    reloadEmpty: 3.2,
    adsTime: 0.32,
    drawTime: 0.45,
    holsterTime: 0.28,
    zoom: 8,
    pellets: 1,
    spread: 0.08,
    adsSpread: 0,
    falloffStart: 90,
    falloffEnd: 150,
    recoil: [[0.07, 0.004]],
    moveScale: 0.85,
    cycle: 0.8
  },
  pistol: {
    id: 'pistol',
    name: 'Peg Pistol',
    mode: 'semi',
    body: 28,
    head: 50,
    minDamage: 18,
    rpm: 400,
    mag: 12,
    reload: 1.4,
    reloadEmpty: 1.7,
    adsTime: 0.15,
    drawTime: 0.2,
    holsterTime: 0.14,
    zoom: 1.3,
    pellets: 1,
    spread: 0.018,
    adsSpread: 0.003,
    falloffStart: 15,
    falloffEnd: 35,
    recoil: [[0.02, 0.002]],
    moveScale: 1
  },
  nailer: {
    id: 'nailer',
    name: 'Nailer',
    mode: 'auto',
    body: 18,
    head: 30,
    minDamage: 11,
    rpm: 900,
    mag: 32,
    reload: 1.7,
    reloadEmpty: 2.1,
    adsTime: 0.17,
    drawTime: 0.28,
    holsterTime: 0.18,
    zoom: 1.3,
    pellets: 1,
    spread: 0.026,
    adsSpread: 0.006,
    falloffStart: 10,
    falloffEnd: 24,
    recoil: [
      [0.007, 0.001],
      [0.008, -0.002],
      [0.008, 0.003],
      [0.009, -0.003],
      [0.008, 0.004],
      [0.009, -0.004]
    ],
    moveScale: 1
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse Carbine',
    mode: 'burst',
    body: 26,
    head: 46,
    minDamage: 17,
    rpm: 900,
    mag: 24,
    reload: 2.0,
    reloadEmpty: 2.5,
    adsTime: 0.24,
    drawTime: 0.34,
    holsterTime: 0.2,
    zoom: 1.7,
    pellets: 1,
    spread: 0.02,
    adsSpread: 0.0008,
    falloffStart: 30,
    falloffEnd: 55,
    recoil: [
      [0.01, 0.001],
      [0.011, -0.002],
      [0.012, 0.002]
    ],
    moveScale: 0.95,
    burst: { count: 3, pause: 0.3 }
  },
  harpoon: {
    id: 'harpoon',
    name: 'Harpooner',
    mode: 'semi',
    body: 80,
    head: 160,
    minDamage: 55,
    rpm: 60,
    mag: 1,
    reload: 0.75,
    reloadEmpty: 0.75,
    adsTime: 0.28,
    drawTime: 0.4,
    holsterTime: 0.24,
    zoom: 2.6,
    pellets: 1,
    spread: 0.05,
    adsSpread: 0,
    falloffStart: 35,
    falloffEnd: 70,
    recoil: [[0.04, 0.003]],
    moveScale: 0.92
  },
  cannon: {
    id: 'cannon',
    name: 'Hand Cannon',
    mode: 'semi',
    body: 50,
    head: 90,
    minDamage: 26,
    rpm: 150,
    mag: 6,
    reload: 2.1,
    reloadEmpty: 2.1,
    adsTime: 0.18,
    drawTime: 0.26,
    holsterTime: 0.16,
    zoom: 1.35,
    pellets: 1,
    spread: 0.022,
    adsSpread: 0.002,
    falloffStart: 22,
    falloffEnd: 42,
    recoil: [[0.045, 0.004]],
    moveScale: 1
  },
  buzzer: {
    id: 'buzzer',
    name: 'Buzzer',
    mode: 'auto',
    body: 15,
    head: 24,
    minDamage: 9,
    rpm: 950,
    mag: 20,
    reload: 1.5,
    reloadEmpty: 1.8,
    adsTime: 0.14,
    drawTime: 0.18,
    holsterTime: 0.12,
    zoom: 1.25,
    pellets: 1,
    spread: 0.03,
    adsSpread: 0.011,
    falloffStart: 8,
    falloffEnd: 18,
    recoil: [
      [0.006, 0.003],
      [0.0065, -0.0035],
      [0.006, 0.0035],
      [0.0065, -0.003]
    ],
    moveScale: 1
  }
};

/** Guns held one-handed (pistol pose, pistol hand placement). */
export const SIDEARMS: ReadonlySet<WeaponId> = new Set(['pistol', 'cannon', 'buzzer']);

export const GRENADE = {
  name: 'Clack Bomb',
  fuse: 3,
  maxCook: 2.5,
  radius: 5,
  damage: 100,
  perLife: 2,
  /** The overhand throw's release speed, m/s (sim/grenades.ts THROW); the underhand lob's. */
  throwSpeed: 28,
  lobSpeed: 8
} as const;

export const MELEE_IDS = ['mallet', 'sword', 'knife', 'anchor', 'hatchet', 'wrench'] as const;
export type MeleeId = (typeof MELEE_IDS)[number];

export interface MeleeDef {
  id: MeleeId;
  name: string;
  /** Two hits kill from full health; a hit from behind kills outright. */
  damage: number;
  backstab: number;
  cooldown: number;
  range: number;
  /** Half-angle of the hit cone in radians. */
  arc: number;
  /** Seconds from press to the hit check. */
  windup: number;
}

/** Every swing kills in two; they trade reach for speed. */
export const MELEES: Record<MeleeId, MeleeDef> = {
  mallet: { id: 'mallet', name: 'Brick Mallet', damage: 55, backstab: 100, cooldown: 0.8, range: 2, arc: 0.6, windup: 0.12 },
  sword: { id: 'sword', name: 'Brick Blade', damage: 55, backstab: 100, cooldown: 0.9, range: 2.5, arc: 0.7, windup: 0.15 },
  knife: { id: 'knife', name: 'Snap Knife', damage: 50, backstab: 100, cooldown: 0.6, range: 1.7, arc: 0.5, windup: 0.105 },
  anchor: { id: 'anchor', name: 'Anchor', damage: 60, backstab: 100, cooldown: 0.95, range: 2.1, arc: 0.7, windup: 0.16 },
  hatchet: { id: 'hatchet', name: 'Hatchet', damage: 55, backstab: 100, cooldown: 0.75, range: 1.9, arc: 0.6, windup: 0.11 },
  wrench: { id: 'wrench', name: 'Torque Wrench', damage: 55, backstab: 100, cooldown: 0.8, range: 2, arc: 0.6, windup: 0.12 }
};
