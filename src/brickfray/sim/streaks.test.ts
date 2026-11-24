import { describe, expect, it } from 'vitest';
import { ANNOUNCER_LINES, lineFor } from '../audio/announcer';
import type { MapLayout } from '../world/types';
import { TICK } from './constants';
import { Match } from './match';
import { BOUNTY, bountyFor, CHAIN_TOP, CHAIN_WINDOW, MAX_KILL_SCORE, Streaks } from './streaks';
import type { GameEvent, HostPlayer, ModeId } from './types';

function arena(): MapLayout {
  const spawns = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { position: [Math.cos(a) * 14, 0, Math.sin(a) * 14] as [number, number, number], yaw: 0, team: (i % 2) as 0 | 1 };
  });
  return {
    id: 'plaza',
    bounds: { min: [-20, -4, -20], max: [20, 10, 20] },
    colliders: [{ min: [-20, -1, -20], max: [20, 0, 20], surface: 'plastic' }],
    spawns,
    waypoints: [],
    killY: -0.8
  };
}

/** A room of humans past its warmup and their spawn protection. */
function room(mode: ModeId, names: string[]) {
  const match = new Match(arena(), { mode, map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' }, 7);
  const players = names.map((n) => match.addHuman(n, 'rivet'));
  match.start();
  run(match, 6);
  return { match, players };
}

function run(match: Match, seconds: number) {
  for (let t = 0; t < seconds; t += TICK) match.tick(TICK);
}

function kill(match: Match, killer: HostPlayer, victim: HostPlayer, kind: 'body' | 'head' = 'body') {
  match.sim.damage(victim, 1000, { attacker: killer.id, weapon: 'ar', kind, from: [0, 0, 0] });
}

const drained = (match: Match): GameEvent[] => match.sim.drain().events;
const chains = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'multikill' ? [[e.player, e.count]] : []));

function body(id: number, life = 1): HostPlayer {
  return { id, alive: true, life } as HostPlayer;
}

describe('bounty', () => {
  it('starts at the third kill of a streak, rises by a step a kill and stops at the cap', () => {
    expect([0, 1, 2, 3, 4, 5, 8, 9, 30].map(bountyFor)).toEqual([0, 0, 0, 25, 50, 75, 150, 150, 150]);
    expect(MAX_KILL_SCORE).toBe(150 + BOUNTY.cap);
  });

  it('is paid to the killer on top of the kill, and the victim’s streak starts over', () => {
    const { match, players } = room('ffa', ['A', 'B', 'C', 'D', 'E']);
    const [a, b, c, d, e] = players as [HostPlayer, HostPlayer, HostPlayer, HostPlayer, HostPlayer];
    for (const v of [b, c, d]) kill(match, a, v);
    expect(match.streaks.bounty(a.id)).toBe(25);
    kill(match, a, e);
    expect(match.streaks.bounty(a.id)).toBe(50);
    drained(match);
    run(match, 3.5);
    const before = b.score;
    kill(match, b, a, 'head');
    const paid = drained(match).find((x) => x.type === 'kill');
    expect(paid).toMatchObject({ killer: b.id, victim: a.id, bounty: 50 });
    expect(b.score - before).toBe(150 + 50);
    expect(match.streaks.bounty(a.id)).toBe(0);
  });

  it('reaches its cap on a long streak and goes no higher', () => {
    const { match, players } = room('tdm', ['A', 'B', 'C', 'D', 'E', 'F']);
    const a = players[0]!;
    const foes = players.filter((p) => p.team !== a.team);
    while (a.kills < 12) {
      for (const v of foes) kill(match, a, v);
      // Past the respawn and its protection.
      run(match, 5);
    }
    expect(a.deaths).toBe(0);
    expect(match.streaks.bounty(a.id)).toBe(BOUNTY.cap);
    const killer = players.find((p) => p.team !== a.team)!;
    const before = killer.score;
    kill(match, killer, a);
    expect(killer.score - before).toBe(100 + BOUNTY.cap);
  });

  it('is never paid in solo waves', () => {
    const streaks = new Streaks(false);
    const a = body(1);
    for (let i = 0; i < 6; i++) streaks.kill(i, body(10 + i), a);
    expect(streaks.bounty(a.id)).toBe(0);
    expect(streaks.kill(9, a, body(2)).bounty).toBe(0);
  });

  it('a death of one’s own doing pays nobody but still ends the streak', () => {
    const streaks = new Streaks(true);
    const a = body(1);
    for (let i = 0; i < 4; i++) streaks.kill(i * 10, body(10 + i), a);
    expect(streaks.bounty(1)).toBe(50);
    expect(streaks.kill(50, a, null)).toEqual({ bounty: 0, chain: 0 });
    expect(streaks.bounty(1)).toBe(0);
  });
});

describe('multi-kill chains', () => {
  it('each kill within the window of the one before extends the chain; a longer gap starts a new one', () => {
    const streaks = new Streaks(true);
    const a = body(1);
    const times = [0, 1, 1 + CHAIN_WINDOW, 1 + CHAIN_WINDOW * 2 - 0.01, 30, 30 + CHAIN_WINDOW + 0.01];
    expect(times.map((t, i) => streaks.kill(t, body(10 + i), a).chain)).toEqual([1, 2, 3, 4, 1, 1]);
  });

  it('a kill landed just after its maker died still counts; after the respawn a new chain starts', () => {
    const streaks = new Streaks(true);
    const a = body(1);
    streaks.kill(0, body(10), a);
    a.alive = false;
    streaks.kill(0.2, a, body(2));
    expect(streaks.kill(0.6, body(11), a).chain).toBe(2);
    expect(streaks.bounty(1)).toBe(0);
    a.alive = true;
    a.life = 2;
    expect(streaks.kill(3.8, body(12), a).chain).toBe(1);
  });

  it('the host sends one event per chained kill, after the kill, in every mode', () => {
    for (const mode of ['ffa', 'tdm'] as const) {
      const { match, players } = room(mode, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      const a = players[0]!;
      const foes = players.filter((p) => p !== a && (mode === 'ffa' || p.team !== a.team)).slice(0, 3);
      drained(match);
      for (const v of foes) {
        kill(match, a, v);
        run(match, 1);
      }
      const events = drained(match);
      expect(chains(events)).toEqual([
        [a.id, 2],
        [a.id, 3]
      ]);
      const last = events.map((e) => e.type).lastIndexOf('kill');
      expect(events[last + 1]).toMatchObject({ type: 'multikill', count: 3 });
    }
  });

  it('a chain of six counts on, while its fifth and sixth kills both get the five-kill call', () => {
    const { match, players } = room('ffa', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const a = players[0]!;
    drained(match);
    for (const v of players.slice(1, 7)) {
      kill(match, a, v);
      run(match, 1);
    }
    const counts = chains(drained(match)).map(([, n]) => n!);
    expect(counts).toEqual([2, 3, 4, 5, 6]);
    expect(CHAIN_TOP).toBe(5);
    expect(counts.map((n) => ANNOUNCER_LINES[lineFor(n)])).toEqual(['chain-2', 'chain-3', 'chain-4', 'chain-5', 'chain-5']);
  });

  it('solo waves chain too', () => {
    const match = new Match(arena(), { mode: 'solo', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' }, 7);
    const me = match.addHuman('Me', 'rivet');
    match.start();
    run(match, 6);
    const bots = [1, 2].map(() => {
      const b = match.sim.addPlayer('Snapbot', 'grunt', 'grunt');
      match.sim.spawn(b);
      return b;
    });
    drained(match);
    for (const b of bots) kill(match, me, b);
    expect(chains(drained(match))).toEqual([[me.id, 2]]);
  });
});
