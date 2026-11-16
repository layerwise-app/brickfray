/**
 * The online lobby: hosting, joining and quick play, the roster of other players, host migration
 * when the host drops, and idle kicks. Match play itself lives in session/online.
 */
import { FFA_TIME, IDLE_FLAG, IDLE_LOBBY, IDLE_MATCH, IDLE_WARN, NAME_MAX } from '../config';
import { t } from '../core/i18n';
import { RemotePlayer } from '../entities/remote-player';
import { INK } from '../render/ink-renderer';
import { knownMap } from '../storage';
import type { Scoreboard } from './scoreboard';
import { baseCode, inMatch, messageOf } from './state';
import type { Session, Winner } from './state';

/** The screens online play drives; implemented by ui/screens. */
export interface OnlineUi {
  showStart(): void;
  renderLobby(): void;
  setStatus(text: string, error?: boolean): void;
  showClickToPlay(): void;
  showOver(winner: Winner): void;
}

/** Run control owned by the orchestrator. */
export interface RunControl {
  setArena(on: boolean): void;
  resetGame(): void;
  beginCommon(): void;
}

export interface LobbyDeps {
  scoreboard: Scoreboard;
  ui: OnlineUi;
  run: RunControl;
  /** Host: brings a player who joined mid-match into it. */
  admitLateJoiner(from: string, name: string): void;
}

/** A readable status line for a networking failure. */
export function friendlyError(err: unknown): string {
  const m = String(messageOf(err) || err || '');
  if (!m) return t('errorGeneric');
  if (/networking library/.test(m)) return t('errorNetLib');
  if (/timed out|signalling/.test(m)) return t('errorSignaling');
  if (/no lobby with that code/.test(m)) return t('errorNoLobby');
  if (/no answer/.test(m)) return t('errorNoAnswer');
  if (/full/.test(m)) return t('errorFull');
  if (/leave the lobby/.test(m)) return t('errorLeaveFirst');
  return m;
}

export class LobbySession {
  private migratingNow = false;
  private idleWarned = false;
  private idleCheckT = 0;
  private connectionAttempt = 0;

  constructor(
    private readonly s: Session,
    private readonly deps: LobbyDeps,
  ) {
    this.wireNet();
  }

  /** A host migration is under way. */
  get migrating(): boolean {
    return this.migratingNow;
  }

  private get myName(): string {
    return this.s.prefs.name;
  }

  addRemote(id: string, name: string): RemotePlayer {
    const { ctx, net, remote } = this.s;
    const known = remote.get(id);
    if (known) {
      known.name = name;
      return known;
    }
    const rp = new RemotePlayer(ctx, id, name, 0, INK.RED);
    rp.onDamage = (target, amount, fromPos) => {
      if (!ctx.canHurt(target) || !target.alive) return;
      ctx.hud.hitmarker(false, false);
      net.sendTo(target.id, 'pdmg', { amount: Math.round(amount), from: fromPos ? fromPos.toArray().map((v) => +v.toFixed(1)) : null, by: net.id, src: 'grenade' });
    };
    remote.set(id, rp);
    return rp;
  }

  removeRemote(id: string): void {
    const { remote, lobby, scores } = this.s;
    const r = remote.get(id);
    if (r) {
      r.dispose();
      remote.delete(id);
    }
    lobby.players.delete(id);
    scores.delete(id);
  }

  lobbyRows(): { id: string; name: string }[] {
    return [...this.s.lobby.players.entries()].map(([id, p]) => ({ id, name: p.name }));
  }

  /** Host: shares the lobby (players, visibility, map) and redraws it here. */
  broadcastLobby(): void {
    const { net, lobby, prefs } = this.s;
    net.map = lobby.map || prefs.map;
    net.send('lobby', { players: this.lobbyRows(), hostId: net.id, isPublic: lobby.isPublic, map: lobby.map || prefs.map, shown: net.aliasCode || net.code });
    this.deps.ui.renderLobby();
  }

  /** Drops out of online play back to the online screen, with `reason` as its status line. */
  leaveOnline(reason: string): void {
    const { game, lobby, scores } = this.s;
    const { hud } = this.s.ctx;
    this.cancelConnection();
    scores.clear();
    hud.setBoard(null);
    if (game.state !== 'start') {
      game.state = 'start';
      game.mode = 'solo';
      this.deps.run.setArena(false);
      this.deps.run.resetGame();
      hud.setGameplayVisible(false);
    }
    game.menu = false;
    lobby.status = reason || '';
    this.s.screen = 'online';
    this.deps.ui.showStart();
  }

  /** After an await: true (and offline again) if the game was disposed meanwhile. */
  private disposed(): boolean {
    if (!this.s.signal.aborted) return false;
    this.s.net.leave();
    return true;
  }

  private enterLobby(): void {
    // A running room can send its start packet before the join promise settles.
    if (inMatch(this.s.game)) return;
    this.s.game.state = 'lobby';
    this.s.screen = 'lobby';
    this.deps.ui.showStart();
  }

  async createLobby(isPublic: boolean): Promise<void> {
    const attempt = ++this.connectionAttempt;
    const { net, lobby, prefs } = this.s;
    const { ui } = this.deps;
    ui.setStatus(t('creatingLobby'));
    net.map = prefs.map;
    try {
      await net.host({ isPublic });
    } catch (err) {
      if (!this.currentConnection(attempt)) return;
      ui.setStatus(friendlyError(err), true);
      return;
    }
    if (!this.currentConnection(attempt)) return;
    lobby.isPublic = isPublic;
    lobby.map = prefs.map;
    lobby.players.clear();
    // host() just succeeded, so this peer has an id
    lobby.players.set(net.id!, { name: this.myName });
    lobby.hostId = net.id;
    lobby.status = '';
    this.enterLobby();
  }

  async joinLobby(code: string): Promise<void> {
    const attempt = ++this.connectionAttempt;
    const { net, lobby } = this.s;
    const { ui } = this.deps;
    ui.setStatus(t('connecting'));
    try {
      await net.join(code, { name: this.myName });
    } catch (err) {
      if (!this.currentConnection(attempt)) return;
      ui.setStatus(friendlyError(err), true);
      return;
    }
    if (!this.currentConnection(attempt)) return;
    lobby.isPublic = net.isPublic;
    lobby.status = '';
    this.enterLobby();
  }

  /** Joins the fullest open public lobby, or hosts one if there is none. */
  async quickPlay(): Promise<void> {
    const attempt = ++this.connectionAttempt;
    const { net, lobby } = this.s;
    const { ui } = this.deps;
    try {
      await net.quickJoin({ name: this.myName }, (text: string) => {
        if (this.currentConnection(attempt)) ui.setStatus(text);
      });
      if (!this.currentConnection(attempt)) return;
      lobby.isPublic = true;
      lobby.status = '';
      this.enterLobby();
      return;
    } catch (err) {
      if (!this.currentConnection(attempt)) return;
      if (!/no open public/.test(String(messageOf(err)))) {
        ui.setStatus(friendlyError(err), true);
        return;
      }
    }
    ui.setStatus(t('noOpenLobby'));
    await this.createLobby(true);
  }

  /** Cancel the attempt as well as its peers; late results must not reopen the room. */
  cancelConnection(): void {
    this.connectionAttempt++;
    this.s.net.leave();
    for (const id of this.s.remote.keys()) this.removeRemote(id);
    this.s.lobby.players.clear();
  }

  private currentConnection(attempt: number): boolean {
    return attempt === this.connectionAttempt && !this.disposed();
  }

  // ---- host transfer: when the host goes, the earliest-joined player left takes over on a generation
  // code (the old code is slow to free up on the signalling server); everyone else rejoins there
  async migrateHost(): Promise<void> {
    if (this.migratingNow) return;
    this.migratingNow = true;
    try {
      await this.doMigrateHost();
    } finally {
      this.migratingNow = false;
    }
  }

  private async doMigrateHost(): Promise<void> {
    const { game, net, remote, lobby, scores, clock, prefs } = this.s;
    const { hud } = this.s.ctx;
    // Leave, Cancel or a new connection bumps the attempt; the retries below must stop then.
    const attempt = this.connectionAttempt;
    const oldHost = lobby.hostId;
    const myId = net.id;
    const gen = (lobby.gen || 0) + 1;
    lobby.gen = gen;
    const base = baseCode(lobby.code || net.code);
    const code = base + '-' + gen;
    const roster = (lobby.order || []).filter((id) => id !== oldHost && lobby.players.has(id));
    if (!roster.length || !base) {
      this.leaveOnline(t('hostLeft'));
      return;
    }
    const successor = roster[0];
    const wasInMatch = inMatch(game);
    if (oldHost) {
      const r = remote.get(oldHost);
      if (r) r.dispose();
      remote.delete(oldHost);
      lobby.players.delete(oldHost);
      scores.delete(oldHost);
    }
    hud.message(t('hostLeft'), successor === myId ? t('promotedHost') : t('migratingHost'), 2.6);
    if (successor === myId) {
      let ok = false;
      net.map = lobby.map || prefs.map;
      for (let tries = 0; tries < 2 && !ok; tries++) {
        try {
          await net.host({ isPublic: lobby.isPublic, code });
          ok = true;
        } catch {
          if (!this.currentConnection(attempt)) return;
          await this.s.sleep(800);
        }
        if (!this.currentConnection(attempt)) return;
      }
      if (!ok) {
        this.leaveOnline(t('hostFailed'));
        return;
      }
      // host() just succeeded, so this peer has an id
      const newId = net.id!;
      const mine = lobby.players.get(myId) || { name: prefs.name };
      lobby.players.delete(myId);
      lobby.players.set(newId, mine);
      const ms = scores.get(myId);
      scores.delete(myId);
      if (ms) scores.set(newId, ms);
      lobby.hostId = newId;
      lobby.code = code;
      lobby.order = [newId, ...roster.filter((id) => id !== myId)];
      net.accepting = true;
      game.clockStarted = clock.running || clock.left < FFA_TIME;
      net.onAlias = () => {
        this.broadcastLobby();
        hud.kill(t('lobbyRestored', { code: base }), 0);
      };
      net.claimAlias(base);
      if (game.state === 'over') {
        /* the results stay up; the host timer now runs here */
      } else if (wasInMatch) {
        if (game.state !== 'play' && game.state !== 'dying') game.state = 'play';
        this.deps.scoreboard.refreshHud();
      } else {
        this.enterLobby();
      }
      this.broadcastLobby();
    } else {
      await this.s.sleep(1200);
      if (!this.currentConnection(attempt)) return;
      const deadline = performance.now() + 20000;
      let joined = false;
      while (!joined && performance.now() < deadline) {
        try {
          await net.join(code, { name: prefs.name, prev: myId });
          joined = true;
        } catch {
          if (!this.currentConnection(attempt)) return;
          await this.s.sleep(1200);
        }
        if (!this.currentConnection(attempt)) return;
      }
      if (!joined) {
        this.leaveOnline(t('matchLost'));
        return;
      }
      lobby.code = code;
      if (!wasInMatch) this.enterLobby();
    }
  }

  // ---------------- network handlers ----------------
  private wireNet(): void {
    const { game, net, remote, lobby, scores, prefs } = this.s;
    const { hud } = this.s.ctx;
    const { ui } = this.deps;

    net.onPeerLeave = (id) => {
      const nm = lobby.players.get(id)?.name;
      this.removeRemote(id);
      this.broadcastLobby();
      if (inMatch(game)) {
        hud.kill(t('playerLeave', { name: nm || 'Someone' }), 0);
        this.deps.scoreboard.send();
      }
    };
    net.onDisconnect = () => {
      if (lobby.order && lobby.order.some((id) => id !== lobby.hostId)) void this.migrateHost();
      else this.leaveOnline(t('hostLeft'));
    };
    net.on('refused', (d) => this.leaveOnline(d.reason));
    net.hostName = prefs.name;
    net.onPeerJoin = (from, meta) => {
      const name = String((meta && meta.name) || 'doodle').slice(0, NAME_MAX);
      if (meta && meta.prev && meta.prev !== from) {
        const prev = meta.prev;
        const sc = scores.get(prev);
        if (sc) {
          scores.delete(prev);
          scores.set(from, sc);
        }
        const r = remote.get(prev);
        if (r) r.dispose();
        remote.delete(prev);
        lobby.players.delete(prev);
        if (lobby.order) lobby.order = lobby.order.filter((id) => id !== prev);
      }
      lobby.players.set(from, { name });
      this.addRemote(from, name);
      this.broadcastLobby();
      if (game.state === 'play' || game.state === 'dying') this.deps.admitLateJoiner(from, name);
    };
    net.on('lobby', (d) => {
      lobby.hostId = d.hostId;
      lobby.isPublic = !!d.isPublic;
      lobby.code = net.code;
      lobby.shown = d.shown || net.code;
      if (d.map) lobby.map = knownMap(d.map);
      lobby.order = d.players.map((p) => p.id);
      lobby.players.clear();
      for (const p of d.players) lobby.players.set(p.id, { name: p.name });
      for (const p of d.players) if (p.id !== net.id) this.addRemote(p.id, p.name);
      for (const id of [...remote.keys()]) if (!lobby.players.has(id)) this.removeRemote(id);
      if (inMatch(game)) {
        for (const p of d.players) if (!scores.has(p.id)) scores.set(p.id, { name: p.name, kills: 0, deaths: 0 });
        this.deps.scoreboard.refreshHud();
      }
      ui.renderLobby();
    });
    net.on('leave', (d) => {
      const nm = lobby.players.get(d.id)?.name;
      this.removeRemote(d.id);
      if (inMatch(game)) hud.kill(t('playerLeave', { name: nm || 'Someone' }), 0);
      ui.renderLobby();
    });
    net.on('kick', (d) => {
      const back = baseCode(net.aliasCode || net.code);
      this.leaveOnline((d && d.reason) || t('kicked'));
      lobby.rejoinCode = back;
      if (back) ui.showStart();
    });
  }

  // ---- idle players: a warning, then out; a lobby with nobody active in it shuts down ----
  /** Idle checks, once a second while online. */
  update(dt: number): void {
    const { game, net, remote, lobby } = this.s;
    const { input, hud, audio } = this.s.ctx;
    if (!net.active) {
      this.idleWarned = false;
      return;
    }
    this.idleCheckT -= dt;
    if (this.idleCheckT > 0) return;
    this.idleCheckT = 1;
    const limit = inMatch(game) ? IDLE_MATCH : IDLE_LOBBY;
    const idle = input.idleSeconds;
    const othersActive = [...remote.values()].some((r) => !r.idle);
    // a host that still has active players stays; kicking it would end their match
    const canDrop = !net.isHost || !othersActive;
    if (idle > limit - IDLE_WARN && !this.idleWarned && canDrop) {
      this.idleWarned = true;
      hud.message(t('stillThere'), t('idleWarning'), 3);
      audio.empty();
    }
    if (idle <= limit - IDLE_WARN) this.idleWarned = false;
    if (idle > limit && canDrop) {
      const back = net.isHost ? null : baseCode(net.aliasCode || net.code);
      this.leaveOnline(net.isHost ? t('lobbyClosedIdle') : t('idleKicked'));
      lobby.rejoinCode = back;
      if (back) this.deps.ui.showStart();
      return;
    }
    // the host also clears out a client that has sat idle past the limit, in case its tab cannot do it itself
    if (net.isHost) {
      for (const [id, r] of remote) {
        if (r.idle && r.idleSince && performance.now() / 1000 - r.idleSince > limit - IDLE_FLAG + 15) {
          net.sendTo(id, 'kick', { reason: t('idleKickReason') });
          const c = net.conns.get(id);
          this.s.later(500, () => {
            try {
              c?.close();
            } catch {
              /* ignore */
            }
          });
        }
      }
    }
  }
}
