export type WeaponId = 'ar' | 'shotgun' | 'sniper' | 'pistol';
export const WEAPON_IDS: readonly WeaponId[] = ['ar', 'shotgun', 'sniper', 'pistol'];

export type FireMode = 'auto' | 'pump' | 'bolt' | 'semi';

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
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  ar: {
    id: 'ar',
    name: 'Clicker AR',
    mode: 'auto',
    body: 22,
    head: 40,
    minDamage: 16,
    rpm: 660,
    mag: 30,
    reload: 1.9,
    reloadEmpty: 2.4,
    adsTime: 0.22,
    drawTime: 0.32,
    holsterTime: 0.2,
    zoom: 1.45,
    pellets: 1,
    spread: 0.022,
    adsSpread: 0.0015,
    falloffStart: 20,
    falloffEnd: 40,
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
    body: 14,
    head: 20,
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
    rpm: 45,
    mag: 5,
    reload: 2.6,
    reloadEmpty: 3.2,
    adsTime: 0.35,
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
    cycle: 1.1
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
  }
};

export const GRENADE = {
  name: 'Clack Bomb',
  fuse: 3,
  maxCook: 2.5,
  radius: 5,
  damage: 100,
  perLife: 2,
  throwSpeed: 17,
  lobSpeed: 8
} as const;

export const MELEE = {
  name: 'Brick Mallet',
  damage: 55,
  backstab: 100,
  cooldown: 0.8,
  range: 2,
  /** Half-angle of the hit cone in radians. */
  arc: 0.6,
  /** Seconds from press to the hit check. */
  windup: 0.12
} as const;
