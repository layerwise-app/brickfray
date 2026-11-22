import { MELEES, WEAPONS, type WeaponId } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import { aimDirection } from './arms';
import { damageAt, headCenterY, rayHitPlayer } from './hitboxes';
import type { HostSim, PoseRecord } from './host';
import type { HitKind, HostPlayer, PlayerState, ShotTrace } from './types';

/** Bots hit humans for less, by gun, swing or grenade alike (solo scales it wave by wave). */
export function botScale(sim: HostSim, attacker: PlayerState | null | undefined, victim: PlayerState) {
  return attacker?.bot && !victim.bot ? sim.botDamage : 1;
}

/**
 * Solo only, a player's slow one-at-a-time guns hit snapbots harder (a Megabot harder still), so those kits hold up
 * against a crowd as the fast guns do. Rooms keep the guns as they are.
 */
const SOLO_KIT: Partial<Record<WeaponId, number>> = { harpoon: 1.3, sniper: 1.25, shotgun: 1.15, cannon: 1.15, buzzer: 1.3 };
const SOLO_KIT_BOSS = 1.5;

function soloKit(sim: HostSim, shooter: PlayerState, victim: PlayerState, weapon: WeaponId) {
  const kit = sim.settings.mode === 'solo' && !shooter.bot && victim.bot ? SOLO_KIT[weapon] : undefined;
  return kit ? kit * (victim.bot === 'boss' ? SOLO_KIT_BOSS : 1) : 1;
}

/** A shot as the shooter saw the world (rewound by their view time): traces for everyone, damage per victim. */
export function resolveShot(sim: HostSim, shooter: PlayerState, weapon: WeaponId, dirs: [number, number, number][], viewTime: number) {
  const def = WEAPONS[weapon];
  const t = sim.rewindTime(viewTime);
  const origin = sim.eye(shooter);
  const trace: ShotTrace = { shooter: shooter.id, weapon, origin, ends: [] };
  const totals = new Map<number, { amount: number; head: boolean }>();
  const poses = new Map<number, PoseRecord>();
  for (const p of sim.players.values()) {
    if (p.alive && p.id !== shooter.id) {
      const pose = sim.poseAt(p, t);
      if (pose?.alive) poses.set(p.id, pose);
    }
  }
  for (const d of dirs) {
    const wall = sim.world.raycast(origin[0], origin[1], origin[2], d[0], d[1], d[2], 260, true);
    let maxT = wall?.t ?? 260;
    let victim: HostPlayer | null = null;
    let kind: HitKind = 'body';
    for (const [id, pose] of poses) {
      const hit = rayHitPlayer(pose, origin[0], origin[1], origin[2], d[0], d[1], d[2], maxT);
      if (hit) {
        maxT = hit.t;
        victim = sim.players.get(id)!;
        kind = hit.kind;
      }
    }
    const point: [number, number, number] = [origin[0] + d[0] * maxT, origin[1] + d[1] * maxT, origin[2] + d[2] * maxT];
    trace.ends.push({ point, surface: victim ? 'body' : (wall?.surface ?? 'none'), hitPlayer: victim?.id ?? 0, normal: victim ? [-d[0], -d[1], -d[2]] : (wall?.normal ?? [0, 1, 0]) });
    if (victim && sim.hostile(shooter, victim)) {
      const full = kind === 'head' ? def.head : def.body;
      const min = def.minDamage * (full / def.body);
      const amount = damageAt(maxT, full, min, def.falloffStart, def.falloffEnd) * botScale(sim, shooter, victim) * soloKit(sim, shooter, victim, weapon);
      const entry = totals.get(victim.id) ?? { amount: 0, head: false };
      entry.amount += amount;
      entry.head ||= kind === 'head';
      totals.set(victim.id, entry);
    }
  }
  sim.traces.push(trace);
  for (const [id, { amount, head }] of totals) {
    const victim = sim.players.get(id);
    if (victim) sim.damage(victim, Math.round(amount), { attacker: shooter.id, weapon, kind: head ? 'head' : 'body', from: origin });
  }
}

/** The swing hits the nearest enemy in reach and in front (a hit from behind is a backstab), else reports what wall it struck. */
export function resolveMelee(sim: HostSim, attacker: PlayerState, viewTime: number) {
  const t = sim.rewindTime(viewTime);
  const eye = sim.eye(attacker);
  const fwd = aimDirection(attacker.yaw, 0);
  let best: HostPlayer | null = null;
  const melee = MELEES[LOADOUTS[attacker.character].melee];
  let bestD = melee.range + 0.4;
  for (const p of sim.players.values()) {
    if (!p.alive || !sim.hostile(attacker, p)) continue;
    const pose = sim.poseAt(p, t);
    if (!pose?.alive) continue;
    const dx = pose.x - eye[0];
    const dz = pose.z - eye[2];
    const d = Math.hypot(dx, dz);
    const dy = headCenterY(pose) - 0.5 - eye[1];
    if (d > bestD || Math.abs(dy) > 1.4) continue;
    const cos = (dx * fwd[0] + dz * fwd[2]) / Math.max(d, 1e-4);
    if (d > 0.5 && cos < Math.cos(melee.arc)) continue;
    best = p;
    bestD = d;
  }
  if (!best) {
    const aim = aimDirection(attacker.yaw, attacker.pitch);
    const struck = sim.world.raycast(eye[0], eye[1], eye[2], aim[0], aim[1], aim[2], melee.range, true);
    const wall = struck && { surface: struck.surface, at: [eye[0] + aim[0] * struck.t, eye[1] + aim[1] * struck.t, eye[2] + aim[2] * struck.t] as [number, number, number] };
    sim.events.push({ type: 'melee', player: attacker.id, hit: false, ...(wall ? { wall } : {}) });
    return;
  }
  sim.events.push({ type: 'melee', player: attacker.id, hit: true });
  const toVictim = Math.atan2(-(best.move.x - attacker.move.x), -(best.move.z - attacker.move.z));
  const facing = Math.cos(best.yaw - toVictim);
  // Victim facing away from the attacker: their forward points along attacker→victim.
  const backstab = facing > 0.5;
  const amount = (backstab ? melee.backstab : melee.damage) * botScale(sim, attacker, best);
  sim.damage(best, Math.round(amount), { attacker: attacker.id, weapon: melee.id, kind: 'body', from: eye });
}