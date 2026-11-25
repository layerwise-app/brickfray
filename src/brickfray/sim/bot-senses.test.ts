import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../characters/types';
import type { MapLayout } from '../world/types';
import { believe, MEMORY, prune, type BeliefState } from './bot-belief';
import { BotDirector } from './bots';
import { TICK } from './constants';
import { HostSim } from './host';
import { BUTTON, type Command, type HostPlayer } from './types';

type Collider = MapLayout['colliders'][number];
const field = (walls: Collider[] = []): MapLayout => ({
  id: 'plaza',
  bounds: { min: [-90, -2, -90], max: [90, 12, 90] },
  colliders: [{ min: [-90, -1, -90], max: [90, 0, 90], surface: 'stone' }, ...walls],
  spawns: [],
  waypoints: [],
  killY: -5
});
const wall = (min: [number, number, number], max: [number, number, number]): Collider => ({ min, max, surface: 'stone' });
type Brain = BeliefState & { target: number; lostFor: number; hunt: number };
type Spot = [number, number, number];

/** A flat field with bots and players placed by hand; players do what `drive` tells them each tick (nothing by default). */
function scene(mode: 'ffa' | 'tdm' = 'ffa', walls: Collider[] = []) {
  const sim = new HostSim(field(walls), { mode, map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' }, 5);
  const bots = new BotDirector(sim);
  const brains = (bots as unknown as { brains: Map<number, Brain> }).brains;
  const drive = new Map<number, () => Partial<Command>>();
  const seqs = new Map<number, number>();
  const bot = (at: Spot, yaw = 0, character: CharacterId = 'vega', team: 0 | 1 | -1 = -1) => {
    const p = sim.addPlayer('Bot', character, 'grunt', team);
    sim.spawn(p, { position: at, yaw });
    p.protectedUntil = Infinity;
    bots.add(p);
    return p;
  };
  const player = (at: Spot, yaw = 0, team: 0 | 1 | -1 = -1) => {
    const p = sim.addPlayer('Me', 'vega', null, team);
    sim.spawn(p, { position: at, yaw });
    p.protectedUntil = Infinity;
    return p;
  };
  const step = () => {
    for (const [id, make] of drive) {
      const p = sim.players.get(id)!;
      const seq = (seqs.get(id) ?? 0) + 1;
      seqs.set(id, seq);
      sim.applyCommand(id, { seq, forward: 0, right: 0, yaw: p.yaw, pitch: 0, buttons: 0, slot: 0, viewTime: sim.time, life: p.life, ...make() });
    }
    bots.tick();
    sim.tick(TICK);
    sim.drain();
  };
  /** Run `secs`; returns the first host time `until` held, or null. */
  const run = (secs: number, until?: () => boolean) => {
    for (let t = 0; t < secs - 1e-9; t += TICK) {
      step();
      if (until?.()) return sim.time;
    }
    return null;
  };
  return { sim, bot, player, drive, run, brain: (p: HostPlayer) => brains.get(p.id)! };
}
const facing = (p: HostPlayer, yaw: number) => Math.abs(Math.atan2(Math.sin(p.yaw - yaw), Math.cos(p.yaw - yaw)));
const at = (angle: number, d: number): Spot => [-Math.sin(angle) * d, 0, -Math.cos(angle) * d];

describe('sight', () => {
  it('notices an enemy straight ahead after a human reaction time, never one behind it', () => {
    const ahead = scene();
    const b = ahead.bot([0, 0, 0]);
    const me = ahead.player(at(0, 15));
    const t = ahead.run(2, () => ahead.brain(b).target === me.id);
    expect(t).toBeGreaterThan(0.25);
    expect(t).toBeLessThan(0.7);
    const behind = scene();
    const b2 = behind.bot([0, 0, 0]);
    behind.player(at(Math.PI, 15));
    behind.run(5);
    expect(behind.brain(b2).target).toBe(0);
    expect(behind.brain(b2).beliefs.size).toBe(0);
  });

  it('takes longer at the edge of its view', () => {
    const time = (angle: number) => {
      const s = scene();
      const b = s.bot([0, 0, 0]);
      const me = s.player(at(angle, 15));
      return s.run(3, () => s.brain(b).target === me.id)!;
    };
    expect(time(0.7)).toBeGreaterThan(time(0) + 0.1);
  });

  it('a still, crouched figure at 30 m goes unnoticed where a standing one is seen; a wall hides anyone', () => {
    const crouched = scene();
    const b = crouched.bot([0, 0, 0]);
    const me = crouched.player(at(0, 30));
    me.move.crouch = 1;
    crouched.run(4);
    expect(crouched.brain(b).target).toBe(0);
    const standing = scene();
    const b2 = standing.bot([0, 0, 0]);
    const me2 = standing.player(at(0, 30));
    expect(standing.run(4, () => standing.brain(b2).target === me2.id)).not.toBeNull();
    const walled = scene('ffa', [wall([-3, 0, -9], [3, 3, -8])]);
    const b3 = walled.bot([0, 0, 0]);
    walled.player(at(0, 15));
    walled.run(4);
    expect(walled.brain(b3).target).toBe(0);
  });
});

describe('hearing', () => {
  it('hears steps behind it and turns to look after a moment, not at once; a crouched walk is silent', () => {
    const s = scene();
    const b = s.bot([0, 0, 0]);
    const me = s.player([6, 0, 12], Math.PI / 2);
    s.drive.set(me.id, () => ({ forward: 1 }));
    const heard = s.run(2, () => s.brain(b).beliefs.has(me.id))!;
    expect(heard).not.toBeNull();
    s.run(0.3);
    expect(facing(b, 0)).toBeLessThan(0.2);
    expect(s.run(3, () => s.brain(b).target === me.id)).not.toBeNull();
    expect(facing(b, 0)).toBeGreaterThan(1.5);

    const quiet = scene();
    const b2 = quiet.bot([0, 0, 0]);
    const me2 = quiet.player([6, 0, 12], Math.PI / 2);
    quiet.drive.set(me2.id, () => ({ forward: 1, buttons: BUTTON.crouch }));
    quiet.run(3);
    expect(quiet.brain(b2).beliefs.size).toBe(0);
    expect(facing(b2, 0)).toBeLessThan(0.05);
  });

  it('places a heard shot roughly: worse far off and through a wall', () => {
    const err = (d: number, walls: Collider[] = []) => {
      const s = scene('ffa', walls);
      const b = s.bot([0, 0, 0]);
      const me = s.player([0, 0, d], Math.PI);
      // One round, once the gun is out.
      let tick = 0;
      s.drive.set(me.id, () => ({ buttons: tick++ === 40 ? BUTTON.fire : 0 }));
      s.run(1.5, () => s.brain(b).beliefs.has(me.id));
      expect(me.arms.shots).toBe(1);
      return s.brain(b).beliefs.get(me.id)!.err;
    };
    const near = err(15);
    expect(near).toBeGreaterThan(1);
    expect(err(60)).toBeGreaterThan(near * 2);
    expect(err(15, [wall([-4, 0, 7], [4, 4, 8])])).toBeGreaterThan(near * 1.5);
  });
});

describe('being hit', () => {
  it('tells the direction, not the shooter: it turns after a moment, then finds and fights it', () => {
    const s = scene();
    const b = s.bot([0, 0, 0]);
    b.protectedUntil = 0;
    const me = s.player([0, 0, 15]);
    s.run(0.2);
    s.sim.damage(b, 10, { attacker: me.id, weapon: 'ar', kind: 'body', from: s.sim.eye(me) });
    s.run(0.15);
    expect(s.brain(b).target).toBe(0);
    expect(facing(b, 0)).toBeLessThan(0.2);
    expect(s.brain(b).beliefs.get(me.id)!.seen).toBe(false);
    expect(s.run(2.5, () => s.brain(b).target === me.id)).not.toBeNull();
    s.run(0.5);
    expect(facing(b, Math.PI)).toBeLessThan(0.35);
  });
});

describe('team calls', () => {
  it('pass what one bot sees to its teammates late and rough', () => {
    const s = scene('tdm');
    const a = s.bot([0, 0, 0], 0, 'vega', 0);
    const mate = s.bot([45, 0, 45], -Math.PI / 2, 'vega', 0);
    const enemy = s.player(at(0, 15), 0, 1);
    const seen = s.run(2, () => s.brain(a).target === enemy.id)!;
    expect(seen).not.toBeNull();
    const told = s.run(3, () => s.brain(mate).beliefs.has(enemy.id))!;
    expect(told - seen).toBeGreaterThan(0.9);
    const bel = s.brain(mate).beliefs.get(enemy.id)!;
    expect(bel.seen).toBe(false);
    expect(Math.hypot(bel.at[0] - enemy.move.x, bel.at[2] - enemy.move.z)).toBeLessThan(4.5);
  });
});

describe('memory', () => {
  it('fades: dropped after a while without news, or once the kill feed shows the enemy died', () => {
    const b: BeliefState = { beliefs: new Map(), glance: null };
    believe(b, 7, 1, [10, 0, 0], 5, 0, 0, false);
    prune(b, MEMORY - 1, () => 1);
    expect(b.beliefs.has(7)).toBe(true);
    prune(b, MEMORY + 0.1, () => 1);
    expect(b.beliefs.has(7)).toBe(false);
    believe(b, 7, 1, [10, 0, 0], 5, 0, 0, false);
    prune(b, 1, () => 2);
    expect(b.beliefs.has(7)).toBe(false);
  });

  it('weighs news: two hearings narrow the spot, a hearing does not move a fresh sighting', () => {
    const b: BeliefState = { beliefs: new Map(), glance: null };
    believe(b, 7, 1, [10, 0, 0], 6, 0, 0, false, false, 20);
    believe(b, 7, 1, [14, 0, 0], 6, 0.1, 0, false, false, 20);
    expect(b.beliefs.get(7)!.err).toBeLessThan(6);
    expect(b.beliefs.get(7)!.at[0]).toBeGreaterThan(11);
    believe(b, 8, 1, [0, 0, 5], 0.3, 1, 1, true);
    believe(b, 8, 1, [6, 0, 9], 4, 1.2, 1, false);
    expect(b.beliefs.get(8)!.at).toEqual([0, 0, 5]);
  });

  it('gives up a believed spot it looks at and finds empty', () => {
    const s = scene('ffa', [wall([20, 0, -30], [30, 4, 30])]);
    const b = s.bot([0, 0, 0]);
    const me = s.player([40, 0, 0]);
    s.brain(b).beliefs.set(me.id, { at: [0, 0, -10], err: 3, time: -1, act: -1, life: me.life, seen: false, fired: -Infinity });
    s.run(0.6);
    expect(s.brain(b).beliefs.has(me.id)).toBe(false);
  });
});
