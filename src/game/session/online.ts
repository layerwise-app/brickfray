/**
 * Free-for-all online play. Play is peer-to-peer: one player's browser hosts the lobby and keeps
 * score, every player runs their own body, and each one tells the others what it did. This module
 * owns the match (start, spawns, deaths, the clock, the end) and its network messages; the lobby
 * and connections are session/lobby.
 */
import * as THREE from 'three';
import { FFA_TARGET, FFA_TIME, IDLE_FLAG, RESPAWN, TRACER_THICK } from '../config';
import type { TranslationKey } from '../config';
import type { DamageSource } from '../context';
import { t } from '../core/i18n';
import { choose } from '../core/math';
import { encodeLocal } from '../entities/remote-player';
import { INK } from '../render/ink-renderer';
import { knownMap } from '../storage';
import type { Combat } from './combat';
import type { FocusMode } from './focus';
import { LobbySession } from './lobby';
import type { OnlineUi, RunControl } from './lobby';
import type { Pickups } from './pickups';
import type { Props } from './props';
import { Scoreboard } from './scoreboard';
import { inMatch, isOnline, mmss } from './state';
import type { Session, Winner } from './state';

/** How a weapon is named in the kill feed. */
const HOW: Partial<Record<DamageSource, TranslationKey>> = {
  rifle: 'howRifle',
  shotgun: 'howShotgun',
  sniper: 'howSniper',
  katana: 'howKatana',
  grenade: 'howGrenade',
  deflect: 'howDeflect',
};
const howWord = (src: DamageSource | undefined): string | null => {
  const key = src ? HOW[src] : undefined;
  return key ? t(key) : null;
};

export interface OnlineDeps {
  pickups: Pickups;
  focus: FocusMode;
  props: Props;
  combat: Combat;
  ui: OnlineUi;
  run: RunControl;
}

export class Online {
  readonly scoreboard: Scoreboard;
  readonly lobby: LobbySession;
  private syncTick = 0;

  constructor(
    private readonly s: Session,
    private readonly deps: OnlineDeps,
  ) {
    this.scoreboard = new Scoreboard(s, (winner) => this.endMatch(winner));
    this.lobby = new LobbySession(s, {
      scoreboard: this.scoreboard,
      ui: deps.ui,
      run: deps.run,
      admitLateJoiner: (from, name) => this.admitLateJoiner(from, name),
    });
    this.wireNet();
    const { ctx, net } = s;
    ctx.player.onThrow = (d) => {
      if (net.active) net.broadcast('nade', d);
    };
    ctx.player.onFall = () => this.onFall();
  }

  private get myName(): string {
    return this.s.prefs.name;
  }

  /** Host: brings a player who joined mid-match into it. */
  private admitLateJoiner(from: string, name: string): void {
    const { net, scores, lobby, prefs } = this.s;
    const { ctx } = this.s;
    if (!scores.has(from)) scores.set(from, { name, kills: 0, deaths: 0 });
    net.sendTo(from, 'start', {
      late: true,
      spawn: this.farthestSpawnIndex(),
      map: lobby.map || prefs.map,
      broken: ctx.level.breakables.filter((b) => !b.alive).map((b) => b.id),
    });
    this.scoreboard.send();
    ctx.hud.kill(t('playerJoin', { name }), 0);
  }

  // ---------------- spawning, death, scoring ----------------
  private spawnSpots(): THREE.Vector3[] {
    const { level } = this.s.ctx;
    return level.arenaSpawns && level.arenaSpawns.length ? level.arenaSpawns : level.spawns;
  }

  /** One of the three spots farthest from everyone else. */
  private arenaSpawn(): THREE.Vector3 {
    const spots = this.spawnSpots();
    const others = [...this.s.remote.values()].filter((r) => r.alive && r.root && r.root.visible);
    const scored = spots.map((sp) => ({ sp, d: others.reduce((a, r) => Math.min(a, r.body.pos.distanceTo(sp)), 999) }));
    scored.sort((a, b) => b.d - a.d);
    return choose(scored.slice(0, Math.min(3, scored.length))).sp.clone();
  }

  // a spot for a late joiner: the one farthest from everybody already in the match
  private farthestSpawnIndex(): number {
    const spots = this.spawnSpots();
    const bodies = [this.s.ctx.player, ...this.s.remote.values()].filter((r) => r.alive);
    let best = 0;
    let bd = -1;
    spots.forEach((sp, i) => {
      const d = bodies.reduce((a, r) => Math.min(a, r.body.pos.distanceTo(sp)), 999);
      if (d > bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** The local player died: solo goes to the death screen, a match tells everyone and counts down. */
  onLocalDeath(): void {
    const { game, net, scores } = this.s;
    const { player, hud } = this.s.ctx;
    if (!isOnline(game)) {
      game.state = 'dying';
      game.deathT = 0;
      return;
    }
    const killer = player.lastHitBy || null;
    const h = player.lastHit;
    const dir = h?.from
      ? player.center
          .clone()
          .sub(new THREE.Vector3().fromArray(h.from))
          .normalize()
          .toArray()
          .map((v) => +v.toFixed(2))
      : null;
    const how = killer ? howWord(h?.src) : null;
    net.broadcast('pdead', { killer, dir, over: !!(h?.crit || (h?.amount ?? 0) >= 90 || h?.src === 'katana'), how, crit: !!h?.crit });
    if (net.isHost) this.scoreboard.tallyDeath(net.id!, killer);
    game.respawnT = RESPAWN;
    game.state = 'dying';
    game.deathT = 0;
    const kn = killer ? scores.get(killer)?.name : null;
    hud.kill(kn ? t('erasedBy', { name: kn, how: how ? ' · ' + how + (h?.crit ? ' · ' + t('headshot') : '') : '' }) : t('erased'), 0);
  }

  respawnLocal(): void {
    const { game } = this.s;
    const { player, hud, effects, audio } = this.s.ctx;
    player.reset(this.arenaSpawn());
    player.name = this.myName;
    player.lastHitBy = null;
    player.lastHit = null;
    game.state = 'play';
    player.shieldT = 2;
    hud.tip(t('respawnShield'), 1.6);
    effects.strokeBurst(player.center, INK.BLUE, 24, 6, { life: 0.5, size: 0.03 });
    audio.spawn(player.center);
  }

  private onFall(): void {
    const { game, net, scores } = this.s;
    const { hud } = this.s.ctx;
    if (!isOnline(game) || !inMatch(game)) return;
    hud.kill(t('killFall'), 0);
    if (net.isHost) {
      const sc = scores.get(net.id!);
      if (sc) {
        sc.kills = Math.max(0, sc.kills - 1);
        this.scoreboard.send();
        net.send('feed', { text: t('killFallRemote', { name: sc.name }) });
      }
    } else net.send('fell', {});
  }

  private endMatch(winner: Winner): void {
    const { game } = this.s;
    const { input, hud } = this.s.ctx;
    game.over = winner;
    game.overT = 0;
    game.state = 'over';
    this.deps.focus.end();
    input.exitLock();
    hud.setBoard(null);
    this.deps.ui.showOver(winner);
  }

  /** Host: everyone gets a different spot and the match starts for all. */
  hostStart(): void {
    const { scores, lobby, net, prefs } = this.s;
    if (!net.isHost || this.s.game.state !== 'lobby') return;
    scores.clear();
    for (const [id, p] of lobby.players) scores.set(id, { name: p.name, kills: 0, deaths: 0 });
    // deal everyone a different spot, shuffled so the same people do not always start together
    this.deps.run.setArena(true);
    const order = this.spawnSpots().map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const spawns: Record<string, number> = {};
    [...lobby.players.keys()].forEach((id, i) => {
      spawns[id] = order[i % order.length];
    });
    net.send('start', { spawns, map: lobby.map || prefs.map });
    this.startMatch(false, spawns[net.id ?? '']);
    this.scoreboard.send();
  }

  startMatch(late: boolean, spawnIdx: number | null | undefined): void {
    const { game, net, remote, scores, lobby, clock } = this.s;
    const { player, hud, input } = this.s.ctx;
    net.inMatch = true;
    game.mode = 'ffa';
    this.deps.run.setArena(true);
    this.deps.run.resetGame();
    clock.left = FFA_TIME;
    clock.syncT = 0;
    game.clockStarted = false;
    // nobody sends snapshots in the lobby, so the silence clock restarts here or the sweep would drop everyone
    for (const r of remote.values()) r.lastSeen = performance.now();
    if (!scores.size) for (const [id, p] of lobby.players) scores.set(id, { name: p.name, kills: 0, deaths: 0 });
    const spots = this.spawnSpots();
    player.reset(spawnIdx != null && spots[spawnIdx] ? spots[spawnIdx].clone() : this.arenaSpawn());
    this.deps.run.beginCommon();
    game.state = 'play';
    this.s.screen = 'lobby';
    player.shieldT = 2;
    this.scoreboard.refreshHud();
    hud.message(t('freeForAll'), late ? t('joinedLate') : t('matchIntro', { target: FFA_TARGET, minutes: Math.round(FFA_TIME / 60) }), 3);
    hud.tip(t('scoreboardHint', { key: hud.key('score') }), 5);
    // a match started by someone else's click cannot grab the mouse: ask for a click
    this.s.later(250, () => {
      if (game.state === 'play' && !input.pointerLocked && !input.usingGamepad) {
        game.menu = true;
        this.deps.ui.showClickToPlay();
      }
    });
  }

  /** Back from the results (or a host change) to the lobby, with the arena rebuilt. */
  toLobbyScreen(): void {
    const { game, net, remote } = this.s;
    const { hud } = this.s.ctx;
    net.inMatch = false;
    for (const r of remote.values()) r.lastSeen = performance.now();
    this.deps.run.setArena(true);
    this.deps.run.resetGame();
    game.state = 'lobby';
    game.over = null;
    game.menu = false;
    hud.setGameplayVisible(false);
    hud.setBoard(null);
    this.s.screen = 'lobby';
    this.deps.ui.showStart();
  }

  /** Host: sends everyone back to the lobby. */
  backToLobby(): void {
    this.s.net.send('backtolobby', {});
    this.toLobbyScreen();
  }

  // ---------------- match messages ----------------
  private wireNet(): void {
    const { game, net, remote, lobby, scores, clock } = this.s;
    const { ctx } = this.s;
    const { hud, audio, input, effects } = ctx;
    const { pickups, props } = this.deps;
    const _sm = new THREE.Vector3();
    const _se = new THREE.Vector3();

    net.on('start', (d) => {
      if (net.isHost) return;
      if (d.map) lobby.map = knownMap(d.map);
      this.startMatch(!!d.late, d.spawns ? d.spawns[net.id ?? ''] : d.spawn);
      if (d.broken) {
        for (const id of d.broken) {
          const br = ctx.level.breakables[id];
          if (br) props.break(br, null, false, true);
        }
      }
    });
    net.on('end', (d) => this.endMatch(d));
    net.on('backtolobby', () => {
      if (!net.isHost) this.toLobbyScreen();
    });
    net.on('pickup', (d) => {
      if (!net.isHost) pickups.spawn(d.kind === 'ammo' ? 'ammo' : 'health', new THREE.Vector3().fromArray(d.pos), d.id);
    });
    net.on('taken', (d) => {
      const p = pickups.find(d.id);
      if (p) pickups.remove(p);
    });
    net.on('take', (d) => {
      if (!net.isHost) return;
      const p = pickups.find(d.id);
      if (p) {
        pickups.remove(p);
        net.send('taken', { id: d.id });
      }
    });
    net.on('ps', (d, from) => {
      const r = remote.get(from);
      if (r) {
        r.push(d, performance.now() / 1000);
        r.lastSeen = performance.now();
      }
    });
    net.on('pdmg', (d) => {
      const { player } = ctx;
      if (!player.alive || game.state !== 'play' || player.shieldT > 0) return;
      player.lastHitBy = d.by || null;
      player.lastHit = { from: d.from || null, crit: !!d.crit, amount: d.amount, src: d.src };
      player.takeDamage(d.amount, d.from ? new THREE.Vector3().fromArray(d.from) : null);
    });
    net.on('pdead', (d, from) => {
      const r = remote.get(from);
      const vn = r ? r.name : 'Someone';
      const kn = d.killer ? scores.get(d.killer)?.name : null;
      if (r) {
        r.ragdoll(d.dir ? new THREE.Vector3().fromArray(d.dir) : null, !!d.over);
        audio.enemyDie(r.center);
      }
      const how = d.how ? ' · ' + d.how + (d.crit ? ' · ' + t('headshot') : '') : '';
      if (d.killer === net.id) {
        game.kills++;
        game.addScore(100, t('youPts', { pts: 100 }));
        audio.kill(true);
      } else hud.kill(kn ? t('killTarget', { killer: kn, victim: vn, how }) : t('killFell', { name: vn }), 0);
      if (net.isHost) this.scoreboard.tallyDeath(from, d.killer);
    });
    net.on('nade', (d) => ctx.player.throwGrenade(d));
    net.on('brk', (d) => {
      const br = ctx.level.breakables[d.id];
      if (br) props.break(br, null, false);
    });
    net.on('parry', (d) => {
      const { player } = ctx;
      audio.shieldHit(player.center);
      input.rumble(0.35, 0.3, 60);
      effects.strokeBurst(player.eye.clone().addScaledVector(player.forward, 0.5), INK.ORANGE, 8, 5, { life: 0.2, size: 0.03 });
      hud.kill(d.ret ? t('returned') : t('deflectedAway'), d.ret ? 25 : 0);
    });
    net.on('shots', (d, from) => {
      const r = remote.get(from);
      if (!r || !r.root || !r.alive) return;
      _sm.set(r.body.pos.x + r.right.x * 0.3 + r.forward.x * 0.8, r.body.pos.y + 1.35 + r.forward.y * 0.8, r.body.pos.z + r.right.z * 0.3 + r.forward.z * 0.8);
      const th = TRACER_THICK[d.k] || 0.02;
      const e = d.e || [];
      for (let i = 0; i + 2 < e.length; i += 3) {
        _se.set(e[i], e[i + 1], e[i + 2]);
        effects.tracer(_sm, _se, INK.BLUE, th, 0.06);
      }
      r.flash();
      audio.remoteShot(d.k, _sm);
    });
    net.on('cut', () => {
      const { player } = ctx;
      if (player.grapple.state !== 'idle') {
        player.detachGrapple(false);
        effects.strokeBurst(player.center, INK.ORANGE, 8, 4, { life: 0.25, size: 0.03 });
        hud.tip(t('ropeCutTip'), 1.3);
        input.rumble(0.5, 0.3, 80);
      }
    });
    net.on('score', (rows) => {
      if (!net.isHost) this.scoreboard.apply(rows);
    });
    net.on('fell', (_d, from) => {
      if (!net.isHost) return;
      const sc = scores.get(from);
      if (sc) {
        sc.kills = Math.max(0, sc.kills - 1);
        this.scoreboard.send();
        const feed = t('killFallRemote', { name: sc.name });
        net.send('feed', { text: feed });
        hud.kill(feed, 0);
      }
    });
    net.on('feed', (d) => hud.kill(String(d.text || ''), 0));
    net.on('clock', (d) => {
      if (!net.isHost) {
        clock.left = d.left;
        clock.running = !!d.on;
      }
    });
  }

  /** Per-frame networking: idle checks, peers, the silence sweep, snapshots, shots and the match clock. */
  update(dt: number): void {
    const { game, net, remote, clock } = this.s;
    const { input, hud, player } = this.s.ctx;
    this.lobby.update(dt);
    if (!net.active) return;
    const now = performance.now() / 1000;
    this.syncTick++;
    for (const r of remote.values()) r.update(dt, now);
    // a connection that died without saying so leaves a figure standing around: drop anyone silent too long
    if (inMatch(game) && !this.lobby.migrating) {
      for (const [id, r] of remote) {
        if (r.lastSeen && performance.now() - r.lastSeen > 9000) {
          if (!net.isHost && id === net.hostId) {
            net.leave();
            void this.lobby.migrateHost();
            break;
          }
          const nm = r.name;
          this.lobby.removeRemote(id);
          hud.kill(t('playerDisconnect', { name: nm }), 0);
          if (net.isHost) {
            const c = net.conns.get(id);
            if (c) {
              try {
                c.close();
              } catch {
                /* ignore */
              }
              net.conns.delete(id);
            }
            net.send('leave', { id });
            this.lobby.broadcastLobby();
            this.scoreboard.send();
          }
        }
      }
    }
    if (this.syncTick % 3 === 0 && inMatch(game)) net.send('ps', encodeLocal(player, player.weaponIndex, { firing: player.firing, idle: input.idleSeconds > IDLE_FLAG }), true);
    const shots = this.deps.combat.takeShots();
    if (shots) net.broadcast('shots', { k: player.weapon.kind, e: shots });
    if (net.isHost && inMatch(game) && remote.size > 0) game.clockStarted = true;
    const clockOn = inMatch(game) && !game.over && (net.isHost ? !!game.clockStarted : clock.running);
    if (inMatch(game) && !game.over) {
      if (clockOn) clock.left = Math.max(0, clock.left - dt);
      if (net.isHost) {
        clock.syncT -= dt;
        if (clock.syncT <= 0) {
          clock.syncT = 2;
          net.send('clock', { left: Math.round(clock.left), on: clockOn });
        }
      }
      hud.setTimer(clockOn ? mmss(clock.left) : t('timerWaiting'));
    }
    if (net.isHost && clockOn) {
      game.matchT += dt;
      if (clock.left <= 0) {
        const rows = this.scoreboard.sorted();
        const w: Winner = rows.length ? { id: rows[0][0], name: rows[0][1].name } : { id: net.id, name: this.myName };
        net.send('end', w);
        this.endMatch(w);
      }
    }
  }
}
