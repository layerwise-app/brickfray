/**
 * Game bootstrap: builds the world and the systems, wires the session modules (solo waves, katana
 * focus, pickups, breakable props, free-for-all online play, menu screens) to them through the
 * shared context, and runs the frame loop. `startGame` is the only entry point; everything it
 * starts is torn down again by the handle's `dispose()`.
 */
import * as THREE from 'three';
import { FOCUS_SCALE, KATANA_CHARGE_KILLS } from './config';
import type { GameContext } from './context';
import { audio } from './core/audio';
import type { TuneKey } from './core/audio';
import { currentLang, t } from './core/i18n';
import { Input } from './core/input';
import { clamp } from './core/math';
import { Effects } from './entities/effects';
import { EnemyManager } from './entities/enemies';
import { Player } from './entities/player';
import type { RemotePlayer } from './entities/remote-player';
import { Net } from './net/net';
import { InkRenderer } from './render/ink-renderer';
import { Combat } from './session/combat';
import { FocusMode } from './session/focus';
import type { LobbySession } from './session/lobby';
import { Online } from './session/online';
import { Pickups } from './session/pickups';
import { Props } from './session/props';
import { createMatchState, createTimers, isOnline } from './session/state';
import type { LobbyState, MatchState, ScoreRow, Session } from './session/state';
import { WaveDirector } from './session/waves';
import { Preferences, knownMap } from './storage';
import { HUD } from './ui/hud';
import { Screens, applyLookSettings } from './ui/screens';
import type { Level, MapKey } from './world/level';
import { buildLevel } from './world/level';
import { NavGrid } from './world/nav';
import { World } from './world/physics';

export interface GameHandle {
  dispose(): void;
}

/** Debug hook on window: the live game objects plus a few run-control functions. */
export interface DebugHook {
  ctx: GameContext;
  game: MatchState;
  player: Player;
  enemies: EnemyManager;
  nav: NavGrid;
  world: World;
  level: Level;
  hud: HUD;
  effects: Effects;
  input: Input;
  net: Net;
  remote: Map<string, RemotePlayer>;
  lobby: LobbyState;
  scores: Map<string, ScoreRow>;
  startWave(n: number): void;
  updateWaves(dt: number): void;
  begin(): void;
  beginAtWave(n: number): void;
  jumpToWave(n: number): void;
  resetGame(): void;
  spawnPickup: Pickups['spawn'];
  focusCandidate: FocusMode['candidate'];
  enterFocus(): void;
  pickSpawn: WaveDirector['pickSpawn'];
  startMatch: Online['startMatch'];
  createLobby: LobbySession['createLobby'];
  joinLobby: LobbySession['joinLobby'];
  quickPlay: LobbySession['quickPlay'];
  leaveOnline: LobbySession['leaveOnline'];
  hostStart(): void;
}

declare global {
  interface Window {
    __game?: DebugHook;
  }
}

/** Disposes every geometry under (and including) an object. */
function disposeGeometries(root: THREE.Object3D): void {
  root.traverse((o) => {
    if ('geometry' in o && o.geometry instanceof THREE.BufferGeometry) o.geometry.dispose();
  });
}

/** The music for a map: Mexico has its own, every other map plays the district tune. */
const tuneFor = (key: MapKey): TuneKey => (key === 'mexico' ? 'mexico' : 'district');

export function startGame(root: HTMLElement): GameHandle {
  root.lang = currentLang();
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const canvas = document.createElement('canvas');
  canvas.className = 'dd-canvas';
  const hudRoot = document.createElement('div');
  hudRoot.className = 'dd-hud';
  root.appendChild(canvas);
  root.appendChild(hudRoot);

  const prefs = new Preferences();
  const R = new InkRenderer(canvas, signal);
  const world = new World();
  let level = buildLevel(R.scene, world, prefs.map, { arena: false });
  let nav = new NavGrid(world, level.bounds, 1).build();
  let loadedKey: MapKey = prefs.map;
  let arenaLoaded = false;
  audio.setTune(tuneFor(prefs.map));

  const input = new Input(canvas, signal);
  const hud = new HUD(hudRoot);
  const effects = new Effects(R.scene, world);

  // set once the session modules exist; the game object only calls these after startup
  let focus: FocusMode;
  let online: Online;
  const game = createMatchState(hud, () => {
    focus.end();
    online.onLocalDeath();
  });
  // Player and EnemyManager take the context in their constructors while the context lists them,
  // so it is built in two steps; the session modules below install the remaining hooks.
  const ctx = { scene: R.scene, camera: R.camera, world, level, nav, input, hud, effects, audio, renderer: R } as GameContext;
  ctx.game = game;
  const enemies = (ctx.enemies = new EnemyManager(ctx));
  const player = (ctx.player = new Player(ctx));
  player.name = prefs.name;

  const net = new Net();
  const s: Session = {
    ctx,
    game,
    net,
    remote: new Map(),
    lobby: { players: new Map(), hostId: null, isPublic: true, status: '', code: '', map: null },
    scores: new Map(),
    clock: { left: 0, syncT: 0, running: false },
    prefs,
    signal,
    screen: 'main',
    ...createTimers(signal),
  };
  const { remote, lobby, scores } = s;

  // the map in play: solo uses the picked map, a match uses the host's choice; a rebuild wipes broken props
  function setLevel(key: MapKey, on: boolean, force = false): void {
    if (!force && key === loadedKey && on === arenaLoaded) return;
    loadedKey = key;
    arenaLoaded = on;
    for (const m of level.meshes) {
      R.scene.remove(m);
      disposeGeometries(m);
    }
    level.animated.length = 0;
    world.clear();
    level = buildLevel(R.scene, world, key, { arena: on });
    nav = new NavGrid(world, level.bounds, 1).build();
    ctx.level = level;
    ctx.nav = nav;
    if (window.__game) {
      window.__game.level = level;
      window.__game.nav = nav;
    }
    audio.setTune(tuneFor(key));
  }
  const setArena = (on: boolean): void => setLevel(knownMap(net.active ? lobby.map || prefs.map : prefs.map), on);

  // ---------------- session modules ----------------
  const combat = new Combat(s);
  const pickups = new Pickups(s);
  const props = new Props(s, pickups);
  focus = new FocusMode(s);
  const waves = new WaveDirector(s, pickups, focus);
  online = new Online(s, {
    pickups,
    focus,
    props,
    combat,
    ui: {
      showStart: () => screens.showStart(),
      renderLobby: () => screens.renderLobby(),
      setStatus: (text, error) => screens.setStatus(text, error),
      showClickToPlay: () => screens.showClickToPlay(),
      showOver: (winner) => screens.showOver(winner),
    },
    run: { setArena, resetGame, beginCommon },
  });
  const screens = new Screens(s, online, { begin, beginAtWave, toMainMenu });

  // ---------------- run control ----------------
  function resetGame(): void {
    if (level.breakables.some((b) => !b.alive)) setLevel(loadedKey, arenaLoaded, true);
    enemies.clear();
    effects.clear();
    pickups.clear();
    const ffa = isOnline(game);
    player.maxHp = ffa ? 110 : 120;
    player.regenDelay = ffa ? 4 : 4.5;
    player.regenRate = ffa ? 14 : 11;
    player.reset(level.playerStart);
    player.name = prefs.name;
    player.lastHitBy = null;
    player.lastHit = null;
    enemies.mods.speed = 1;
    enemies.mods.damage = 1;
    hud.setModifier('');
    hud.setBoss(null, null);
    game.boss = null;
    focus.end();
    game.katanaStreak = 0;
    game.score = 0;
    game.kills = 0;
    game.combo = 0;
    game.wave = 0;
    game.intermission = 0;
    game.queue = [];
    game.time = 0;
    game.over = null;
    game.matchT = 0;
    hud.setScore(0, 0);
    hud.setTimer('');
    hud.setPvpScore(null);
    hud.setWave(1, 0);
    hud.setBoard(null);
  }

  function beginCommon(): void {
    audio.init();
    audio.resume();
    if (!input.usingGamepad) input.requestLock();
    if (prefs.music && !audio.musicPlaying) audio.musicOn(true);
    hud.hideScreen();
    hud.setGameplayVisible(true);
    game.menu = false;
  }

  function begin(): void {
    game.mode = 'solo';
    setArena(false);
    beginCommon();
    if (game.state === 'start' || game.state === 'dead') {
      resetGame();
      waves.start(1);
    }
    game.state = 'play';
  }

  function beginAtWave(n: number): void {
    game.mode = 'solo';
    setArena(false);
    beginCommon();
    resetGame();
    waves.start(n);
    game.state = 'play';
  }

  function jumpToWave(n: number): void {
    enemies.clear();
    effects.clear();
    enemies.mods.speed = 1;
    enemies.mods.damage = 1;
    focus.end();
    game.intermission = 0;
    game.queue = [];
    waves.start(n);
    hud.hideScreen();
    hud.setGameplayVisible(true);
    game.state = 'play';
    game.menu = false;
    audio.reelLoop(false);
  }

  function toMainMenu(): void {
    game.state = 'start';
    game.mode = 'solo';
    game.menu = false;
    setArena(false);
    resetGame();
    audio.reelLoop(false);
    input.exitLock();
    hud.setGameplayVisible(false);
    s.screen = 'main';
    screens.showStart();
  }

  function pause(): void {
    if ((game.state !== 'play' && !(game.state === 'dying' && isOnline(game))) || game.menu) return;
    if (!isOnline(game)) game.state = 'pause';
    game.menu = true;
    screens.showPause();
    audio.reelLoop(false);
  }

  function resume(): void {
    if (isOnline(game)) {
      game.menu = false;
      if (game.state === 'dying' && game.respawnT <= 0) game.respawnArm = input.lastActive;
      hud.hideScreen();
      hud.setGameplayVisible(true);
      if (!input.usingGamepad) input.requestLock();
      return;
    }
    begin();
  }

  function onScreenClick(): void {
    const st = game.state;
    if (st === 'over') {
      if (net.isHost) online.backToLobby();
      return;
    }
    if (st === 'lobby') return;
    if (st === 'start') {
      if (s.screen === 'main') begin();
      return;
    }
    if ((st === 'play' || st === 'dying') && game.menu) {
      resume();
      return;
    }
    if (st === 'pause' || st === 'dead') resume();
  }

  window.__game = {
    ctx,
    game,
    player,
    enemies,
    nav,
    world,
    level,
    hud,
    effects,
    input,
    net,
    remote,
    lobby,
    scores,
    startWave: (n) => waves.start(n),
    updateWaves: (dt) => waves.update(dt),
    begin,
    beginAtWave,
    jumpToWave,
    resetGame,
    spawnPickup: (kind, pos, id) => pickups.spawn(kind, pos, id),
    focusCandidate: () => focus.candidate(),
    enterFocus: () => focus.enter(),
    pickSpawn: (type) => waves.pickSpawn(type),
    startMatch: (late, spawnIdx) => online.startMatch(late, spawnIdx),
    createLobby: (isPublic) => online.lobby.createLobby(isPublic),
    joinLobby: (code) => online.lobby.joinLobby(code),
    quickPlay: () => online.lobby.quickPlay(),
    leaveOnline: (reason) => online.lobby.leaveOnline(reason),
    hostStart: () => online.hostStart(),
  };

  hud.onScreenClick = onScreenClick;
  canvas.addEventListener(
    'click',
    () => {
      if (game.state === 'play' && !game.menu && !input.pointerLocked && !input.usingGamepad) input.requestLock();
    },
    { signal },
  );
  input.onLockChange = (locked) => {
    if (!locked && (game.state === 'play' || (game.state === 'dying' && isOnline(game))) && !game.menu && !input.usingGamepad) pause();
  };
  input.onDeviceChange = (pad) => {
    hud.setDevice(pad);
    hud.setWeapon(player.weapon.name, player.weapon.hint);
  };
  window.addEventListener(
    'pagehide',
    () => {
      if (net.active) net.leave();
    },
    { signal },
  );
  // browsers only let audio start on a gesture; any press wakes the context if it went to sleep
  for (const ev of ['pointerdown', 'keydown']) {
    window.addEventListener(
      ev,
      () => {
        audio.init();
        audio.resume();
      },
      { passive: true, signal },
    );
  }
  hud.setDevice(input.usingGamepad);
  applyLookSettings(input, prefs);
  hud.setWeapon(player.weapon.name, player.weapon.hint);
  screens.showStart();

  // ---------------- loop ----------------
  let last = performance.now();
  let boardToggle = false;
  let lockTipT = 0.5;
  let musicHealT = 2;
  let frame = 0;
  function tick(now: number): void {
    frame = requestAnimationFrame(tick);
    step(now);
  }
  // browsers starve animation frames in hidden tabs; a host that alt-tabs would freeze everyone's
  // match, so a coarse timer runs extra steps (never extra frame chains) while that happens
  const backgroundTimer = setInterval(() => {
    if (net.active && performance.now() - last > 300) step(performance.now());
  }, 250);

  /** Menu, pause and respawn keys for the current state. */
  function handleMenuKeys(): void {
    const st = game.state;
    if (st === 'start' || st === 'pause' || st === 'dead' || st === 'over') {
      if (input.pressed('jump') || input.pressed('confirm') || (st === 'pause' && input.pressed('pause'))) onScreenClick();
    } else if ((st === 'play' || (st === 'dying' && isOnline(game))) && input.pressed('pause')) {
      if (game.menu) resume();
      else {
        pause();
        input.exitLock();
      }
    } else if ((st === 'play' || st === 'dying') && game.menu && (input.pressed('jump') || input.pressed('confirm'))) resume();
  }

  // level hazards (the metro's trains): a hit hurts and throws you clear, then a short grace period
  let hazardCd = 0;
  function touchHazards(dt: number): void {
    hazardCd = Math.max(0, hazardCd - dt);
    if (!player.alive) return;
    for (const h of level.hazards) {
      const hit = h.touch(player.body, dt);
      if (!hit || hazardCd > 0) continue;
      hazardCd = 1;
      player.body.vel.add(hit.push);
      player.body.onGround = false;
      player.takeDamage(hit.damage, hit.from);
    }
  }

  /** Dying: solo moves on to the death screen; a match counts down, then waits for a press to respawn. */
  function updateDying(dt: number): void {
    game.deathT += dt;
    if (isOnline(game)) {
      const before = Math.ceil(game.respawnT);
      game.respawnT -= dt;
      const left = Math.ceil(game.respawnT);
      if (left > 0) {
        if (left !== before || game.deathT <= dt) hud.message(String(left), t('respawnCount'), 1.1);
      } else if (before > 0) {
        game.respawnArm = input.lastActive;
        game.promptT = 0;
      } else if (!game.menu) {
        // waiting on a press: any key, button or click brings you back; pause opens the menu instead
        game.promptT -= dt;
        if (game.promptT <= 0) {
          game.promptT = 1.4;
          hud.message(t('spawnReady'), t('respawnPrompt', { key: hud.key('confirm') }), 1.5);
        }
        if (input.lastActive !== game.respawnArm && !input.pressed('pause') && !input.down('pause')) online.respawnLocal();
      }
    } else if (game.deathT > 1.7) {
      game.state = 'dead';
      screens.showDead();
      input.exitLock();
    }
  }

  /** Ammo, slots, health and the focus / grapple meter. */
  function updateHud(dt: number, playing: boolean): void {
    const w = player.weapon;
    if (w.isGun) hud.setAmmo(w.mag, w.reserve, w.magSize, w.reloading);
    else hud.setKatana();
    hud.setSlots(
      player.weapons.map((wp, i) => ({
        name: wp.name,
        active: i === player.weaponIndex,
        ammo: wp.isGun ? wp.mag + '/' + wp.reserve : '∞',
        empty: wp.isGun && wp.mag === 0 && wp.reserve === 0,
      })),
    );
    hud.setGrenades(player.grenades);
    hud.setGrappleStamina(player.grapStam);
    hud.setHealth(player.hp, player.maxHp);
    hud.setSpread(w.spreadPx);
    hud.update(dt);
    if (isOnline(game)) hud.setFocusMeter(playing, player.grapStam, false, t('grappleMeterLabel'));
    else {
      hud.setFocusMeter(
        playing && (w.kind === 'katana' || game.katanaStreak > 0 || game.focus.active),
        game.focus.active ? 1 : clamp(game.katanaStreak / KATANA_CHARGE_KILLS, 0, 1),
        game.focus.active,
        t('focusMeterLabel'),
      );
    }
    if (game.boss) {
      if (game.boss.alive) hud.setBoss(game.boss.T.name, game.boss.hp / game.boss.maxHp);
      else {
        hud.setBoss(null, null);
        game.boss = null;
      }
    }
  }

  function step(now: number): void {
    // never more than 50 ms a step: a bigger jump (a tab coming back) makes the springs in the view model fly apart
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    input.update(dt);
    const st = game.state;
    const playing = st === 'play' || st === 'dying';
    handleMenuKeys();
    if (input.pressed('music')) {
      prefs.setMusic(!prefs.music);
      audio.musicOn(prefs.music);
      hud.tip(prefs.music ? t('musicOn') : t('musicOff'), 1.5);
    }
    if (isOnline(game) && playing) {
      if (input.usingGamepad && input.pressed('score')) boardToggle = !boardToggle;
      const want = ((input.down('score') && !input.usingGamepad) || boardToggle) && !game.menu;
      if (want !== !hud.el.board.hidden) hud.setBoard(want ? online.scoreboard.boardHTML() : null);
    } else boardToggle = false;
    if (st === 'play' && !game.menu && !input.pointerLocked && !input.usingGamepad) {
      lockTipT -= dt;
      if (lockTipT <= 0) {
        lockTipT = 2.5;
        hud.tip(t('clickLock'), 2);
      }
    }
    let scale = 1;
    if (game.hitstopT > 0) {
      game.hitstopT -= dt;
      scale = game.hitstopScale;
    } else if (game.focus.active) scale = FOCUS_SCALE;
    const sdt = dt * scale;
    if (st === 'play' && !isOnline(game)) focus.update(dt);
    else focus.end();
    if (playing) {
      game.time += sdt;
      if (player.shieldT > 0) player.shieldT -= dt;
      musicHealT -= dt;
      if (musicHealT <= 0) {
        musicHealT = 2;
        if (prefs.music && st === 'play' && !audio.musicPlaying && audio.ctx) audio.musicOn(true);
        if (input.anyInput) audio.resume();
      }
      const B = level.bounds;
      const bp = player.body.pos;
      if (bp.x < B.minX - 8 || bp.x > B.maxX + 8 || bp.z < B.minZ - 8 || bp.z > B.maxZ + 8 || bp.y > 150) bp.y = -100;
      touchHazards(sdt);
      player.update(sdt);
      enemies.update(sdt);
      effects.update(sdt);
      pickups.update(sdt);
      online.update(dt);
      if (st === 'play' && !isOnline(game)) waves.update(sdt);
      if (isOnline(game)) pickups.updateArena(dt);
      if (game.comboT > 0) {
        game.comboT -= sdt;
        if (game.comboT <= 0) {
          game.combo = 0;
          hud.setScore(game.score, 0);
        }
      }
      if (st === 'dying') updateDying(dt);
    } else {
      game.time += dt;
      if (st === 'start' || st === 'dead' || st === 'lobby' || st === 'over') player.idleCam(game.time);
      effects.update(dt);
      if (net.active) online.update(dt);
      if (st === 'over') {
        game.overT += dt;
        if (net.isHost && game.overT > 8) online.backToLobby();
        else if (!net.isHost && game.overT > 15) online.toLobbyScreen();
      }
    }
    for (const a of level.animated) a.update(game.time);
    audio.setListener(player.eye, player.right);
    updateHud(dt, playing);
    audio.setIntensity(clamp((enemies.alive + game.queue.length + remote.size * 2) / 12, 0, 1) * (game.intermission > 0 ? 0.25 : 1));
    R.render(game.time, {
      hurt: player.hurtFx,
      flash: player.flashFx,
      slow: scale < 1 ? 1 : 0,
      lowHp: player.alive && player.hp < 30 ? 1 - player.hp / 30 : 0,
    });
  }
  frame = requestAnimationFrame(tick);

  return {
    dispose() {
      lifetime.abort();
      cancelAnimationFrame(frame);
      clearInterval(backgroundTimer);
      if (net.active) net.leave();
      input.exitLock();
      audio.reelLoop(false);
      audio.musicOn(false);
      R.dispose();
      canvas.remove();
      hudRoot.remove();
      delete window.__game;
    },
  };
}
