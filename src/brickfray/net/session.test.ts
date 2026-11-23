import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapLayout } from '../world/types';

const layout: MapLayout = {
  id: 'plaza',
  bounds: { min: [-30, -2, -30], max: [30, 10, 30] },
  colliders: [{ min: [-30, -1, -30], max: [30, 0, 30], surface: 'plastic' }],
  spawns: Array.from({ length: 16 }, (_, i) => ({ position: [Math.cos(i) * 10, 0, Math.sin(i) * 10] as [number, number, number], yaw: 0, team: (i % 2) as 0 | 1 })),
  waypoints: [],
  killY: -5
};

vi.mock('../world', () => ({ MAPS: { plaza: { layout: () => layout }, fortress: { layout: () => layout }, docks: { layout: () => layout } } }));

const { HostSession } = await import('./host-session');
const { ClientSession } = await import('./client-session');
const { netConditions } = await import('./channel');
const { Predictor } = await import('../game/predictor');
const { CollisionWorld } = await import('../sim/collision');

// Virtual time: the host ticker, the link's latency and the test's own pacing share one clock, so a loaded machine
// can't stretch one against another. The channel's reliable-order clock is module state, so the fake clock runs on
// across the tests instead of restarting.
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);

/** A client resends its newest unacknowledged commands every frame: after the scripted input, keep doing so until the host has them all. */
async function settle(predictor: InstanceType<typeof Predictor>, client: InstanceType<typeof ClientSession>, last: number) {
  for (let i = 0; i < 120 && (client.snapshots.at(-1)?.ack ?? 0) < last; i++) {
    client.sendCommands(predictor.unacked(4));
    await wait(1000 / 60);
  }
  await wait(400);
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(() => {
  // The lossy lane drops and delays packets with Math.random: a fixed sequence plays the same run every time.
  let s = 12345;
  vi.spyOn(Math, 'random').mockImplementation(() => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296));
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(netConditions, { latency: 0, jitter: 0, loss: 0 });
});

describe('host and client over a lossy loopback', () => {
  it('predicts movement that matches the host after reconciliation', async () => {
    Object.assign(netConditions, { latency: 80, jitter: 20, loss: 0.1 });
    const host = new HostSession('solo', 'Host', { mode: 'ffa', map: 'plaza', minutes: 10, seats: 3, difficulty: 'normal' });
    await host.open();
    const client = new ClientSession(host.localChannel(), 'Me', 'vega', 'token-1');
    let started = false;
    client.listener.start = () => (started = true);
    await wait(150);
    host.start();
    await wait(300);
    expect(started).toBe(true);
    const predictor = new Predictor(new CollisionWorld(layout.colliders), client.you, 'vega');
    const first = client.snapshots.at(-1)!;
    predictor.reset(first.self!);
    const hooks = { fire() {}, melee() {}, grenade() {} };
    let seq = 0;
    for (let i = 0; i < 90; i++) {
      const cmd = { seq: ++seq, forward: 1, right: i > 45 ? 1 : 0, yaw: 0.3, pitch: 0, buttons: 0, slot: 0, viewTime: client.hostNow() - 0.1, life: 1 };
      predictor.apply(cmd, hooks);
      client.sendCommands(predictor.unacked(4));
      const snap = client.snapshots.at(-1);
      if (snap?.self) predictor.reconcile(snap.ack, snap.self);
      await wait(1000 / 60);
    }
    await settle(predictor, client, seq);
    const last = client.snapshots.at(-1)!;
    predictor.reconcile(last.ack, last.self!);
    const hostPlayer = host.match!.sim.players.get(client.you)!;
    expect(last.ack).toBe(seq);
    expect(Math.hypot(hostPlayer.move.x - predictor.player.move.x, hostPlayer.move.z - predictor.player.move.z)).toBeLessThan(0.05);
    expect(Math.hypot(hostPlayer.move.x, hostPlayer.move.z - 0)).toBeGreaterThan(3);
    expect(client.roster.size).toBe(3);
    host.close();
    client.dispose();
    Object.assign(netConditions, { latency: 0, jitter: 0, loss: 0 });
  }, 15000);

  it('a remote client predicts each grenade coming back on the same command as the host', async () => {
    Object.assign(netConditions, { latency: 80, jitter: 20, loss: 0 });
    const { BUTTON } = await import('../sim/types');
    const host = new HostSession('solo', 'Host', { mode: 'ffa', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' });
    await host.open();
    const client = new ClientSession(host.localChannel(), 'Me', 'vega', 'token-2');
    await wait(150);
    host.start();
    await wait(300);
    const hostPlayer = host.match!.sim.players.get(client.you)!;
    // A short refill (a per-player value, as solo upgrades set it) keeps the test quick; it travels in the snapshot.
    hostPlayer.arms.grenadeRefill = 1;
    await wait(200);
    const predictor = new Predictor(new CollisionWorld(layout.colliders), client.you, 'vega');
    predictor.reset(client.snapshots.at(-1)!.self!);
    expect(predictor.player.arms.grenadeRefill).toBe(1);
    const atHost = new Map<number, number>();
    const apply = host.match!.sim.applyCommand.bind(host.match!.sim);
    host.match!.sim.applyCommand = (id, cmd) => {
      apply(id, cmd);
      if (id === client.you) atHost.set(cmd.seq, hostPlayer.arms.grenades);
    };
    const predicted = new Map<number, number>();
    const hooks = { fire() {}, melee() {}, grenade() {} };
    for (let seq = 1; seq <= 150; seq++) {
      const press = seq <= 4 || (seq >= 34 && seq <= 37);
      const cmd = { seq, forward: 0, right: 0, yaw: 0, pitch: 0.3, buttons: press ? BUTTON.grenade : 0, slot: 0, viewTime: client.hostNow() - 0.1, life: predictor.player.life };
      predictor.apply(cmd, hooks);
      predicted.set(seq, predictor.player.arms.grenades);
      client.sendCommands(predictor.unacked(4));
      const snap = client.snapshots.at(-1);
      if (snap?.self) predictor.reconcile(snap.ack, snap.self);
      await wait(1000 / 60);
    }
    await settle(predictor, client, 150);
    expect(Math.min(...predicted.values())).toBe(0);
    expect(hostPlayer.arms.grenades).toBe(2);
    const mismatched = [...atHost].filter(([seq, n]) => predicted.get(seq) !== n);
    expect(atHost.size).toBeGreaterThan(140);
    expect(mismatched).toEqual([]);
    host.close();
    client.dispose();
    Object.assign(netConditions, { latency: 0, jitter: 0, loss: 0 });
  }, 15000);

  it('a client with magazine, reload and speed upgrades predicts its ammo and position like the host', async () => {
    Object.assign(netConditions, { latency: 80, jitter: 20, loss: 0.05 });
    const { BUTTON } = await import('../sim/types');
    const { takeUpgrade } = await import('../sim/upgrades');
    const host = new HostSession('solo', 'Host', { mode: 'ffa', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' });
    await host.open();
    const client = new ClientSession(host.localChannel(), 'Me', 'vega', 'token-3');
    await wait(150);
    host.start();
    await wait(300);
    const hostPlayer = host.match!.sim.players.get(client.you)!;
    for (const id of ['magazine', 'magazine', 'reload', 'reload', 'speed', 'speed'] as const) takeUpgrade(hostPlayer, id);
    hostPlayer.arms.ammo.ar = 5;
    await wait(200);
    const predictor = new Predictor(new CollisionWorld(layout.colliders), client.you, 'vega');
    predictor.reset(client.snapshots.at(-1)!.self!);
    expect(predictor.player.arms.reloadScale).toBe(hostPlayer.arms.reloadScale);
    const atHost = new Map<number, number>();
    const apply = host.match!.sim.applyCommand.bind(host.match!.sim);
    host.match!.sim.applyCommand = (id, cmd) => {
      apply(id, cmd);
      if (id === client.you) atHost.set(cmd.seq, hostPlayer.arms.ammo.ar);
    };
    const predicted = new Map<number, number>();
    const hooks = { fire() {}, melee() {}, grenade() {} };
    for (let seq = 1; seq <= 170; seq++) {
      const cmd = { seq, forward: 1, right: 0, yaw: 0.4, pitch: 0, buttons: seq <= 40 ? BUTTON.fire : 0, slot: 0, viewTime: client.hostNow() - 0.1, life: predictor.player.life };
      predictor.apply(cmd, hooks);
      predicted.set(seq, predictor.player.arms.ammo.ar);
      client.sendCommands(predictor.unacked(4));
      const snap = client.snapshots.at(-1);
      if (snap?.self) predictor.reconcile(snap.ack, snap.self);
      await wait(1000 / 60);
    }
    await settle(predictor, client, 170);
    const last = client.snapshots.at(-1)!;
    predictor.reconcile(last.ack, last.self!);
    // Vega's AR: 30 rounds, +40% and +30% = 51; the empty reload of 2.4 s runs 35% shorter.
    expect(Math.min(...predicted.values())).toBe(0);
    expect(hostPlayer.arms.ammo.ar).toBe(51);
    const mismatched = [...atHost].filter(([seq, n]) => predicted.get(seq) !== n);
    expect(atHost.size).toBeGreaterThan(150);
    expect(mismatched).toEqual([]);
    expect(Math.hypot(hostPlayer.move.x - predictor.player.move.x, hostPlayer.move.z - predictor.player.move.z)).toBeLessThan(0.05);
    host.close();
    client.dispose();
    Object.assign(netConditions, { latency: 0, jitter: 0, loss: 0 });
  }, 15000);
});
