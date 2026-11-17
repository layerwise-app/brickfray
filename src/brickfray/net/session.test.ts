import { describe, expect, it, vi } from 'vitest';
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('host and client over a lossy loopback', () => {
  it('predicts movement that matches the host after reconciliation', async () => {
    Object.assign(netConditions, { latency: 80, jitter: 20, loss: 0.1 });
    const host = new HostSession('solo', 'Host', { mode: 'ffa', map: 'plaza', minutes: 10, bots: 2 });
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
    await wait(400);
    const last = client.snapshots.at(-1)!;
    predictor.reconcile(last.ack, last.self!);
    const hostPlayer = host.match!.sim.players.get(client.you)!;
    expect(last.ack).toBeGreaterThan(80);
    expect(Math.hypot(hostPlayer.move.x - predictor.player.move.x, hostPlayer.move.z - predictor.player.move.z)).toBeLessThan(0.05);
    expect(Math.hypot(hostPlayer.move.x, hostPlayer.move.z - 0)).toBeGreaterThan(3);
    expect(client.roster.size).toBe(3);
    host.close();
    client.dispose();
    Object.assign(netConditions, { latency: 0, jitter: 0, loss: 0 });
  }, 15000);
});
