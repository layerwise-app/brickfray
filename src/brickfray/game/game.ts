import { createAudioEngine } from '../audio';
import { CueSounds } from '../audio/cue-sounds';
import type { AudioEngine } from '../audio/types';
import { CHARACTER_IDS } from '../characters/roster';
import type { CharacterId } from '../characters/types';
import type { Kit } from '../engine/kit';
import { GameRenderer } from '../engine/renderer';
import { netConditions } from '../net/channel';
import { ClientSession, type CloseReason } from '../net/client-session';
import { HostSession, type HostKind } from '../net/host-session';
import { joinPrivate, joinPublic, listPublicLobbies, pickQuickMatch, releaseClientPeer } from '../net/matchmaking';
import { normalizeCode } from '../net/peer';
import type { MatchSettings } from '../sim/types';
import type { UpgradeId } from '../sim/upgrades';
import { createViewModel } from '../weapons';
import type { ViewCue, ViewModel } from '../weapons/types';
import type { MapId } from '../world/types';
import { AppStore, type AppError } from './app-store';
import { HudStore } from './hud';
import { Input } from './input';
import { MatchView } from './match-view';
import { MAP_IDS, saveSettings, type Settings } from './settings';
import { enemyInSights } from './touch-aim';
import { IDLE, Showroom } from './showroom';
import { renderPortraits } from './portraits';
import type { MatchReport } from '../../lib/board/contract';
import { recordMatch } from '../../lib/board/client/sync';
import { MatchTally } from '../../lib/board/client/tally';
import { requestTicket } from '../../lib/board/client/ticket';


function sessionToken() {
  try {
    let token = sessionStorage.getItem('brickfray.token');
    if (!token) {
      token = crypto.randomUUID();
      sessionStorage.setItem('brickfray.token', token);
    }
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

/** The whole client: renderer, menus' 3D backdrop, sessions and the active match. */
export class Game {
  readonly app = new AppStore();
  readonly hud = new HudStore();
  readonly renderer: GameRenderer;
  readonly input: Input;
  readonly audio: AudioEngine;
  private readonly cues: CueSounds;
  private kit: Kit;
  private view: ViewModel;
  private showroom: Showroom;
  private host: HostSession | null = null;
  private client: ClientSession | null = null;
  private match: MatchView | null = null;
  /** The local player's side of the current match, for the leaderboard. */
  private tally: MatchTally | null = null;
  private raf = 0;
  private last = performance.now();
  private disposed = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly tagLayer: HTMLElement,
    public settings: Settings
  ) {
    this.renderer = new GameRenderer(canvas, settings.quality);
    this.renderer.autoScale = settings.autoResolution;
    this.kit = { profile: this.renderer.profile, materials: this.renderer.materials };
    this.audio = createAudioEngine();
    this.cues = new CueSounds(this.audio);
    this.audio.setMix(settings.mix);
    this.view = createViewModel(this.kit, settings.character);
    this.view.onCue = (cue) => this.cue(cue);
    this.renderer.prepareView(this.view.scene, this.view.camera);
    this.showroom = new Showroom(this.kit, this.renderer, settings.character);
    // After the first frame so the menu paints first.
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (this.disposed) return;
        void renderPortraits(this.showroom.display.kit, this.renderer, IDLE, this.showroom.display.environment, (id, url) => {
          if (this.disposed) return false;
          this.app.set({ portraits: { ...this.app.state.portraits, [id]: url } });
          return true;
        }).then(() => this.prewarmHeroes());
      })
    );
    this.input = new Input(canvas, settings.input);
    this.input.onMenu = () => this.setPaused(!this.app.state.paused);
    this.input.onCtrlHint = () => this.ctrlHint();
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.onUnload);
    // Dev aid: ?net=150,30,0.05 adds latency (ms), jitter (ms) and packet loss to every link.
    const net = new URLSearchParams(location.search).get('net')?.split(',').map(Number);
    if (net?.length) Object.assign(netConditions, { latency: net[0] || 0, jitter: net[1] || 0, loss: net[2] || 0 });
    this.resize();
    window.addEventListener('resize', this.resize);
    // A phone settles its viewport after a turn without always sending a resize.
    if (this.canvas.parentElement) this.boxWatch.observe(this.canvas.parentElement);
    this.loop();
  }

  private chatting = false;

  /** Losing the lock (Esc) opens the pause menu; getting it back closes it. Chat and the results screen free the mouse without it. */
  private onLockChange = () => {
    if (this.app.state.screen !== 'match') return;
    if (this.input.locked) this.app.set({ paused: false });
    else if (!this.chatting && this.hud.state.phase !== 'ended') this.app.set({ paused: true });
    this.syncHalt();
  };

  private onVisibility = () => {
    this.audio.setSuspended(document.hidden);
    if (document.hidden && this.host?.kind === 'solo') this.setPaused(true);
  };

  /** Solo stands still while the player isn't in control (menu open, mouse not captured). */
  private soloHalted = false;
  private syncHalt() {
    const halted = this.host?.kind === 'solo' && this.app.state.screen === 'match' && (this.app.state.paused || !this.input.locked);
    if (halted === this.soloHalted) return;
    this.soloHalted = halted;
    this.host?.setPaused(halted);
    if (!halted) this.client?.resyncClock();
  }

  /** Ctrl+W closes tabs outside fullscreen; the browser asks first while a match runs. */
  private onUnload = (e: BeforeUnloadEvent) => {
    if (this.app.state.screen === 'match' || this.host) {
      e.preventDefault();
      this.host?.close();
    }
  };

  private hintShown = false;
  private ctrlHint() {
    if (this.hintShown) return;
    this.hintShown = true;
    this.hud.set({ hint: 'ctrl' });
    setTimeout(() => this.hud.set({ hint: null }), 6000);
  }

  private boxWatch = new ResizeObserver(() => this.resize());

  private resize = () => {
    // The canvas carries the size the renderer last gave it, so the box to fill is its parent's.
    const box = this.canvas.parentElement;
    const w = box?.clientWidth || window.innerWidth;
    const h = box?.clientHeight || window.innerHeight;
    this.showroom.resize(w, h);
    this.renderer.resize(w, h, this.match ? undefined : this.showroom.pixelRatio(w, h));
    this.view.resize(w, h);
  };

  /** Must be called from a click: unlocks audio and enters the game view. */
  async unlockAudio() {
    if (this.app.state.audioReady) return;
    // Ask before awaiting: the bank renders for seconds, and a match started meanwhile must win.
    this.audio.playMusic?.('menu');
    await this.audio.unlock();
    this.app.set({ audioReady: true });
  }

  /** In idle time on the menu, every other hero is built once so that no first pick stalls a frame. */
  private async prewarmHeroes() {
    for (const id of CHARACTER_IDS) {
      await idle();
      if (this.disposed || this.match || id === this.settings.character) continue;
      await this.showroom.prewarm(id);
      if (this.disposed || this.match) continue;
      // The first-person view keeps one hero's arms and sidearms; build this one's, then put back the one in play.
      this.view.setCharacter(id);
      this.view.setCharacter(this.settings.character);
    }
  }

  setCharacter(id: CharacterId) {
    this.settings = { ...this.settings, character: id };
    saveSettings(this.settings);
    this.showroom.setCharacter(id);
    this.view.setCharacter(id);
    this.client?.setCharacter(id);
  }

  applySettings(next: Settings) {
    const qualityChanged = next.quality !== this.settings.quality;
    this.settings = next;
    saveSettings(next);
    this.input.settings = next.input;
    this.audio.setMix(next.mix);
    this.renderer.autoScale = next.autoResolution;
    if (this.match) this.match.fp.baseFov = next.fov;
    if (qualityChanged) this.rebuildForQuality();
  }

  /** Materials and geometry differ per tier, so the visible world is rebuilt. */
  private rebuildForQuality() {
    this.renderer.setQuality(this.settings.quality);
    this.kit = { profile: this.renderer.profile, materials: this.renderer.materials };
    this.view.dispose();
    this.view = createViewModel(this.kit, this.settings.character);
    this.view.onCue = (cue) => this.cue(cue);
    this.renderer.prepareView(this.view.scene, this.view.camera);
    this.showroom.dispose();
    this.showroom = new Showroom(this.kit, this.renderer, this.settings.character);
    if (this.match && this.client?.settings) {
      const old = this.match;
      // Cleared first: if the new view cannot be built, the pause menu must still be able to leave.
      this.match = null;
      old.dispose();
      this.match = this.createMatch(this.client.settings);
      this.match.adopt(old);
      this.view.equip(old.me.arms.weapon);
    }
    this.resize();
  }

  private baseSettings(mode: MatchSettings['mode'], map?: MapId): MatchSettings {
    return { mode, map: map ?? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)]!, minutes: 5, seats: mode === 'solo' ? 0 : 6, difficulty: this.settings.difficulty };
  }

  /** Opens the solo setup screen; the run begins on Start. */
  async playSolo() {
    await this.hostGame('solo', this.baseSettings('solo', this.settings.soloMap), false);
  }

  async quickMatch() {
    this.app.set({ screen: 'connecting', busy: 'quick', error: null });
    try {
      const pick = pickQuickMatch(await listPublicLobbies());
      if (pick) return await this.joinWith(() => joinPublic(pick.slot));
      await this.hostGame('public', this.baseSettings('ffa'), true);
    } catch (e) {
      this.fail(e);
    }
  }

  async createRoom(kind: Exclude<HostKind, 'solo'>) {
    await this.hostGame(kind, { ...this.baseSettings('ffa'), ...this.settings.room }, false);
  }

  async browse() {
    this.app.set({ busy: 'browse', lobbies: null, error: null });
    try {
      this.app.set({ lobbies: await listPublicLobbies(), busy: null });
    } catch (e) {
      this.fail(e);
    }
  }

  async joinCode(code: string) {
    const clean = normalizeCode(code);
    if (clean.length < 4) return;
    await this.joinWith(() => joinPrivate(clean));
  }

  async joinSlot(slot: number) {
    await this.joinWith(() => joinPublic(slot));
  }

  private async hostGame(kind: HostKind, settings: MatchSettings, autoStart: boolean) {
    this.reset();
    this.app.set({ screen: 'connecting', busy: 'host', error: null });
    try {
      const host = new HostSession(kind, this.settings.name || 'Player', settings);
      await host.open();
      this.host = host;
      host.onChange = () => this.app.set({ lobby: { ...host.lobby } });
      this.attachClient(new ClientSession(host.localChannel(), this.settings.name || 'Player', this.settings.character, sessionToken()), true);
      if (autoStart) setTimeout(() => host.start(), 50);
    } catch (e) {
      this.fail(e);
    }
  }

  private async joinWith(connect: () => Promise<import('../net/channel').Channel>) {
    this.reset();
    this.app.set({ screen: 'connecting', busy: 'join', error: null });
    try {
      const channel = await connect();
      this.attachClient(new ClientSession(channel, this.settings.name || 'Player', this.settings.character, sessionToken()), false);
    } catch (e) {
      this.fail(e === 'unavailable' ? 'notFound' : e);
    }
  }

  private attachClient(client: ClientSession, isHost: boolean) {
    this.client = client;
    this.app.set({ isHost });
    client.listener = {
      lobby: (lobby) => {
        if (this.app.state.screen !== 'match') this.app.set({ screen: 'lobby', busy: null, lobby });
        else this.app.set({ lobby });
      },
      start: (settings) => this.enterMatch(settings),
      events: (events) => {
        this.tally?.events(events, client.you);
        this.match?.events.handle(events);
      },
      snapshot: (s) => this.match?.receive(s),
      roster: () => this.match?.remotes.syncRoster(client.roster),
      lobbyReturn: () => this.exitMatch('lobby'),
      closed: (reason: CloseReason) => this.fail(reason === 'hostLeft' ? 'hostLeft' : reason)
    };
  }

  private createMatch(settings: MatchSettings) {
    const match = new MatchView(this.kit, this.renderer, this.client!, settings, this.audio, this.view, this.hud, this.tagLayer);
    match.fp.baseFov = this.settings.fov;
    this.input.sights = () => enemyInSights(match);
    return match;
  }

  private enterMatch(settings: MatchSettings) {
    this.app.set({ busy: 'loading' });
    this.report(this.tally?.leave(this.hud.state));
    this.tally = new MatchTally(settings, this.settings.character, requestTicket(settings));
    this.match?.dispose();
    this.hud.reset();
    this.hud.set({ settings });
    this.match = this.createMatch(settings);
    // The menu draws at its own pixel ratio; this puts the tier's back.
    this.resize();
    this.audio.playMusic?.(null);
    this.audio.setScene?.(settings.map);
    this.input.enabled = true;
    this.app.set({ screen: 'match', busy: null, paused: false });
    void this.input.lock();
    this.syncHalt();
  }

  private exitMatch(to: 'menu' | 'lobby') {
    this.report(this.tally?.leave(this.hud.state));
    this.tally = null;
    this.match?.dispose();
    this.match = null;
    this.showroom.enter();
    this.input.enabled = false;
    this.input.unlock();
    this.hud.reset();
    this.audio.setScene?.(null);
    this.audio.playMusic?.('menu');
    this.app.set({ screen: to, paused: false });
    this.syncHalt();
  }

  setPaused(paused: boolean) {
    if (this.app.state.screen !== 'match') return;
    if (!paused) return this.resume();
    this.app.set({ paused: true });
    this.input.unlock();
    this.syncHalt();
  }

  /** From a click: capturing the mouse closes the menu (see onLockChange). */
  resume() {
    this.chatting = false;
    void this.input.lock();
  }

  /** Free the mouse to type without opening the pause menu. */
  openChat() {
    this.chatting = true;
    this.input.unlock();
  }

  startMatch() {
    this.host?.start();
  }

  setLobbySettings(settings: Partial<MatchSettings>) {
    if (!this.host) return;
    this.host.setSettings(settings);
    // What the host picks is the default next time, after a reload too.
    const { mode, map, minutes, seats, difficulty } = { ...this.host.lobby.settings, ...settings };
    this.settings = this.host.kind === 'solo' ? { ...this.settings, difficulty, soloMap: map } : { ...this.settings, room: { mode, map, minutes, seats } };
    saveSettings(this.settings);
  }

  /** Solo: the upgrade card chosen after a cleared wave. */
  pickUpgrade(id: UpgradeId) {
    this.client?.pickUpgrade(id);
  }

  chat(text: string) {
    this.client?.chat(text);
  }

  /** Leave whatever game we're in and return to the main menu. */
  leave() {
    if (this.client || this.host || this.match) this.audio.play('uiBack');
    this.reset();
  }

  private cue(cue: ViewCue) {
    if (cue === 'swing') this.match?.swing();
    else this.cues.play(cue, this.match?.me.arms.weapon ?? null);
  }

  private reset() {
    this.client?.dispose();
    this.client = null;
    this.host?.close();
    this.host = null;
    if (this.match || this.app.state.screen === 'match') this.exitMatch('menu');
    this.app.set({ screen: 'menu', lobby: null, isHost: false, busy: null, paused: false });
  }

  private fail(e: unknown) {
    const error: AppError = e === 'hostLeft' || e === 'full' || e === 'version' || e === 'notFound' || e === 'unsupported' ? e : 'network';
    this.reset();
    releaseClientPeer();
    this.app.set({ error });
  }

  /** Keeps a finished match in this browser's history and sends it to the leaderboard. */
  private report(report: MatchReport | null | undefined) {
    if (report) recordMatch(report, this.settings.name);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.renderer.timer.begin();
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const match = this.match;
    if (match && this.soloHalted) {
      // Zero time: apply snapshots and place the camera, but nothing moves.
      match.frame(0, this.input.read(0, 1), true);
      this.renderer.render(match.scene, match.fp.camera, match.me.alive ? this.view.scene : null, this.view.camera);
      this.report(this.tally?.frame(0, this.hud.state, true));
    } else if (match) {
      if (this.hud.state.phase === 'ended' && this.input.locked) this.input.unlock();
      const paused = this.app.state.paused;
      const zoom = match.me.arms.ads > 0.3 ? match.fp.baseFov / match.fp.currentFov : 1;
      const input = this.input.read(dt, zoom, (y, p) => match.assist(y, p, this.settings.input.aimAssist));
      if (input.scoreboard !== this.hud.state.scoreboard) this.hud.set({ scoreboard: input.scoreboard });
      match.frame(dt, input, paused || !this.input.active);
      this.renderer.render(match.scene, match.fp.camera, match.me.alive ? this.view.scene : null, this.view.camera);
      this.report(this.tally?.frame(dt, this.hud.state, false));
    } else {
      this.showroom.update(dt);
      this.showroom.render();
    }
    this.renderer.timer.end();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.reset();
    releaseClientPeer();
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.onUnload);
    window.removeEventListener('resize', this.resize);
    this.boxWatch.disconnect();
    this.input.dispose();
    this.view.dispose();
    this.showroom.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}

/** Resolves in the browser's next idle period (a short wait where there is none). */
function idle() {
  return new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 2000 });
    else setTimeout(resolve, 250);
  });
}
