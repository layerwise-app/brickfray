import type { BotKind, CharacterId } from './types';
import { smooth, window4 } from './ik';

export type FidgetKind = 'hat' | 'bounce' | 'straighten' | 'tapGlass' | 'beard' | 'wrist' | 'scan' | 'twitch' | 'lens' | 'stomp';

export interface DangleSpec {
  /** Points up (antenna, plume) instead of hanging. */
  up?: boolean;
  k: number;
  damping: number;
  /** 0 keeps the rest angle relative to the parent, 1 hangs straight down. */
  hang: number;
  /** Radians of trail per m/s of movement. */
  drag: number;
  inertia: number;
  rest: [number, number];
  limit: number;
}

/** How a character carries itself; multipliers default to 1, angles in radians. */
export interface Style {
  stance: number;
  stride: number;
  sway: number;
  bob: number;
  bounce: number;
  lift: number;
  lean: number;
  /** Chest out / shoulders back. */
  posture: number;
  /** Head and neck forward. */
  hunch: number;
  shoulderRoll: number;
  elbows: number;
  /** Extra knee bend at rest, meters of pelvis drop. */
  knees: number;
  toeOut: number;
  fidget: FidgetKind;
  fidgetLength: number;
  dangleHead?: DangleSpec;
  dangleBack?: DangleSpec;
  /** Cloth hanging from the belt, front and back. */
  dangleHip?: DangleSpec;
}

const base: Style = {
  stance: 1,
  stride: 1,
  sway: 1,
  bob: 1,
  bounce: 0,
  lift: 1,
  lean: 0,
  posture: 0,
  hunch: 0,
  shoulderRoll: 1,
  elbows: 1,
  knees: 0,
  toeOut: 0.12,
  fidget: 'scan',
  fidgetLength: 1.8
};

const hair: DangleSpec = { k: 70, damping: 7, hang: 0.85, drag: 0.07, inertia: 0.035, rest: [0.15, 0], limit: 1.1 };
const cloth: DangleSpec = { k: 45, damping: 6, hang: 0.9, drag: 0.1, inertia: 0.03, rest: [0.1, 0], limit: 1.2 };
const stalk: DangleSpec = { up: true, k: 160, damping: 9, hang: 0.25, drag: 0.04, inertia: 0.02, rest: [0, 0], limit: 0.6 };

export const STYLES: Record<CharacterId | BotKind, Style> = {
  rivet: { ...base, stance: 1.25, sway: 1.6, bob: 1.15, lift: 0.95, posture: 0.04, shoulderRoll: 1.9, elbows: 1.4, knees: 0.012, toeOut: 0.22, fidget: 'hat', fidgetLength: 2.2 },
  vega: { ...base, stance: 0.9, stride: 1.05, sway: 0.8, bob: 1.1, bounce: 1, lift: 1.2, lean: 0.05, shoulderRoll: 0.6, elbows: 0.8, toeOut: 0.05, fidget: 'bounce', fidgetLength: 1.6, dangleHead: hair, dangleBack: { ...cloth, drag: 0.14 } },
  clack: { ...base, stride: 0.95, sway: 0.6, bob: 0.8, lift: 0.9, lean: -0.03, posture: 0.12, hunch: -0.06, shoulderRoll: 0.3, elbows: 1.15, toeOut: 0.16, fidget: 'straighten', fidgetLength: 2, dangleHead: { ...stalk, k: 90, damping: 6, hang: 0.4, drag: 0.06 }, dangleHip: { ...cloth, k: 60, damping: 7, hang: 0.5, drag: 0.1, inertia: 0.05, rest: [0, 0] } },
  coral: { ...base, stance: 1.2, stride: 0.9, sway: 1.25, bob: 1.3, lift: 0.7, lean: 0.07, hunch: 0.04, elbows: 1.3, knees: 0.03, toeOut: 0.18, fidget: 'tapGlass', fidgetLength: 1.9 },
  moss: { ...base, stance: 1.05, stride: 0.98, sway: 0.9, bob: 0.8, lift: 0.85, lean: 0.07, posture: -0.03, hunch: 0.07, shoulderRoll: 0.5, knees: 0.03, toeOut: 0.1, fidget: 'beard', fidgetLength: 2.4, dangleBack: { ...cloth, k: 30, drag: 0.08 } },
  nova: { ...base, stance: 1.1, stride: 1.05, sway: 0.8, bob: 1.3, bounce: 0.6, lift: 1.1, posture: 0.02, shoulderRoll: 0.5, elbows: 1.2, knees: 0.01, fidget: 'wrist', fidgetLength: 2.2, dangleHead: stalk },
  grunt: { ...base, stance: 1.1, stride: 0.95, sway: 0.5, bob: 0.7, shoulderRoll: 0.4, elbows: 1.2, toeOut: 0.08, fidget: 'scan', fidgetLength: 2 },
  rusher: { ...base, stance: 1.05, stride: 1.08, sway: 0.7, bob: 1.2, bounce: 0.4, lift: 1.15, lean: 0.2, hunch: 0.14, elbows: 1.4, knees: 0.04, fidget: 'twitch', fidgetLength: 1.2 },
  sniper: { ...base, stance: 0.9, stride: 1.1, sway: 0.6, bob: 0.8, posture: 0.05, elbows: 0.9, toeOut: 0.06, fidget: 'lens', fidgetLength: 1.8, dangleHead: { ...stalk, k: 120 } },
  boss: { ...base, stance: 1.3, stride: 0.95, sway: 1.4, bob: 1.4, lift: 0.85, lean: 0.04, posture: 0.06, shoulderRoll: 1.4, elbows: 1.5, knees: 0.03, toeOut: 0.2, fidget: 'stomp', fidgetLength: 1.6 }
};

export interface FidgetFrame {
  /** Left hand target (head- or chest-local) and its weight. */
  handSpace: 'head' | 'chest';
  hand: [number, number, number];
  handW: number;
  head: [number, number, number];
  chest: [number, number, number];
  pelvisY: number;
  heel: number;
  hat: [number, number];
  gunDrop: number;
}

export function emptyFidget(): FidgetFrame {
  return { handSpace: 'head', hand: [0, 0, 0], handW: 0, head: [0, 0, 0], chest: [0, 0, 0], pelvisY: 0, heel: 0, hat: [0, 0], gunDrop: 0 };
}

/** Additive idle fidget at normalized time t (0…1). Head/chest are [pitch, heading, roll]. */
export function fidgetAt(kind: FidgetKind, t: number, f: FidgetFrame) {
  const w = window4(t, 0, 0.18, 0.78, 1);
  f.handW = 0;
  f.head = [0, 0, 0];
  f.chest = [0, 0, 0];
  f.pelvisY = 0;
  f.heel = 0;
  f.hat = [0, 0];
  f.gunDrop = 0;
  const pulse = (a: number, b: number) => window4(t, a, (a + b) / 2, (a + b) / 2, b);
  switch (kind) {
    case 'hat': {
      f.handSpace = 'head';
      f.hand = [-0.06, 0.2, -0.15];
      f.handW = w;
      f.gunDrop = w * 0.6;
      const lift = pulse(0.3, 0.75);
      f.hat = [0.035 * lift, -0.25 * lift];
      f.head = [-0.12 * w + 0.08 * pulse(0.6, 0.9), -0.15 * w, 0.06 * w];
      f.chest = [0.04 * w, 0.06 * w, 0.03 * w];
      break;
    }
    case 'bounce': {
      const b = Math.max(0, Math.sin(t * Math.PI * 6)) * w;
      f.heel = b;
      f.pelvisY = 0.05 * b;
      f.head = [0.04 * b, 0.2 * Math.sin(t * Math.PI * 2) * w, 0];
      f.chest = [0.03 * b, 0, 0.04 * Math.sin(t * Math.PI * 3) * w];
      break;
    }
    case 'straighten': {
      f.chest = [0.14 * w, 0, 0];
      f.head = [0.18 * w, 0.1 * pulse(0.3, 0.9), 0];
      f.pelvisY = 0.02 * w;
      break;
    }
    case 'tapGlass': {
      f.handSpace = 'head';
      f.hand = [-0.02, 0.1, -0.24 + 0.02 * Math.sin(t * Math.PI * 14) * pulse(0.35, 0.7)];
      f.handW = w;
      f.gunDrop = w * 0.5;
      f.head = [-0.1 * w, 0.25 * pulse(0.5, 1), 0];
      break;
    }
    case 'beard': {
      f.handSpace = 'head';
      f.hand = [0.0, -0.06 - 0.04 * Math.sin(t * Math.PI * 4) * w, -0.17];
      f.handW = w;
      f.gunDrop = w * 0.55;
      f.head = [-0.12 * w, -0.1 * w, 0.08 * w];
      break;
    }
    case 'wrist': {
      f.handSpace = 'chest';
      f.hand = [-0.02, 0.12, -0.3];
      f.handW = w;
      f.gunDrop = w * 0.45;
      f.head = [-0.45 * smooth(t, 0.15, 0.35) * w, -0.25 * w, 0];
      break;
    }
    case 'scan': {
      const step = Math.round(Math.sin(t * Math.PI * 2) * 4) / 4;
      f.head = [0, 0.6 * step * w, 0];
      f.chest = [0, 0.12 * step * w, 0];
      break;
    }
    case 'twitch': {
      const j = Math.sin(t * 47) * Math.sin(t * 13) * w;
      f.head = [0.1 * j, 0.3 * j, 0.25 * pulse(0.2, 0.6)];
      f.chest = [0, 0, 0.15 * pulse(0.3, 0.7)];
      break;
    }
    case 'lens': {
      f.head = [0.05 * w, 0, 0.35 * pulse(0.15, 0.55) - 0.3 * pulse(0.5, 0.9)];
      break;
    }
    case 'stomp': {
      const s = pulse(0.35, 0.6);
      f.pelvisY = -0.06 * s + 0.03 * pulse(0.15, 0.35);
      f.chest = [-0.12 * s, 0, 0.12 * pulse(0.1, 0.4) - 0.12 * pulse(0.5, 0.85)];
      f.head = [-0.05 * s, 0, 0];
      break;
    }
  }
}
