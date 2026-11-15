/**
 * The menu screens drawn in the HUD panel: start (main / online / lobby), pause, click-to-play,
 * death and match results, with their settings, map and checkpoint pickers. Each screen is plain
 * markup plus the wiring for its buttons; what the buttons do comes from the session.
 */
import { FFA_TARGET, NAME_MAX } from '../config';
import { currentLang, t } from '../core/i18n';
import type { Input } from '../core/input';
import type { Net } from '../net/net';
import { friendlyError } from '../session/lobby';
import type { Online } from '../session/online';
import { baseCode, esc, isOnline } from '../session/state';
import type { Session, Winner } from '../session/state';
import { Preferences, knownMap } from '../storage';
import { LEVELS } from '../world/level';
import type { MapKey } from '../world/level';
import { CONTROLS_HTML } from './hud';

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
    const savedLang = Preferences.readUiLang() ?? currentLang();
    return `<div class="settings" id="settings">
    <div class="langrow"><span>${t('language')}</span><select id="setLang"><option value="auto">${t('langAuto')}</option><option value="en" ${savedLang === 'en' ? 'selected' : ''}>${t('langEnglish')}</option><option value="zh" ${savedLang === 'zh' ? 'selected' : ''}>${t('langChinese')}</option></select></div>
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
        location.search = langSel.value === 'auto' ? '' : '?lang=' + langSel.value;
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
    return `<h1>${t('appTitle')}</h1><h2>${t('appSubtitle')}</h2>
    <div class="mainbtns"><button type="button" class="start" id="soloBtn">${t('startSolo')}<i>${t('startSoloHint')}</i></button><button type="button" id="onlineBtn">${t('online')}<i>${t('onlineHint')}</i></button></div>
    ${this.mapHTML(prefs.map, true)}${CONTROLS_HTML}${this.settingsHTML()}${this.checkpointHTML()}${prefs.best ? `<div class="beststat">${t('bestScore', { score: prefs.best })}</div>` : ''}`;
  }

  private onlineHTML(): string {
    const { lobby, prefs } = this.s;
    return `<h1>${t('onlineTitle')}</h1><h2>${t('onlineSubtitle', { target: FFA_TARGET, max: 10 })}</h2>
    <div class="online" id="online">
      <div class="row"><span>${t('yourName')}</span><input type="text" class="namebox" id="setName" maxlength="14" value="${esc(prefs.name)}"></div>
      <div class="row"><button type="button" class="big" id="quickBtn">${t('quickMatch')}</button><span class="hint">${t('quickMatchHint')}</span></div>
      <div class="row split"><span>${t('or')}</span></div>
      <div class="row"><button type="button" id="createBtn">${t('createLobby')}</button><div class="radio"><label><input type="radio" name="vis" value="public" ${lobby.isPublic ? 'checked' : ''}> ${t('publicLobby')}</label><label><input type="radio" name="vis" value="private" ${lobby.isPublic ? '' : 'checked'}> ${t('privateLobby')}</label></div></div>
      <div class="row"><span>${t('haveCode')}</span><input type="text" id="codeBox" placeholder="${t('codePlaceholder')}" maxlength="5" autocomplete="off"><button type="button" id="joinBtn">${t('join')}</button></div>
      <div class="lobbylist" id="lobbylist"><div class="row"><span>${t('publicLobbies')}</span><button type="button" class="alt" id="refreshBtn">${t('refresh')}</button></div><div class="rows" id="lobbyRows">${this.lobbyListHTML()}</div></div>
      <div class="status" id="status">${esc(lobby.status || '')}</div>
      ${lobby.rejoinCode ? `<div class="row"><button type="button" class="big" id="rejoinBtn">${t('rejoin', { code: esc(lobby.rejoinCode) })}</button></div>` : ''}
      <div class="row"><button type="button" class="alt" id="backBtn">${t('back')}</button></div>
    </div>`;
  }

  private lobbyHTML(): string {
    const { net, lobby, prefs } = this.s;
    const rows = this.online.lobby.lobbyRows();
    const host = net.isHost;
    const n = rows.length;
    return `<h1>${t('lobbyTitle')}</h1><h2>${t('lobbySubtitle', { target: FFA_TARGET, current: n, max: net.maxPlayers })}</h2>
    <div class="online" id="online">
      <div class="row"><span>${t('code')}</span><span class="code">${baseCode(net.isHost ? net.aliasCode || net.code : lobby.shown || net.code)}</span></div>
      ${this.mapHTML(lobby.map || prefs.map, host)}
      <div class="hint">${lobby.isPublic ? t('publicLobbyHint') : t('privateLobbyHint')}</div>
      <div class="plist">${rows.map((p) => `<div class="${p.id === lobby.hostId ? 'host' : ''}${p.id === net.id ? ' me' : ''}"><span>${esc(p.name)}</span><span>${p.id === net.id ? t('youShort') : ''}</span></div>`).join('')}</div>
      <div class="row"><button type="button" class="big" id="startBtn">${t('startMatch')}</button><button type="button" class="alt" id="leaveBtn">${t('leave')}</button></div>
      <div class="status" id="status">${esc(lobby.status || '')}</div><div class="hint">${t('anyoneStart', { note: n < 2 ? t('lateJoinHint') : t('playersReady', { count: n }) })}</div>
    </div>`;
  }

  private lobbyListHTML(): string {
    if (this.listBusy) return `<div class="hint">${t('findingLobbies')}</div>`;
    if (!this.lobbyList) return `<div class="hint">${t('clickRefresh')}</div>`;
    if (!this.lobbyList.length) return `<div class="hint">${t('clickQuick')}</div>`;
    return this.lobbyList
      .map(
        (l) =>
          `<div class="lobbyrow"><span class="code">${esc(l.code)}</span><span>${t('sHostLobby', { name: esc(l.hostName || 'Someone') })}</span><span>${l.players}/${l.max}${l.inMatch ? t('inMatchSuffix') : ''}</span>${l.full ? `<span class="status">${t('full')}</span>` : `<button type="button" data-join="${esc(l.code)}">${t('join')}</button>`}</div>`,
      )
      .join('');
  }

  private async refreshLobbies(): Promise<void> {
    const { net, prefs, signal } = this.s;
    if (this.listBusy || net.active) return;
    this.listBusy = true;
    const box = this.panel.querySelector('#lobbyRows');
    if (box) box.innerHTML = this.lobbyListHTML();
    let err: unknown = null;
    try {
      this.lobbyList = await net.listLobbies({ name: prefs.name });
    } catch (e) {
      this.lobbyList = [];
      err = e;
    }
    if (signal.aborted) return;
    this.listBusy = false;
    const rows = this.panel.querySelector('#lobbyRows');
    if (rows) rows.innerHTML = err ? `<div class="hint">${t('lobbySearchFailed', { error: esc(friendlyError(err)) })}</div>` : this.lobbyListHTML();
  }

  private wireOnline(): void {
    const { net, lobby } = this.s;
    const { online } = this;
    const box = this.panel.querySelector<HTMLElement>('#online');
    if (!box) return;
    box.addEventListener('click', stop);
    box.addEventListener('keydown', stop);
    const q = <E extends HTMLElement = HTMLButtonElement>(id: string): E | null => box.querySelector<E>('#' + id);
    this.wireName(box);
    q('quickBtn')?.addEventListener('click', () => {
      this.lockButtons(box);
      void online.lobby.quickPlay();
    });
    q('createBtn')?.addEventListener('click', () => {
      this.lockButtons(box);
      void online.lobby.createLobby(box.querySelector<HTMLInputElement>('input[name=vis]:checked')!.value === 'public');
    });
    const joinBtn = q('joinBtn');
    const codeBox = q<HTMLInputElement>('codeBox');
    if (joinBtn && codeBox) {
      joinBtn.addEventListener('click', () => {
        const c = codeBox.value.trim().toUpperCase();
        if (!c) {
          this.setStatus(t('enterCode'));
          return;
        }
        this.lockButtons(box);
        void online.lobby.joinLobby(c);
      });
      codeBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') joinBtn.click();
      });
    }
    q('rejoinBtn')?.addEventListener('click', () => {
      const c = lobby.rejoinCode;
      lobby.rejoinCode = null;
      this.lockButtons(box);
      void online.lobby.joinLobby(c ?? '');
    });
    q('backBtn')?.addEventListener('click', () => {
      lobby.status = '';
      lobby.rejoinCode = null;
      this.s.screen = 'main';
      this.showStart();
    });
    const refreshBtn = q('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => void this.refreshLobbies());
      if (!this.lobbyList && !this.listBusy) void this.refreshLobbies();
    }
    q<HTMLElement>('lobbyRows')?.addEventListener('click', (e) => {
      const b = closestTarget<HTMLButtonElement>(e, 'button[data-join]');
      if (b) {
        this.lockButtons(box);
        void online.lobby.joinLobby(b.dataset.join ?? '');
      }
    });
    this.wireMap((k) => {
      if (net.isHost) {
        lobby.map = k;
        online.lobby.broadcastLobby();
      }
    });
    q('startBtn')?.addEventListener('click', () => {
      if (net.isHost) online.hostStart();
      else {
        net.send('startreq', {});
        this.setStatus(t('requestingHost'));
      }
    });
    q('leaveBtn')?.addEventListener('click', () => {
      lobby.rejoinCode = null;
      online.lobby.leaveOnline('');
    });
  }

  private lockButtons(box: HTMLElement): void {
    for (const b of box.querySelectorAll('button')) if (b.id !== 'backBtn') b.disabled = true;
  }

  unlockButtons(): void {
    const box = this.panel.querySelector('#online');
    if (box) for (const b of box.querySelectorAll('button')) b.disabled = false;
  }

  /** Sets the status line of the online / lobby screen. */
  setStatus(text: string): void {
    this.s.lobby.status = text;
    const el = this.panel.querySelector('#status');
    if (el) el.textContent = text;
  }

  /** Redraws the lobby if it is showing. */
  renderLobby(): void {
    if (this.s.game.state === 'lobby') this.showStart();
  }

  /** Shows the current start-screen panel (main, online or lobby). */
  showStart(): void {
    const { game, prefs } = this.s;
    const { hud } = this.s.ctx;
    hud.setGameplayVisible(false);
    if (game.state === 'lobby') this.s.screen = 'lobby';
    const screen = this.s.screen;
    const html = screen === 'lobby' ? this.lobbyHTML() : screen === 'online' ? this.onlineHTML() : this.mainHTML();
    hud.showScreen(html, true);
    const p = this.panel;
    if (screen === 'main') {
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
        this.s.screen = 'online';
        this.showStart();
      });
    } else this.wireOnline();
  }

  // ---------------- in-game screens ----------------
  showPause(): void {
    const { game, net } = this.s;
    const { hud } = this.s.ctx;
    if (isOnline(game)) {
      hud.showScreen(
        `<h1>${t('menu')}</h1><h2>${t('matchLobby', { code: baseCode(net.aliasCode || net.code) })}</h2><div class="scoreboard">${this.online.scoreboard.standingsHTML()}</div>${CONTROLS_HTML}${this.settingsHTML()}<div class="online" id="online"><div class="row"><button type="button" class="alt" id="leaveBtn">${t('leaveMatch')}</button></div></div><div class="go">${t('clickContinue', { key: hud.key('confirm') })}</div>`,
      );
      this.wireSettings();
      this.wireOnline();
      return;
    }
    hud.showScreen(
      `<h1>${t('paused')}</h1><h2>${t('pauseStats', { wave: game.wave, score: game.score })}</h2>${CONTROLS_HTML}${this.settingsHTML()}${this.menuBtnHTML()}<div class="go">${t('clickResume', { key: hud.key('confirm') })}</div>`,
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
