/**
 * The menu screens drawn in the HUD panel: start (main / online / lobby), pause, click-to-play,
 * death and match results, with their settings, map and checkpoint pickers. Each screen is plain
 * markup plus the wiring for its buttons; what the buttons do comes from the session.
 */
import { FFA_TARGET, NAME_MAX } from '../config';
import { LANGUAGES, controlsHTML, normalizeLang, t } from '../core/i18n';
import type { Input } from '../core/input';
import type { Net } from '../net/net';
import { friendlyError } from '../session/lobby';
import type { Online } from '../session/online';
import { baseCode, esc, isOnline } from '../session/state';
import type { Session, Winner } from '../session/state';
import { Preferences, knownMap } from '../storage';
import { LEVELS } from '../world/level';
import type { MapKey } from '../world/level';

type LobbyListing = Awaited<ReturnType<Net['listLobbies']>>[number];

/** Run control the screens trigger; owned by the orchestrator. */
export interface ScreenActions {
  begin(): void;
  beginAtWave(wave: number): void;
  toMainMenu(): void;
}

/** Applies the look settings to the input and saves them. */
export function applyLookSettings(input: Input, prefs: Preferences): void {
  input.mouseSens = (0.0022 * prefs.sens) / 100;
  input.padSensX = (3.4 * prefs.sens) / 100;
  input.padSensY = (2.6 * prefs.sens) / 100;
  input.invertY = prefs.invert;
  prefs.saveLook();
}

/** The element an event started on, or its closest ancestor matching `selector`. */
function closestTarget<E extends Element>(e: Event, selector: string): E | null {
  return e.target instanceof Element ? e.target.closest<E>(selector) : null;
}

const stop = (e: Event): void => e.stopPropagation();

export class Screens {
  /** Public lobbies found by the last refresh; null until the first one. */
  private lobbyList: LobbyListing[] | null = null;
  private listBusy = false;
  private listError = '';
  private onlinePage: 'entry' | 'friends' | 'browse' = 'entry';
  private codeDraft = '';
  private connectionBusy = false;
  private connectionAttempt = 0;
  private pendingAction: 'quick' | 'join' | 'create' | null = null;
  private statusError = false;

  constructor(
    private readonly s: Session,
    private readonly online: Online,
    private readonly actions: ScreenActions,
  ) {}

  private get panel(): HTMLElement {
    return this.s.ctx.hud.el.panel;
  }

  // ---------------- shared pieces ----------------
  private settingsHTML(): string {
    const { prefs } = this.s;
    const savedLang = normalizeLang(new URLSearchParams(location.search).get('lang')) ?? Preferences.readUiLang() ?? 'auto';
    return `<div class="settings" id="settings">
    <div class="langrow"><label for="setLang">${t('language')}</label><select id="setLang"><option value="auto" ${savedLang === 'auto' ? 'selected' : ''}>${t('langAuto')}</option>${LANGUAGES.map(({ code, name }) => `<option value="${code}" ${savedLang === code ? 'selected' : ''}>${name}</option>`).join('')}</select></div>
    <label><span>${t('sensLabel')}</span><input type="range" id="setSens" min="25" max="250" step="5" value="${prefs.sens}"><b id="setSensV">${prefs.sens}%</b></label>
    <label><input type="checkbox" id="setInv" ${prefs.invert ? 'checked' : ''}> ${t('invertLook')}</label>
    <label><input type="checkbox" id="setMus" ${prefs.music ? 'checked' : ''}> ${t('musicLabel')} <span class="k">(M)</span></label>
  </div>`;
  }

  private wireSettings(): void {
    const { prefs } = this.s;
    const { input, audio } = this.s.ctx;
    const box = this.panel.querySelector<HTMLElement>('#settings');
    if (!box) return;
    box.addEventListener('click', stop);
    box.addEventListener('keydown', stop);
    const langSel = box.querySelector('#setLang');
    if (langSel instanceof HTMLSelectElement) {
      langSel.addEventListener('change', () => {
        Preferences.writeUiLang(langSel.value);
        const url = new URL(location.href);
        if (langSel.value === 'auto') url.searchParams.delete('lang');
        else url.searchParams.set('lang', langSel.value);
        location.assign(url.href);
      });
    }
    const sens = box.querySelector<HTMLInputElement>('#setSens')!;
    const out = box.querySelector<HTMLElement>('#setSensV')!;
    sens.addEventListener('input', () => {
      prefs.sens = Number(sens.value);
      out.textContent = prefs.sens + '%';
      applyLookSettings(input, prefs);
    });
    const inv = box.querySelector<HTMLInputElement>('#setInv')!;
    inv.addEventListener('change', () => {
      prefs.invert = inv.checked;
      applyLookSettings(input, prefs);
    });
    const mus = box.querySelector<HTMLInputElement>('#setMus')!;
    mus.addEventListener('change', () => {
      prefs.setMusic(mus.checked);
      audio.musicOn(prefs.music);
    });
  }

  private wireName(box: HTMLElement): void {
    const { prefs, net } = this.s;
    const nb = box.querySelector<HTMLInputElement>('#setName');
    if (!nb) return;
    nb.addEventListener('input', () => {
      prefs.setName(nb.value.trim().slice(0, NAME_MAX) || prefs.name);
      this.s.ctx.player.name = prefs.name;
      net.hostName = prefs.name;
    });
  }

  private checkpointHTML(): string {
    const { checkpoint } = this.s.prefs;
    if (checkpoint < 5) return '';
    let h = '<div class="checkpoints"><span>' + t('checkpoints') + '</span>';
    for (let w = 5; w <= checkpoint; w += 5) h += `<button type="button" data-cp="${w}">${t('checkpointWave', { wave: w })}</button>`;
    return h + '</div>';
  }

  private wireCheckpoints(onGo: (wave: number) => void): void {
    const box = this.panel.querySelector<HTMLElement>('.checkpoints');
    if (!box) return;
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = closestTarget<HTMLButtonElement>(e, 'button');
      if (b) onGo(Number(b.dataset.cp));
    });
  }

  private mapHTML(sel: MapKey, canPick: boolean): string {
    if (LEVELS.length < 2) return '';
    return `<div class="mapsel" id="mapsel"><span>${t('map')}</span>${LEVELS.map((m) => `<button type="button" class="mapbtn${m.key === sel ? ' on' : ''}" data-map="${m.key}" ${canPick ? '' : 'disabled'}>${m.name}<i>${m.blurb}</i></button>`).join('')}</div>`;
  }

  private wireMap(onPick: (key: MapKey) => void): void {
    const box = this.panel.querySelector<HTMLElement>('#mapsel');
    if (!box) return;
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = closestTarget<HTMLButtonElement>(e, '.mapbtn');
      if (b && !b.disabled) onPick(knownMap(b.dataset.map));
    });
  }

  private menuBtnHTML(): string {
    return '<div class="online menubtn"><div class="row"><button type="button" class="alt" id="menuBtn">' + t('mainMenu') + '</button></div></div>';
  }

  private wireMenuBtn(): void {
    const b = this.panel.querySelector<HTMLButtonElement>('#menuBtn');
    if (b) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.actions.toMainMenu();
      });
    }
  }

  // ---------------- start screens ----------------
  private mainHTML(): string {
    const { prefs } = this.s;
    return `<div class="menu-home">
    <header><h1>${t('appTitle')}</h1><h2>${t('appSubtitle')}</h2></header>
    <div class="mainbtns"><button type="button" class="start" id="soloBtn">${t('startSolo')}<i>${t('startSoloHint')}</i></button><button type="button" id="onlineBtn">${t('online')}<i>${t('onlineHint')}</i></button></div>
    ${this.mapHTML(prefs.map, true)}
    <div class="menu-details">${controlsHTML()}${this.settingsHTML()}</div>
    ${this.checkpointHTML()}
    <footer class="menu-footer">${prefs.best ? `<div class="beststat">${t('bestScore', { score: prefs.best })}</div>` : ''}<a class="lw-promo" href="https://layerwise.app" target="_blank" rel="noopener noreferrer">${t('promo')}</a></footer>
    </div>`;
  }

  private feedbackHTML(): string {
    const message = this.s.lobby.status;
    const connecting = this.connectionBusy && this.s.game.state === 'start';
    return `<div class="flow-feedback" ${!message && !connecting ? 'hidden' : ''}>
      <p id="status" class="flow-status${this.statusError ? ' is-error' : ''}" role="${this.statusError ? 'alert' : 'status'}" aria-live="polite">${esc(message)}</p>
      ${connecting ? `<button type="button" class="text-button" id="cancelBtn">${t('cancel')}</button>` : ''}
    </div>`;
  }

  private onlineHTML(): string {
    const { prefs, lobby, net } = this.s;
    const friends = this.onlinePage === 'friends';
    const browse = this.onlinePage === 'browse';
    const title = { entry: t('onlineTitle'), friends: t('playFriends'), browse: t('browseRooms') }[this.onlinePage];
    let content: string;
    if (friends) {
      content = `<div class="flow-field">
        <label for="codeBox">${t('haveCode')}</label>
        <div class="code-entry"><input type="text" id="codeBox" value="${esc(this.codeDraft)}" placeholder="${t('codePlaceholder')}" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="${this.pendingAction === 'join' ? 'status' : 'codeNote'}" ${this.pendingAction === 'join' && this.statusError ? 'aria-invalid="true"' : ''}>
        <button type="button" class="flow-button" id="joinBtn">${t('join')}</button></div>
        <span id="codeNote" class="sr-only">${t('roomCode')}</span>
      </div>
      ${this.pendingAction === 'join' ? this.feedbackHTML() : ''}
      <div class="flow-or"><span>${t('or')}</span></div>
      <div class="flow-action-group"><button type="button" class="flow-button primary" id="createBtn">${t('createPrivate')}</button><p class="flow-note">${t('privateRoomNote')}</p></div>`;
    } else if (browse) {
      content = `<p class="flow-note">${t('browseRoomsNote')}</p>
        <div class="room-list-heading"><span>${t('publicLobbies')}</span><button type="button" class="text-button" id="refreshBtn" ${this.listBusy ? 'disabled' : ''}>${t('refresh')}</button></div>
        <div class="room-list" id="lobbyRows" aria-live="polite" aria-busy="${this.listBusy}">${this.lobbyListHTML()}</div>
        <button type="button" class="flow-button primary" id="createBtn">${t('createPublic')}</button>`;
    } else {
      content = `<label class="flow-field" for="setName"><span>${t('yourName')}</span><input type="text" class="namebox" id="setName" maxlength="${NAME_MAX}" autocomplete="nickname" value="${esc(prefs.name)}"></label>
        <div class="flow-action-group"><button type="button" class="flow-button primary" id="quickBtn">${t('quickPlay')}</button><p class="flow-note">${t('quickPlayNote')}</p></div>
        <button type="button" class="flow-button" data-page="friends">${t('playFriends')}</button>
        <button type="button" class="text-button browse-link" data-page="browse">${t('browseRooms')}</button>
        ${lobby.rejoinCode ? `<button type="button" class="flow-button" id="rejoinBtn">${t('rejoin', { code: esc(lobby.rejoinCode) })}</button>` : ''}`;
    }
    return `<section class="online online-flow" id="online" aria-labelledby="onlineTitle" aria-busy="${this.connectionBusy}">
      <nav><button type="button" class="text-button back-link" id="backBtn"><span aria-hidden="true">←</span> ${this.onlinePage === 'entry' ? t('mainMenu') : t('backOnline')}</button></nav>
      <header><h1 id="onlineTitle" tabindex="-1">${title}</h1>${this.onlinePage === 'entry' ? `<p class="flow-note">${t('onlineSummary', { target: FFA_TARGET, max: net.maxPlayers })}</p>` : ''}</header>
      <div class="flow-content">${content}</div>
      ${friends && this.pendingAction === 'join' ? '' : this.feedbackHTML()}
    </section>`;
  }

  private lobbyHTML(): string {
    const { net, lobby, prefs } = this.s;
    const rows = this.online.lobby.lobbyRows();
    const host = net.isHost;
    const code = baseCode(host ? net.aliasCode || net.code : lobby.shown || net.code);
    const selectedMap = LEVELS.find((map) => map.key === (lobby.map || prefs.map)) || LEVELS[0];
    return `<section class="online online-flow room-flow" id="online" aria-labelledby="onlineTitle">
      <header><h1 id="onlineTitle">${t('room')}</h1>
        <div class="room-invite"><output class="room-code" id="roomCode" aria-label="${t('roomCode')}">${esc(code)}</output><button type="button" class="flow-button copy-button" id="copyCodeBtn">${t('copyCode')}</button></div>
        <p class="flow-note">${lobby.isPublic ? t('roomPublic') : t('roomPrivate')}</p>
      </header>
      <div class="flow-field">${host ? `<label for="roomMap">${t('map')}</label><select id="roomMap">${LEVELS.map((map) => `<option value="${map.key}" ${selectedMap.key === map.key ? 'selected' : ''}>${esc(map.name)}</option>`).join('')}</select>` : `<span>${t('map')}</span><p class="room-map-value">${esc(selectedMap.name)}</p>`}</div>
      <section class="room-roster" aria-labelledby="rosterTitle"><h2 id="rosterTitle">${t('roomPlayers', { current: rows.length, max: net.maxPlayers })}</h2>
        <ul class="room-players">${rows.map((p) => `<li><span>${esc(p.name)}</span><span class="player-role">${[p.id === net.id ? t('youShort') : '', p.id === lobby.hostId ? t('roomHost') : ''].filter(Boolean).join(' · ')}</span></li>`).join('')}</ul>
      </section>
      <footer class="room-footer">${host ? `<button type="button" class="flow-button primary" id="startBtn">${rows.length < 2 ? t('enterArena') : t('startMatch')}</button><p class="flow-note">${rows.length < 2 ? t('roomAloneHint') : t('roomHostHint')}</p>` : `<p class="room-waiting" role="status">${t('roomWaitingHost')}</p>`}
        ${this.feedbackHTML()}
        <button type="button" class="text-button leave-link" id="leaveBtn">${t('leaveRoom')}</button>
      </footer>
    </section>`;
  }

  private lobbyListHTML(): string {
    if (this.listBusy) return `<p class="room-list-message">${t('findingLobbies')}</p>`;
    if (this.listError) return `<p class="room-list-message is-error" role="alert">${esc(this.listError)}</p>`;
    if (!this.lobbyList?.length) return `<p class="room-list-message">${t('emptyRooms')}</p>`;
    return this.lobbyList.map((room) => {
      const map = LEVELS.find((map) => map.key === room.map);
      return `<div class="public-room"><div class="public-room-info"><strong>${t('sHostLobby', { name: esc(room.hostName || t('playerName')) })}</strong><span>${[map?.name, room.inMatch ? t('roomPlaying') : t('roomWaiting')].filter(Boolean).map(esc).join(' · ')}</span></div><span class="room-count">${esc(room.players)}/${esc(room.max)}</span><button type="button" class="flow-button" data-join="${esc(room.code)}" ${room.full ? 'disabled' : ''}>${room.full ? t('full') : t('join')}</button></div>`;
    }).join('');
  }

  private async refreshLobbies(): Promise<void> {
    const { net, prefs, signal } = this.s;
    if (this.listBusy || net.active) return;
    this.listBusy = true;
    this.listError = '';
    this.updateLobbyList();
    try {
      this.lobbyList = await net.listLobbies({ name: prefs.name });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.listError = t('lobbySearchFailed', { error: friendlyError(error) });
    } finally {
      this.listBusy = false;
      if (!signal.aborted) this.updateLobbyList();
    }
  }

  private updateLobbyList(): void {
    const rows = this.panel.querySelector('#lobbyRows');
    if (rows) {
      rows.innerHTML = this.lobbyListHTML();
      rows.setAttribute('aria-busy', String(this.listBusy));
    }
    const refresh = this.panel.querySelector<HTMLButtonElement>('#refreshBtn');
    if (refresh) refresh.disabled = this.listBusy || this.connectionBusy;
  }

  private connect(action: 'quick' | 'join' | 'create', run: () => Promise<void>): void {
    if (this.connectionBusy) return;
    const attempt = ++this.connectionAttempt;
    this.connectionBusy = true;
    this.pendingAction = action;
    this.statusError = false;
    this.s.lobby.status = t('connecting');
    this.showStart();
    this.panel.querySelector<HTMLButtonElement>('#cancelBtn')?.focus();
    void run().catch((error: unknown) => {
      if (attempt === this.connectionAttempt && !this.s.signal.aborted) this.setStatus(friendlyError(error), true);
    }).finally(() => {
      if (attempt !== this.connectionAttempt || this.s.signal.aborted) return;
      this.connectionBusy = false;
      if (this.s.game.state === 'start' && this.s.screen === 'online') {
        this.showStart();
        if (action === 'join' && this.statusError) this.panel.querySelector<HTMLInputElement>('#codeBox')?.focus();
      }
    });
  }

  private cancelConnection(): void {
    this.connectionAttempt++;
    this.connectionBusy = false;
    this.statusError = false;
    this.s.lobby.status = '';
    this.online.lobby.cancelConnection();
  }

  private async copyRoomCode(button: HTMLButtonElement): Promise<void> {
    const output = this.panel.querySelector('#roomCode');
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output.textContent || '');
      if (!button.isConnected) return;
      button.textContent = t('codeCopied');
      this.setStatus(t('codeCopied'));
      // The status is shared with later lobby renders; drop the confirmation once it has been announced.
      this.s.later(2500, () => {
        if (this.s.lobby.status === t('codeCopied')) this.setStatus('');
      });
    } catch {
      if (!output.isConnected) return;
      const range = document.createRange();
      range.selectNodeContents(output);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      this.setStatus(t('copyCodeManual'));
    }
  }

  private wireOnline(): void {
    const { net, lobby } = this.s;
    const { online } = this;
    const box = this.panel.querySelector<HTMLElement>('#online');
    if (!box) return;
    box.addEventListener('click', stop);
    box.addEventListener('keydown', stop);
    const q = <E extends HTMLElement = HTMLButtonElement>(id: string): E | null => box.querySelector<E>('#' + id);
    if (this.connectionBusy && this.s.game.state === 'start') {
      for (const control of box.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')) {
        if (control.id !== 'backBtn' && control.id !== 'cancelBtn') control.disabled = true;
      }
    }
    this.wireName(box);
    for (const button of box.querySelectorAll<HTMLButtonElement>('[data-page]')) {
      button.addEventListener('click', () => {
        if (this.connectionBusy) return;
        this.onlinePage = button.dataset.page === 'friends' ? 'friends' : 'browse';
        lobby.status = '';
        this.statusError = false;
        this.showStart();
        this.panel.querySelector<HTMLElement>('#onlineTitle')?.focus();
      });
    }
    q('quickBtn')?.addEventListener('click', () => this.connect('quick', () => online.lobby.quickPlay()));
    q('createBtn')?.addEventListener('click', () => this.connect('create', () => online.lobby.createLobby(this.onlinePage === 'browse')));
    const codeBox = q<HTMLInputElement>('codeBox');
    codeBox?.addEventListener('input', () => {
      this.codeDraft = codeBox.value.toUpperCase().replace(/\s/g, '');
      codeBox.value = this.codeDraft;
      if (this.statusError) {
        codeBox.removeAttribute('aria-invalid');
        this.setStatus('');
      }
    });
    q('joinBtn')?.addEventListener('click', () => {
      const code = this.codeDraft.trim().toUpperCase();
      if (!/^(?:[A-Z0-9]{5}|PUB\d{1,2})$/.test(code)) {
        this.pendingAction = 'join';
        this.setStatus(t('codeInvalid'), true);
        this.showStart();
        this.panel.querySelector<HTMLInputElement>('#codeBox')?.focus();
        return;
      }
      this.connect('join', () => online.lobby.joinLobby(code));
    });
    codeBox?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        q('joinBtn')?.click();
      }
    });
    q('rejoinBtn')?.addEventListener('click', () => {
      const code = lobby.rejoinCode || '';
      lobby.rejoinCode = null;
      this.connect('join', () => online.lobby.joinLobby(code));
    });
    q('cancelBtn')?.addEventListener('click', () => {
      this.cancelConnection();
      this.showStart();
      const target = { quick: 'quickBtn', join: 'codeBox', create: 'createBtn' }[this.pendingAction || 'quick'];
      this.panel.querySelector<HTMLElement>('#' + target)?.focus();
    });
    q('backBtn')?.addEventListener('click', () => {
      if (this.connectionBusy || this.onlinePage === 'browse') this.cancelConnection();
      lobby.status = '';
      this.statusError = false;
      if (this.onlinePage === 'entry') {
        this.s.screen = 'main';
        lobby.rejoinCode = null;
      } else this.onlinePage = 'entry';
      this.showStart();
      this.panel.querySelector<HTMLElement>(this.s.screen === 'main' ? '#onlineBtn' : '#onlineTitle')?.focus();
    });
    q('refreshBtn')?.addEventListener('click', () => void this.refreshLobbies());
    if (this.onlinePage === 'browse' && this.s.game.state === 'start' && !this.lobbyList && !this.listBusy && !this.listError) void this.refreshLobbies();
    q<HTMLElement>('lobbyRows')?.addEventListener('click', (event) => {
      const button = closestTarget<HTMLButtonElement>(event, 'button[data-join]');
      if (button && !button.disabled) this.connect('join', () => online.lobby.joinLobby(button.dataset.join || ''));
    });
    q<HTMLElement>('roomMap')?.addEventListener('change', (event) => {
      if (!net.isHost || !(event.target instanceof HTMLSelectElement)) return;
      lobby.map = knownMap(event.target.value);
      online.lobby.broadcastLobby();
    });
    q('copyCodeBtn')?.addEventListener('click', (event) => {
      if (event.currentTarget instanceof HTMLButtonElement) void this.copyRoomCode(event.currentTarget);
    });
    q('startBtn')?.addEventListener('click', () => {
      if (net.isHost) online.hostStart();
    });
    q('leaveBtn')?.addEventListener('click', () => {
      lobby.rejoinCode = null;
      this.onlinePage = 'entry';
      online.lobby.leaveOnline('');
      this.panel.querySelector<HTMLElement>('#onlineTitle')?.focus();
    });
  }

  /** Sets the status line of the online / lobby screen. */
  setStatus(text: string, error = false): void {
    this.statusError = error;
    this.s.lobby.status = text;
    const el = this.panel.querySelector('#status');
    if (el) {
      el.textContent = text;
      el.classList.toggle('is-error', error);
      el.setAttribute('role', error ? 'alert' : 'status');
      el.parentElement?.toggleAttribute('hidden', !text && !this.connectionBusy);
    }
  }

  /** Redraws the lobby if it is showing. */
  renderLobby(): void {
    if (this.s.game.state === 'lobby') this.showStart();
  }

  /** Shows the current start-screen panel (main, online or lobby). */
  showStart(): void {
    const { game, prefs } = this.s;
    const { hud } = this.s.ctx;
    const focusedId = this.panel.contains(document.activeElement) ? document.activeElement?.id : null;
    hud.setGameplayVisible(false);
    if (game.state === 'lobby') this.s.screen = 'lobby';
    const screen = this.s.screen;
    const html = screen === 'lobby' ? this.lobbyHTML() : screen === 'online' ? this.onlineHTML() : this.mainHTML();
    hud.showScreen(html);
    const p = this.panel;
    if (screen === 'main') {
      p.querySelector('.lw-promo')?.addEventListener('click', stop);
      this.wireSettings();
      this.wireCheckpoints((w) => this.actions.beginAtWave(w));
      this.wireMap((k) => {
        prefs.setMap(k);
        this.showStart();
      });
      p.querySelector('#soloBtn')!.addEventListener('click', (e) => {
        e.stopPropagation();
        this.actions.begin();
      });
      p.querySelector('#onlineBtn')!.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onlinePage = 'entry';
        this.statusError = false;
        this.s.screen = 'online';
        this.showStart();
        this.panel.querySelector<HTMLElement>('#onlineTitle')?.focus();
      });
    } else this.wireOnline();
    if (focusedId) {
      const focused = this.panel.querySelector<HTMLElement>('#' + CSS.escape(focusedId));
      if (focused && !focused.matches(':disabled')) focused.focus();
    }
  }

  // ---------------- in-game screens ----------------
  showPause(): void {
    const { game, net } = this.s;
    const { hud } = this.s.ctx;
    if (isOnline(game)) {
      hud.showScreen(
        `<h1>${t('menu')}</h1><h2>${t('matchLobby', { code: baseCode(net.aliasCode || net.code) })}</h2><div class="scoreboard">${this.online.scoreboard.standingsHTML()}</div>${controlsHTML()}${this.settingsHTML()}<div class="online" id="online"><div class="row"><button type="button" class="alt" id="leaveBtn">${t('leaveMatch')}</button></div></div><div class="go">${t('clickContinue', { key: hud.key('confirm') })}</div>`,
      );
      this.wireSettings();
      this.wireOnline();
      return;
    }
    hud.showScreen(
      `<h1>${t('paused')}</h1><h2>${t('pauseStats', { wave: game.wave, score: game.score })}</h2>${controlsHTML()}${this.settingsHTML()}${this.menuBtnHTML()}<div class="go">${t('clickResume', { key: hud.key('confirm') })}</div>`,
    );
    this.wireSettings();
    this.wireMenuBtn();
  }

  showClickToPlay(): void {
    const { hud } = this.s.ctx;
    hud.showScreen(`<h1>${t('matchStart')}</h1><h2>${t('matchStartSub', { target: FFA_TARGET })}</h2><div class="go">${t('clickToFight', { key: hud.key('confirm') })}</div>`);
  }

  /** The solo death screen; also records a new best score. */
  showDead(): void {
    const { game, prefs } = this.s;
    const { hud } = this.s.ctx;
    hud.setGameplayVisible(false);
    const nb = game.score > prefs.best;
    if (nb) prefs.setBest(game.score);
    hud.showScreen(
      `<h1>${t('erasedTitle')}</h1><div class="stats">${t('deathStats', { wave: game.wave, kills: game.kills, score: game.score, record: nb ? t('newRecord') : t('best', { score: prefs.best }) })}</div>${this.checkpointHTML()}${this.menuBtnHTML()}<div class="go">${t('redraw', { key: hud.key('confirm') })}</div>`,
    );
    this.wireCheckpoints((w) => this.actions.beginAtWave(w));
    this.wireMenuBtn();
  }

  /** Match results. */
  showOver(winner: Winner): void {
    const { net } = this.s;
    const { hud } = this.s.ctx;
    const title = winner.id === net.id ? t('youWon') : t('won', { name: esc(winner.name || 'Someone') });
    hud.setGameplayVisible(false);
    hud.showScreen(`<h1>${title}</h1><div class="scoreboard">${this.online.scoreboard.standingsHTML()}</div><div class="go" id="overGo">${t('backToLobby')}</div>`);
  }
}
