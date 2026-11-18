import { createAudioEngine } from '../audio';
import type { AudioEngine } from '../audio/types';
import type { CharacterId } from '../characters/types';
import type { Kit } from '../engine/kit';
import { GameRenderer } from '../engine/renderer';
import { netConditions } from '../net/channel';
import { ClientSession, type CloseReason } from '../net/client-session';
import { HostSession, type HostKind } from '../net/host-session';
import { joinPrivate, joinPublic, listPublicLobbies, pickQuickMatch, releaseClientPeer } from '../net/matchmaking';
import { normalizeCode } from '../net/peer';
import type { MatchSettings } from '../sim/types';
import { createViewModel } from '../weapons';
import type { ViewModel } from '../weapons/types';
import type { MapId } from '../world/types';
import { AppStore, type AppError } from './app-store';
import { HudStore } from './hud';
import { Input } from './input';
import { MatchView } from './match-view';
import { saveSettings, type Settings } from './settings';
import { IDLE, Showroom } from './showroom';
import { renderPortraits } from './portraits';

const MAP_IDS: MapId[] = ['plaza', 'fortress', 'docks'];

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
  private kit: Kit;
  private view: ViewModel;
  private showroom: Showroom;
  private host: HostSession | null = null;
  private client: ClientSession | null = null;
  private match: MatchView | null = null;
  private raf = 0;
  private last = performance.now();
  private disposed = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly tagLayer: HTMLElement,
    public settings: Settings
  ) {
    this.renderer = new GameRenderer(canvas, settings.quality);
    this.kit = { profile: this.renderer.profile, materials: this.renderer.materials };
    this.audio = createAudioEngine();
    this.audio.setMix(settings.mix);
    this.view = createViewModel(this.kit);
    this.view.setCharacter(settings.character);
    this.view.onCue = (cue) => this.audio.play(`cue:${cue}`, { volume: 0.8, priority: 6 });
    this.showroom = new Showroom(this.kit, this.renderer, settings.character);
    // After the first frame so the menu paints first.
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (this.disposed) return;
        void renderPortraits(this.showroom.display.kit, this.renderer, IDLE, this.showroom.display.environment, (id, url) => {
          if (this.disposed) return false;
          this.app.set({ portraits: { ...this.app.state.portraits, [id]: url } });
          return true;
        });
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

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.resize(w, h);
    this.view.resize(w, h);
    this.showroom.resize(w, h);
  };

  /** Must be called from a click: unlocks audio and enters the game view. */
  async unlockAudio() {
    if (this.app.state.audioReady) return;
    // Ask before awaiting: the bank renders for seconds, and a match started meanwhile must win.
    this.audio.playMusic?.('menu');
    await this.audio.unlock();
    this.app.set({ audioReady: true });
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
    if (this.match) this.match.fp.baseFov = next.fov;
    if (qualityChanged) this.rebuildForQuality();
  }

  /** Materials and geometry differ per tier, so the visible world is rebuilt. */
  private rebuildForQuality() {
    this.renderer.setQuality(this.settings.quality);
    this.kit = { profile: this.renderer.profile, materials: this.renderer.materials };
    this.view.dispose();
    this.view = createViewModel(this.kit);
    this.view.setCharacter(this.settings.character);
    this.view.onCue = (cue) => this.audio.play(`cue:${cue}`, { volume: 0.8, priority: 6 });
    this.showroom.dispose();
    this.showroom = new Showroom(this.kit, this.renderer, this.settings.character);
    if (this.match && this.client?.settings) {
      const old = this.match;
      old.dispose();
      this.match = this.createMatch(this.client.settings);
      this.match.adopt(old);
      this.view.equip(old.me.arms.weapon);
    }
    this.resize();
  }

  private baseSettings(mode: MatchSettings['mode'], map?: MapId): MatchSettings {
    return { mode, map: map ?? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)]!, minutes: 10, bots: mode === 'solo' ? 0 : 5, difficulty: this.settings.difficulty };
  }

  /** Opens the solo setup screen; the run begins on Start. */
  async playSolo() {
    await this.hostGame('solo', this.baseSettings('solo', 'plaza'), false);
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
    await this.hostGame(kind, this.baseSettings('ffa', 'plaza'), false);
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
    this.leave();
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
    this.leave();
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
      events: (events) => this.match?.events.handle(events),
      snapshot: (s) => this.match?.receive(s),
      roster: () => this.match?.remotes.syncRoster(client.roster),
      lobbyReturn: () => this.exitMatch('lobby'),
      closed: (reason: CloseReason) => this.fail(reason === 'hostLeft' ? 'hostLeft' : reason)
    };
  }

  private createMatch(settings: MatchSettings) {
    const match = new MatchView(this.kit, this.renderer, this.client!, settings, this.audio, this.view, this.hud, this.tagLayer);
    match.fp.baseFov = this.settings.fov;
    return match;
  }

  private enterMatch(settings: MatchSettings) {
    this.app.set({ busy: 'loading' });
    this.match?.dispose();
    this.hud.reset();
    this.hud.set({ settings });
    this.match = this.createMatch(settings);
    this.audio.playMusic?.(null);
    this.input.enabled = true;
    this.app.set({ screen: 'match', busy: null, paused: false });
    void this.input.lock();
    this.syncHalt();
  }

  private exitMatch(to: 'menu' | 'lobby') {
    this.match?.dispose();
    this.match = null;
    this.showroom.enter();
    this.input.enabled = false;
    this.input.unlock();
    this.hud.reset();
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
    this.host?.setSettings(settings);
    if (settings.difficulty) {
      this.settings = { ...this.settings, difficulty: settings.difficulty };
      saveSettings(this.settings);
    }
  }

  chat(text: string) {
    this.client?.chat(text);
  }

  /** Leave whatever game we're in and return to the main menu. */
  leave() {
    this.client?.dispose();
    this.client = null;
    this.host?.close();
    this.host = null;
    if (this.match) this.exitMatch('menu');
    this.app.set({ screen: 'menu', lobby: null, isHost: false, busy: null, paused: false });
  }

  private fail(e: unknown) {
    const error: AppError = e === 'hostLeft' || e === 'full' || e === 'version' || e === 'notFound' || e === 'unsupported' ? e : 'network';
    this.leave();
    releaseClientPeer();
    this.app.set({ error });
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
      this.renderer.render(match.scene, match.fp.camera, match.me.alive && !match.scoped ? this.view.scene : null, this.view.camera);
    } else if (match) {
      if (this.hud.state.phase === 'ended' && this.input.locked) this.input.unlock();
      const paused = this.app.state.paused;
      const zoom = match.me.arms.ads > 0.3 ? match.fp.baseFov / match.fp.currentFov : 1;
      const input = this.input.read(dt, zoom, (y, p) => match.assist(y, p, this.settings.input.aimAssist));
      if (input.scoreboard !== this.hud.state.scoreboard) this.hud.set({ scoreboard: input.scoreboard });
      match.frame(dt, input, paused || !this.input.active);
      this.renderer.render(match.scene, match.fp.camera, match.me.alive && !match.scoped ? this.view.scene : null, this.view.camera);
    } else {
      this.showroom.update(dt);
      this.renderer.render(this.showroom.scene, this.showroom.camera);
    }
    this.renderer.timer.end();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.leave();
    releaseClientPeer();
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.onUnload);
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.view.dispose();
    this.showroom.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}

