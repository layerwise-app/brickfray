import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import ts from 'typescript';

class Connection extends EventEmitter {
  open = true;
  sent = [];
  constructor(peer) { super(); this.peer = peer; }
  send(message) { this.sent.push(message); }
  close() { if (!this.open) return; this.open = false; this.emit('close'); }
}

class Peer extends EventEmitter {
  static instances = [];
  destroyed = false;
  connections = [];
  constructor(id) {
    super();
    this.id = typeof id === 'string' ? id : `guest-${Peer.instances.length}`;
    Peer.instances.push(this);
  }
  connect(id) { const connection = new Connection(id); this.connections.push(connection); return connection; }
  destroy() { this.destroyed = true; this.connections.forEach((connection) => connection.close()); }
}

globalThis.__OnlineTestPeer = Peer;
Object.defineProperties(globalThis, {
  location: { configurable: true, value: { hostname: '127.0.0.1', search: '' } },
  localStorage: { configurable: true, value: { getItem: () => null } },
});
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'peerjs') return { url: 'data:text/javascript,export default globalThis.__OnlineTestPeer', shortCircuit: true };
    if (specifier.startsWith('.') && !extname(specifier) && context.parentURL?.includes('/src/game/')) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.includes('/src/game/') && url.endsWith('.ts')) {
      return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
    }
    return next(url, context);
  },
});

const { Net } = await import('../src/game/net/net.ts');
const { LobbySession } = await import('../src/game/session/lobby.ts');
const { Online } = await import('../src/game/session/online.ts');
const latestPeer = () => Peer.instances.at(-1);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fixture(net = {}) {
  const events = new Map();
  const statuses = [];
  let renders = 0;
  const session = {
    net: { on: (type, fn) => events.set(type, fn), leave() {}, maxPlayers: 10, ...net },
    ctx: { hud: {}, player: {} }, game: { state: 'start' },
    lobby: { players: new Map(), status: '', isPublic: false },
    prefs: { name: 'Doodle42', map: 'district' }, remote: new Map(), scores: new Map(),
    signal: new AbortController().signal, screen: 'online',
  };
  const deps = {
    ui: { setStatus: (...args) => statuses.push(args), showStart: () => renders++, renderLobby() {} },
    run: {}, scoreboard: {}, admitLateJoiner() {},
  };
  return { session, deps, events, statuses, renders: () => renders };
}

test('cancel destroys a peer still waiting for signaling', async () => {
  const net = new Net();
  const pending = net.host({ code: 'ABCDE' });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  const peer = latestPeer();
  net.leave();
  await rejected;
  assert.equal(peer.destroyed, true);
  assert.equal(net.active, false);
});

test('canceling a resolved old host cannot overwrite a newer attempt', async () => {
  const net = new Net();
  const old = net.host({ isPublic: true });
  const rejected = assert.rejects(old, { name: 'AbortError' });
  const oldPeer = latestPeer();
  oldPeer.emit('open');
  net.leave();
  const current = net.host({ code: 'HJKLM' });
  latestPeer().emit('open');
  await rejected;
  assert.equal(await current, 'HJKLM');
  assert.equal(net.code, 'HJKLM');
  assert.equal(net.active, true);
  assert.equal(oldPeer.destroyed, true);
  net.leave();
});

for (const operation of ['join', 'quickJoin']) {
  test(`cancel ${operation} during connection attempts without affecting a retry`, async () => {
    const net = new Net();
    const pending = operation === 'join' ? net.join('ABCDE') : net.quickJoin();
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    const peer = latestPeer();
    peer.emit('open');
    await setImmediate();
    assert.ok(peer.connections.length > 0);
    net.leave();
    const current = net.host({ code: 'HJKLM' });
    latestPeer().emit('open');
    await rejected;
    await current;
    assert.ok(peer.connections.every((connection) => !connection.open));
    assert.equal(net.active, true);
    assert.equal(net.code, 'HJKLM');
    net.leave();
  });
}

test('canceling Quick Play prevents fallback room creation and late status updates', async () => {
  const request = deferred();
  let createCalls = 0, onStatus;
  const f = fixture({ quickJoin: (_, status) => { onStatus = status; return request.promise; }, host: async () => { createCalls++; } });
  const lobby = new LobbySession(f.session, f.deps);
  const pending = lobby.quickPlay();
  lobby.cancelConnection();
  onStatus('stale status');
  request.reject(new Error('no open public lobbies'));
  await pending;
  assert.equal(createCalls, 0);
  assert.equal(f.statuses.length, 0);
  assert.equal(f.renders(), 0);
  assert.equal(f.session.game.state, 'start');
});

test('a stale create result cannot enter a room or disturb a new attempt', async () => {
  const old = deferred(), current = deferred();
  let calls = 0;
  const f = fixture({ host: () => ++calls === 1 ? old.promise : current.promise });
  const lobby = new LobbySession(f.session, f.deps);
  const first = lobby.createLobby(false);
  lobby.cancelConnection();
  const second = lobby.createLobby(true);
  old.resolve('ABCDE');
  await first;
  assert.equal(f.renders(), 0);
  f.session.net.id = 'host';
  current.resolve('PUB0');
  await second;
  assert.equal(f.renders(), 1);
  assert.equal(f.session.game.state, 'lobby');
  assert.equal(f.session.lobby.isPublic, true);
});

test('joining an active match preserves its start screen instead of returning to the lobby', async () => {
  const f = fixture({ join: async () => { f.session.game.state = 'play'; } });
  const lobby = new LobbySession(f.session, f.deps);
  await lobby.joinLobby('ABCDE');
  assert.equal(f.session.game.state, 'play');
  assert.equal(f.renders(), 0);
});

test('only the host in a waiting room can start, and remote start requests are ignored', () => {
  const f = fixture();
  const online = new Online(f.session, { ...f.deps, focus: {}, props: {}, combat: {}, pickups: {} });
  assert.equal(f.events.has('startreq'), false);
  f.session.game.state = 'lobby';
  f.session.net.isHost = false;
  assert.doesNotThrow(() => online.hostStart());
  f.session.net.isHost = true;
  f.session.game.state = 'play';
  assert.doesNotThrow(() => online.hostStart());
  let starts = 0;
  f.session.game.state = 'lobby';
  f.session.net.id = 'host';
  f.session.lobby.players.set('host', { name: 'Doodle42' });
  f.session.net.send = () => {};
  online.deps.run.setArena = () => {};
  online.spawnSpots = () => [{}];
  online.startMatch = () => starts++;
  online.scoreboard.send = () => {};
  online.hostStart();
  assert.equal(starts, 1);
});

test('room browsing reports map and match state and closes its temporary peer', async () => {
  const net = new Net();
  const pending = net.listLobbies();
  const peer = latestPeer();
  peer.emit('open');
  await setImmediate();
  peer.connections[0].emit('data', { t: 'welcome', d: {
    code: 'PUB0', players: 2, max: 10, hostName: 'InkFox', inMatch: true, map: 'metro',
  } });
  for (const connection of peer.connections.slice(1)) connection.emit('error', new Error('no room'));
  const rooms = await pending;
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].map, 'metro');
  assert.equal(rooms[0].inMatch, true);
  assert.equal(peer.destroyed, true);
  net.leave();
});

test('a canceled connection cannot send messages or disconnect its replacement', () => {
  const net = new Net();
  let messages = 0;
  const old = new Connection('same-host');
  const current = new Connection('same-host');
  net.on('clock', () => messages++);
  net.conns.set(old.peer, old);
  net.wire(old);
  net.conns.set(current.peer, current);
  old.emit('data', { t: 'clock', d: { left: 100, on: true } });
  old.emit('close');
  assert.equal(messages, 0);
  assert.equal(net.conns.get(current.peer), current);
  net.leave();
});

test('Quick Play creates a public room when the search is empty', async () => {
  let publicRoom;
  const f = fixture({
    quickJoin: async () => { throw new Error('no open public lobbies'); },
    host: async (options) => { publicRoom = options.isPublic; f.session.net.id = 'host'; },
  });
  const lobby = new LobbySession(f.session, f.deps);
  await lobby.quickPlay();
  assert.equal(publicRoom, true);
  assert.equal(f.session.game.state, 'lobby');
  assert.equal(f.session.lobby.players.size, 1);
});

test('canceling room discovery closes all probes and its temporary peer', async () => {
  const net = new Net();
  const pending = net.listLobbies();
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  const peer = latestPeer();
  peer.emit('open');
  await setImmediate();
  net.leave();
  await rejected;
  assert.equal(peer.destroyed, true);
  assert.ok(peer.connections.every((connection) => !connection.open));
});

test('a canceled room cannot seat a delayed connection into a new room', async () => {
  const net = new Net();
  const pending = net.host({ code: 'ABCDE' });
  latestPeer().emit('open');
  await pending;
  let arrivals = 0;
  net.onPeerJoin = () => arrivals++;
  const delayed = new Connection('late-guest');
  net.incoming(delayed);
  net.leave();
  const current = net.host({ code: 'HJKLM' });
  latestPeer().emit('open');
  await current;
  delayed.emit('open');
  assert.equal(arrivals, 0);
  assert.equal(delayed.open, false);
  assert.equal(net.conns.size, 0);
  net.leave();
});
