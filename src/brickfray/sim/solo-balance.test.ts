import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../characters/types';
import { MAPS } from '../world';
import type { MapId } from '../world/types';
import { WEAPONS } from '../weapons/defs';
import { fillMagazines, magSize } from './arms';
import { TICK } from './constants';
import type { HostSim } from './host';
import { Match } from './match';
import { BUTTON, DIFFICULTIES, type Command, type Difficulty, type GameEvent, type HostPlayer } from './types';
import { applyLevels, noUpgrades, UPGRADES, type UpgradeId } from './upgrades';

/** How a decent human plays the waves: reaction time, aim error (rad) that settles, how often they go for the head. */
interface Skill {
  reaction: number;
  error: number;
  settle: number;
  head: number;
}

export const SKILLS: Record<string, Skill> = {
  decent: { reaction: 0.25, error: 0.04, settle: 0.25, head: 0.3 },
  average: { reaction: 0.35, error: 0.07, settle: 0.4, head: 0.1 }
};

/**
 * A scripted player: holds roughly where it spawned and strafes, takes the nearest enemy in sight, turns onto it
 * after a reaction delay with an aim error that settles, fires on target, aims down sights at range, reloads in
 * lulls and backs off when hurt. It throws no grenades and uses no cover beyond what it stands near.
 */
export class Stand {
  private seq = 0;
  private target = 0;
  private seen = 0;
  private err: [number, number] = [0, 0];
  private aimHead = false;
  private strafe = 1;
  private strafeLeft = 0;
  private idle = 0;
  private home: [number, number] = [0, 0];
  private life = -1;
  private fired = false;
  /** The enemy being fought; the others are assumed to be behind the cover it holds. */
  get engaged() {
    return this.target;
  }

  constructor(private readonly sim: HostSim, private readonly me: HostPlayer, private readonly skill: Skill) {}

  command(): Command {
    const { sim, me, skill } = this;
    const cmd: Command = { seq: ++this.seq, forward: 0, right: 0, yaw: me.yaw, pitch: me.pitch, buttons: 0, slot: 0, viewTime: sim.time, life: me.life };
    if (!me.alive) return cmd;
    if (me.life !== this.life) {
      this.life = me.life;
      this.home = [me.move.x, me.move.z];
    }
    const eye = sim.eye(me);
    let best: HostPlayer | null = null;
    let bestD = Infinity;
    let bestScore = Infinity;
    for (const p of sim.players.values()) {
      if (!p.alive || !p.bot) continue;
      const d = Math.hypot(p.move.x - eye[0], p.move.z - eye[2]);
      // Stays on the enemy it is fighting unless another comes much closer, as a player finishes one before the next.
      const score = d - (p.id === this.target ? 8 : 0);
      if (score < bestScore && d < 70 && sim.world.clearLine(eye[0], eye[1], eye[2], p.move.x, p.move.y + 1.2 * p.scale, p.move.z)) {
        best = p;
        bestD = d;
        bestScore = score;
      }
    }
    const arms = me.arms;
    const def = WEAPONS[arms.weapon];
    if (!best) {
      this.target = 0;
      this.idle += TICK;
      if (arms.ammo[arms.weapon] < magSize(arms, arms.weapon) * 0.6) cmd.buttons |= BUTTON.reload;
      // Nothing in sight for a while: walk toward the nearest enemy, as a player hunting the last bots would.
      if (this.idle > 2.5) {
        const near = [...sim.players.values()].filter((p) => p.bot && p.alive).sort((a, b) => Math.hypot(a.move.x - me.move.x, a.move.z - me.move.z) - Math.hypot(b.move.x - me.move.x, b.move.z - me.move.z))[0];
        if (near) {
          cmd.yaw = Math.atan2(-(near.move.x - me.move.x), -(near.move.z - me.move.z));
          cmd.pitch = 0;
          cmd.forward = 1;
          if (Math.hypot(me.move.vx, me.move.vz) < 0.5 && this.idle > 3) cmd.buttons |= BUTTON.jump;
        }
      } else this.toward(cmd, this.home, 0.6);
      return cmd;
    }
    this.idle = 0;
    if (best.id !== this.target) {
      this.target = best.id;
      this.seen = 0;
      this.err = [(Math.random() - 0.5) * 2 * skill.error * 3, (Math.random() - 0.5) * skill.error * 3];
      this.aimHead = Math.random() < skill.head;
    }
    this.seen += TICK;
    const k = Math.exp(-TICK / skill.settle);
    this.err = [this.err[0] * k + (Math.random() - 0.5) * skill.error * 0.08, this.err[1] * k + (Math.random() - 0.5) * skill.error * 0.05];
    const y = best.move.y + (this.aimHead ? 1.6 : 1.2) * best.scale;
    const dx = best.move.x - eye[0];
    const dy = y - eye[1];
    const dz = best.move.z - eye[2];
    const wantYaw = Math.atan2(-dx, -dz) + this.err[0];
    const wantPitch = Math.atan2(dy, Math.hypot(dx, dz)) + this.err[1];
    if (this.seen > skill.reaction) {
      cmd.yaw = wantYaw;
      cmd.pitch = wantPitch;
      const onTarget = Math.abs(this.err[0]) < Math.atan2(0.3 * best.scale, bestD) + 0.01;
      const loaded = arms.ammo[arms.weapon] > 0;
      if (onTarget && loaded) {
        if (def.mode === 'auto' || !this.fired) cmd.buttons |= BUTTON.fire;
      }
      if (bestD > 12 && def.zoom > 1) cmd.buttons |= BUTTON.ads;
    }
    this.fired = (cmd.buttons & BUTTON.fire) !== 0;
    if (arms.ammo[arms.weapon] === 0) cmd.buttons |= BUTTON.reload;
    this.strafeLeft -= TICK;
    if (this.strafeLeft <= 0) {
      this.strafe = -this.strafe;
      this.strafeLeft = 0.5 + Math.random() * 0.6;
    }
    cmd.right = this.strafe * 0.8;
    const hurt = me.health + me.armor < me.maxHealth * 0.4;
    cmd.forward = hurt || bestD < 6 ? -0.8 : 0;
    // Stay near home: the strafe never wanders off a ledge for long.
    const away = Math.hypot(me.move.x - this.home[0], me.move.z - this.home[1]);
    if (away > 6) this.toward(cmd, this.home, 0.8);
    return cmd;
  }

  private toward(cmd: Command, at: [number, number], speed: number) {
    const m = this.me.move;
    const dx = at[0] - m.x;
    const dz = at[1] - m.z;
    if (Math.hypot(dx, dz) < 1) return;
    const yaw = Math.atan2(-dx, -dz) - cmd.yaw;
    cmd.forward = Math.cos(yaw) * speed;
    cmd.right = -Math.sin(yaw) * speed;
  }
}

/** What a sensible player takes first: survival, then killing faster. The stand-in never throws grenades. */
const PRIORITY: UpgradeId[] = ['armor', 'health', 'damage', 'regen', 'reload', 'magazine', 'speed', 'grenadeRefill', 'grenades'];

interface Run {
  wave: number;
  minutes: number;
  kills: number;
  picks: string;
  death: string;
  ended: boolean;
}

/**
 * A whole solo run with a bot brain at a fixed skill standing in for the player. `upgrades: false` takes the card and
 * then strips it again, so the run has the same breaks and refills but no upgrades.
 */
export function playRun(map: MapId, difficulty: Difficulty, character: CharacterId, skill: Skill, upgrades: boolean, cover: number, maxMinutes = 60): Run {
  const match = new Match(MAPS[map].layout(), { mode: 'solo', map, minutes: 0, seats: 0, difficulty });
  const me = match.addHuman('Sim', character);
  match.start();
  const player = new Stand(match.sim, me, skill);
  // Cover, modelled: a player fights one enemy at a time and reloads behind cover, so hits from the others, and any
  // hit during a reload, land at `cover` of their damage.
  const damage = match.sim.damage.bind(match.sim);
  match.sim.damage = (victim, amount, src) => {
    const exposed = victim !== me || src.attacker === me.id || (src.attacker === player.engaged && me.arms.reload <= 0);
    damage(victim, exposed ? amount : Math.round(amount * cover), src);
  };
  const picks: UpgradeId[] = [];
  const offered = (e: GameEvent): e is Extract<GameEvent, { type: 'upgradeOffer' }> => e.type === 'upgradeOffer' && e.player === me.id;
  let death = '';
  for (let t = 0; t < maxMinutes * 60 && match.state.phase !== 'ended'; t += TICK) {
    match.sim.applyCommand(me.id, player.command());
    match.tick(TICK);
    for (const e of match.sim.drain().events) {
      if (e.type === 'kill' && e.victim === me.id) death = `by ${match.sim.players.get(e.killer)?.bot ?? 'self'} ${e.weapon}`;
      if (!offered(e)) continue;
      const id = [...e.options].sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b))[0]!;
      match.pickUpgrade(me.id, id);
      if (upgrades) picks.push(id);
      else strip(me);
    }
  }
  return { wave: match.state.wave, minutes: Math.round(match.time / 6) / 10, kills: me.kills, picks: summarize(picks), death, ended: match.state.phase === 'ended' };
}

function strip(p: HostPlayer) {
  p.upgrades = noUpgrades();
  p.maxHealth = 100;
  p.health = Math.min(p.health, 100);
  p.armor = 0;
  applyLevels(p);
  fillMagazines(p.arms);
}

function summarize(picks: UpgradeId[]) {
  const counts = new Map<string, number>();
  for (const id of picks) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => `${id}${n}`).join(' ');
}

describe.runIf(process.env.BALANCE)('solo balance (BALANCE=1, slow)', () => {
  const runs = Number(process.env.RUNS ?? 4);
  const cover = Number(process.env.COVER ?? 0.35);
  // Exploration only: BOOST scales every upgrade step (grenade slots stay whole).
  const boost = Number(process.env.BOOST ?? 1);
  if (boost !== 1) for (const id of Object.keys(UPGRADES) as UpgradeId[]) if (id !== 'grenades') UPGRADES[id].steps = UPGRADES[id].steps.map((v) => (id === 'reload' ? Math.min(0.3, v * boost) : v * boost));
  const out = process.env.OUT;
  const skillName = process.env.SKILL ?? 'decent';
  const skill = SKILLS[skillName]!;
  const map = (process.env.MAP ?? 'plaza') as MapId;
  const character = (process.env.CHAR ?? 'vega') as CharacterId;
  const levels = (process.env.DIFF?.split(',') ?? DIFFICULTIES) as Difficulty[];
  it.each(levels)('%s: waves reached with and without upgrades', (difficulty) => {
    const table: string[] = [];
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const result: Record<string, number[]> = { with: [], without: [] };
    const unended: string[] = [];
    for (const upgrades of [false, true]) {
      for (let i = 0; i < runs; i++) {
        const r = playRun(map, difficulty, character, skill, upgrades, cover);
        result[upgrades ? 'with' : 'without']!.push(r.wave);
        if (!r.ended) unended.push(`${upgrades ? 'with' : 'without'} run ${i + 1}`);
        table.push(`${difficulty} ${upgrades ? 'with   ' : 'without'} run ${i + 1}: wave ${r.wave}, ${r.kills} kills, ${r.minutes} min, died ${r.death}; ${r.picks}`);
      }
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const range = (xs: number[]) => `mean ${mean(xs).toFixed(1)}, median ${median(xs)}, ${Math.min(...xs)}–${Math.max(...xs)}`;
    const summary = `${difficulty} ${map} ${character} ${skillName} cover ${cover}: wave reached without upgrades ${range(result.without!)}, with ${range(result.with!)}`;
    if (out) appendFileSync(out, [...table, summary, ''].join('\n'));
    console.log(summary);
    expect(unended).toEqual([]);
  });
});
