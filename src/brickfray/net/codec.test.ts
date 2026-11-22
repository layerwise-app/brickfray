import { describe, expect, it } from 'vitest';
import { createArms } from '../sim/arms';
import type { Grenade } from '../sim/grenades';
import { createMoveState } from '../sim/movement';
import type { HostPlayer } from '../sim/types';
import { applyLevels, noUpgrades, takeUpgrade } from '../sim/upgrades';
import { Reader } from './bytes';
import { decodeSnapshot, encodeSnapshot, MELEE_SPAN, PACKET } from './codec';

function player(id: number): HostPlayer {
  return {
    id,
    name: 'P',
    character: 'rivet',
    bot: null,
    team: -1,
    move: createMoveState(1, 2, 3),
    yaw: 0,
    pitch: 0,
    arms: createArms(),
    health: 100,
    maxHealth: 100,
    alive: true,
    respawnAt: 0,
    protectedUntil: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    score: 0,
    ping: 0,
    damagers: new Map(),
    lastSeq: 0,
    life: 1,
    scale: 1,
    upgrades: noUpgrades(),
    armor: 0
  };
}

describe('snapshot codec', () => {
  it("carries the grenade refill and each live grenade's owner", () => {
    const me = player(3);
    me.arms.grenades = 1;
    me.arms.grenadeMax = 3;
    me.arms.grenadeRefill = 11;
    me.arms.grenadeTimer = 7.25;
    const other = player(9);
    const grenade: Grenade = { id: 41, owner: 9, x: 1, y: 2, z: 3, vx: 0, vy: 0, vz: 0, fuse: 2, bounces: 1, resting: false };
    const r = new Reader(encodeSnapshot(12.5, 77, me, [me, other], [grenade], []));
    expect(r.u8()).toBe(PACKET.snapshot);
    const snap = decodeSnapshot(r);
    expect(r.done).toBe(true);
    expect(snap.self!.arms).toMatchObject({ grenades: 1, grenadeMax: 3, grenadeRefill: 11, grenadeTimer: 7.25 });
    expect(snap.grenades).toEqual([{ id: 41, owner: 9, x: 1, y: 2, z: 3, bounces: 1, fuse: 2 }]);
    expect(snap.players.map((p) => p.id)).toEqual([3, 9]);
  });

  it('carries upgrade levels, max health and armour; the client rebuilds the same modifiers from the levels', () => {
    const me = player(3);
    for (const id of ['health', 'magazine', 'magazine', 'reload', 'speed', 'speed', 'armor'] as const) takeUpgrade(me, id);
    me.armor = 37.2;
    const r = new Reader(encodeSnapshot(1, 1, me, [me], [], []));
    r.u8();
    const self = decodeSnapshot(r).self!;
    expect(self).toMatchObject({ maxHealth: 140, armor: 38, upgrades: me.upgrades });
    expect([self.arms.magScale, self.arms.reloadScale, self.move.pace]).toEqual([me.arms.magScale, me.arms.reloadScale, me.move.pace]);
    expect(self.arms.ammo.ar).toBe(51);
    const fresh = player(4);
    fresh.upgrades = { ...me.upgrades };
    applyLevels(fresh);
    expect(fresh.arms.magScale).toBe(self.arms.magScale);
  });

  it("carries a remote's weapon switch, slide and melee swing", () => {
    const me = player(3);
    const other = player(9);
    other.arms.weapon = 'ar';
    other.arms.next = 'pistol';
    other.arms.switchTime = 0.1 + 0.2;
    other.move.slide = 0.3;
    other.arms.meleeTime = 0.3;
    const decode = () => {
      const r = new Reader(encodeSnapshot(1, 1, me, [me, other], [], []));
      r.u8();
      return decodeSnapshot(r).players.find((p) => p.id === 9)!;
    };
    let p = decode();
    expect(p.weapon).toBe('pistol');
    expect(p.sliding).toBe(true);
    expect(p.melee).toBeCloseTo(0.3 / MELEE_SPAN, 2);
    expect(p.swap).toBeGreaterThan(0.1);
    expect(p.swap).toBeLessThan(0.5);
    other.arms.weapon = 'pistol';
    other.arms.next = null;
    other.arms.switchTime = 0.05;
    p = decode();
    expect(p.swap).toBeGreaterThan(0.5);
    expect(p.swap).toBeLessThanOrEqual(1);
    other.arms.switchTime = 0;
    other.move.slide = 0;
    p = decode();
    expect(p.swap).toBe(-1);
    expect(p.sliding).toBe(false);
  });
});
