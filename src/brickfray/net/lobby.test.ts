import { describe, expect, it, vi } from 'vitest';

vi.mock('../world', () => ({ MAPS: {} }));

const { HostSession } = await import('./host-session');
const { ClientSession } = await import('./client-session');

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('room size', () => {
  it('never drops below the players in the room, whether they join or the host slides it', async () => {
    const host = new HostSession('solo', 'Host', { mode: 'ffa', map: 'plaza', minutes: 5, seats: 1, difficulty: 'normal' });
    await host.open();
    const a = new ClientSession(host.localChannel(), 'A', 'vega', 'token-a');
    const b = new ClientSession(host.localChannel(), 'B', 'rivet', 'token-b');
    await wait(150);
    expect(host.lobby.players).toHaveLength(2);
    expect(host.lobby.settings.seats).toBe(2);
    host.setSettings({ seats: 1 });
    expect(host.lobby.settings.seats).toBe(2);
    host.setSettings({ seats: 6 });
    expect(host.lobby.settings.seats).toBe(6);
    host.close();
    a.dispose();
    b.dispose();
  });
});
