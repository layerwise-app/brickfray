// DOM heads-up display drawn in "pen" style (multiplied over the paper canvas).
import { t, hudHTML } from '../core/i18n';

/** Every element of the HUD markup (see `hudHTML`) the HUD writes to, keyed by its id. */
export interface HudElements {
  crosshair: HTMLDivElement;
  gret: HTMLDivElement;
  hitmarker: HTMLDivElement;
  dmg: HTMLDivElement;
  score: HTMLElement;
  combo: HTMLDivElement;
  wave: HTMLElement;
  modifier: HTMLDivElement;
  left: HTMLElement;
  timer: HTMLDivElement;
  hpfill: HTMLDivElement;
  hpnum: HTMLSpanElement;
  mag: HTMLElement;
  reserve: HTMLSpanElement;
  reloading: HTMLSpanElement;
  tally: HTMLDivElement;
  weapon: HTMLDivElement;
  hint: HTMLDivElement;
  slots: HTMLDivElement;
  tip: HTMLDivElement;
  msg: HTMLDivElement;
  msgsub: HTMLDivElement;
  killfeed: HTMLDivElement;
  screen: HTMLDivElement;
  panel: HTMLDivElement;
  nades: HTMLSpanElement;
  scope: HTMLDivElement;
  focusmark: HTMLDivElement;
  focusmeter: HTMLDivElement;
  fmfill: HTMLDivElement;
  bossbar: HTMLDivElement;
  bossname: HTMLDivElement;
  bossfill: HTMLDivElement;
  pvpscore: HTMLDivElement;
  board: HTMLDivElement;
  gstam: HTMLDivElement;
  gstamfill: HTMLElement;
}

/** One weapon slot in the bottom-right weapon list. */
export interface HudSlot {
  name: string;
  active: boolean;
  /** Shown after the name, e.g. `'12/48'` or `'∞'`. */
  ammo: string | number;
  empty?: boolean;
}

/** Extra crosshair style class; `''` is the default gun crosshair. */
export type CrosshairMode = '' | 'katana';

/** Grapple reticle: 0 hidden, 1 a target is in range, 2 attached. */
export type GrappleReticle = 0 | 1 | 2;

export class HUD {
  readonly root: HTMLElement;
  readonly el: Readonly<HudElements>;

  /** Called when the player switches between keyboard/mouse and gamepad. */
  onDevice: ((pad: boolean) => void) | null = null;
  /** Called when the overlay screen (menus, pause, death) is clicked. */
  onScreenClick: (() => void) | null = null;
  onLangChange: (() => void) | null = null;

  private _msgT = 0;
  private _tipT = 0;
  private _scope = false;
  private _nades = -1;
  private _pad = false;
  private _controlsDevice: 'mouse' | 'controller' = 'mouse';
  private _fmShow = false;
  private _fmFrac = -1;
  private _fmReady = false;
  private _fmLabel: string | undefined;
  private _lastTally = -1;
  private _lastSlots = '';
  private _ads = false;
  private _mode: CrosshairMode = '';

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = hudHTML();
    const q = <K extends keyof HudElements>(id: K): HudElements[K] => {
      const node = root.querySelector<HudElements[K]>('#' + id);
      if (!node) throw new Error(`HUD markup is missing #${id}`);
      return node;
    };
    this.el = {
      crosshair: q('crosshair'),
      gret: q('gret'),
      hitmarker: q('hitmarker'),
      dmg: q('dmg'),
      score: q('score'),
      combo: q('combo'),
      wave: q('wave'),
      modifier: q('modifier'),
      left: q('left'),
      timer: q('timer'),
      hpfill: q('hpfill'),
      hpnum: q('hpnum'),
      mag: q('mag'),
      reserve: q('reserve'),
      reloading: q('reloading'),
      tally: q('tally'),
      weapon: q('weapon'),
      hint: q('hint'),
      slots: q('slots'),
      tip: q('tip'),
      msg: q('msg'),
      msgsub: q('msgsub'),
      killfeed: q('killfeed'),
      screen: q('screen'),
      panel: q('panel'),
      nades: q('nades'),
      scope: q('scope'),
      focusmark: q('focusmark'),
      focusmeter: q('focusmeter'),
      fmfill: q('fmfill'),
      bossbar: q('bossbar'),
      bossname: q('bossname'),
      bossfill: q('bossfill'),
      pvpscore: q('pvpscore'),
      board: q('board'),
      gstam: q('gstam'),
      gstamfill: q('gstamfill'),
    };
    this.el.screen.addEventListener('click', () => {
      if (this.onScreenClick) this.onScreenClick();
    });
  }

  // katana charge gauge: fills with katana kills, catches fire when a focus slash is ready
  setFocusMeter(show: boolean, frac: number, ready: boolean, label: string = t('focusMeterLabel')): void {
    const m = this.el.focusmeter;
    if (show !== this._fmShow) {
      this._fmShow = show;
      m.classList.toggle('on', show);
    }
    if (!show) return;
    if (label !== this._fmLabel) {
      this._fmLabel = label;
      const labelEl = m.querySelector('.fm-label');
      if (labelEl) labelEl.textContent = label;
    }
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - this._fmFrac) > 0.005) {
      this._fmFrac = f;
      this.el.fmfill.style.height = (f * 100).toFixed(1) + '%';
    }
    if (ready !== this._fmReady) {
      this._fmReady = ready;
      m.classList.toggle('ready', ready);
    }
  }

  setGrenades(n: number): void {
    if (n === this._nades) return;
    this._nades = n;
    let h = '';
    for (let i = 0; i < n; i++) h += '<i></i>';
    this.el.nades.innerHTML = h;
  }

  // control labels follow whatever you touched last
  setDevice(pad: boolean): void {
    if (pad === this._pad) return;
    this._pad = pad;
    this.root.classList.toggle('pad', pad);
    if (this.onDevice) this.onDevice(pad);
  }

  /** The key/button label for `action` on the current input device. */
  key(action: ControlName): string {
    return (this._pad ? PAD_KEYS : KB_KEYS)[action] || action;
  }

  setScope(on: boolean): void {
    if (on === this._scope) return;
    this._scope = on;
    this.el.scope.classList.toggle('on', on);
  }

  /** Moves the focus-slash target mark to screen position (x, y); `null` hides it. */
  setFocusMark(x: number | null, y = 0): void {
    const m = this.el.focusmark;
    if (x == null) {
      m.classList.remove('on');
      return;
    }
    m.classList.add('on');
    m.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  }

  setSpread(px: number): void {
    this.el.crosshair.style.setProperty('--s', px.toFixed(1) + 'px');
  }

  setCrosshairMode(mode: CrosshairMode): void {
    this._mode = mode;
    this._applyCross();
  }

  setAds(on: boolean): void {
    if (on === this._ads) return;
    this._ads = on;
    this._applyCross();
  }

  private _applyCross(): void {
    this.el.crosshair.className = 'crosshair ' + this._mode + (this._ads ? ' ads' : '');
  }

  setGrappleStamina(f: number): void {
    const show = f < 0.995;
    if (this.el.gstam.hidden === show) this.el.gstam.hidden = !show;
    if (show) {
      this.el.gstamfill.style.width = (f * 100).toFixed(0) + '%';
      this.el.gstam.classList.toggle('low', f < 0.2);
    }
  }

  grappleTarget(state: GrappleReticle): void {
    this.el.gret.className = 'grapple-ret' + (state === 1 ? ' on' : state === 2 ? ' on attached' : '');
  }

  hitmarker(kill = false, crit = false): void {
    const h = this.el.hitmarker;
    h.className = 'hitmarker' + (kill ? ' kill' : '') + (crit ? ' crit' : '');
    void h.offsetWidth; // restart the CSS animation
    h.classList.add('show');
  }

  setAmmo(mag: number, reserve: number, _magSize: number, reloading = false): void {
    this.el.mag.textContent = String(mag);
    this.el.reserve.textContent = '/' + reserve;
    this.el.reloading.textContent = reloading ? t('reloading') : '';
    if (mag !== this._lastTally) {
      this._lastTally = mag;
      let s = '';
      for (let i = 0; i < Math.min(mag, 40); i++) s += '<i></i>';
      this.el.tally.innerHTML = s;
    }
  }

  setKatana(): void {
    this.el.mag.textContent = '∞';
    this.el.reserve.textContent = '';
    this.el.reloading.textContent = '';
    if (this._lastTally !== -1) {
      this.el.tally.innerHTML = '';
      this._lastTally = -1;
    }
  }

  setSlots(slots: readonly HudSlot[]): void {
    const key = slots.map((s) => `${s.name}|${s.active ? 1 : 0}|${s.ammo}`).join(';');
    if (key === this._lastSlots) return;
    this._lastSlots = key;
    this.el.slots.innerHTML = slots
      .map(
        (s, i) =>
          `<div class="slot${s.active ? ' active' : ''}${s.empty ? ' empty' : ''}"><span class="num">${i + 1}</span>${s.name}<span class="sammo">${s.ammo}</span></div>`,
      )
      .join('');
  }

  setHealth(hp: number, max: number): void {
    const f = Math.max(0, hp / max);
    this.el.hpfill.style.width = (f * 100).toFixed(1) + '%';
    this.el.hpnum.textContent = String(Math.ceil(hp));
    this.root.classList.toggle('low', f < 0.3);
  }

  /** Shows the scoreboard with `html`, or hides it for `null`/empty. */
  setBoard(html: string | null): void {
    const on = !!html;
    this.el.board.hidden = !on;
    if (on) this.el.board.innerHTML = html;
  }

  /** Shows the online score panel in place of the wave counters, or restores them for `null`/empty. */
  setPvpScore(html: string | null): void {
    const on = !!html;
    this.el.pvpscore.hidden = !on;
    if (on) this.el.pvpscore.innerHTML = html;
    // both counters sit inside their own row element in the HUD markup
    this.el.wave.parentElement!.hidden = on;
    this.el.left.parentElement!.hidden = on;
  }

  setWave(n: number, left: number): void {
    this.el.wave.textContent = String(n);
    this.el.left.textContent = String(left);
  }

  setModifier(text?: string | null): void {
    this.el.modifier.textContent = text || '';
  }

  setTimer(text?: string | null): void {
    this.el.timer.textContent = text || '';
  }

  setScore(score: number, combo: number): void {
    this.el.score.textContent = String(score);
    this.el.combo.textContent = combo > 1 ? t('combo') + combo : '';
  }

  setWeapon(name: string, hint?: string | null): void {
    this.el.weapon.textContent = name;
    this.el.hint.textContent = hint || '';
  }

  /** Shows the boss bar at `frac` health, or hides it when `frac` is null. */
  setBoss(name: string | null, frac: number | null | undefined): void {
    if (frac == null) {
      this.el.bossbar.classList.remove('show');
      return;
    }
    this.el.bossbar.classList.add('show');
    this.el.bossname.textContent = name;
    this.el.bossfill.style.width = (Math.max(0, frac) * 100).toFixed(1) + '%';
  }

  /** Shows a tip (HTML) for `dur` seconds. */
  tip(text: string, dur = 5): void {
    this.el.tip.innerHTML = text;
    this.el.tip.classList.add('show');
    this._tipT = dur;
  }

  /** Shows a big centered message with an optional subline for `dur` seconds. */
  message(main: string, sub = '', dur = 2.2): void {
    const m = this.el.msg;
    m.textContent = main;
    m.classList.remove('show');
    void m.offsetWidth; // restart the CSS animation
    m.classList.add('show');
    this.el.msgsub.textContent = sub;
    this._msgT = dur;
  }

  /** Adds a kill-feed line (HTML), with a `+pts` badge when `pts > 0`. */
  kill(text: string, pts: number): void {
    const d = document.createElement('div');
    d.innerHTML = pts > 0 ? `${text} <span class="pts">+${pts}</span>` : text;
    this.el.killfeed.appendChild(d);
    setTimeout(() => d.remove(), 1700);
    // more than six children means there is a first child to drop
    while (this.el.killfeed.children.length > 6) this.el.killfeed.firstChild!.remove();
  }

  /** Flashes a damage indicator pointing at `angle` (radians, screen space). */
  damageFrom(angle: number): void {
    const i = document.createElement('i');
    i.style.transform = `rotate(${((angle * 180) / Math.PI).toFixed(1)}deg)`;
    this.el.dmg.appendChild(i);
    setTimeout(() => i.remove(), 1000);
  }

  private selectControlsTab(device: 'mouse' | 'controller', focus = false): void {
    this._controlsDevice = device;
    for (const tab of this.el.panel.querySelectorAll<HTMLButtonElement>('[data-controls-tab]')) {
      const selected = tab.dataset.controlsTab === device;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    }
    for (const panel of this.el.panel.querySelectorAll<HTMLElement>('[data-controls-panel]')) {
      panel.hidden = panel.dataset.controlsPanel !== device;
    }
  }

  /** Shows the overlay screen with `html` in its panel. */
  showScreen(html: string): void {
    this.el.panel.innerHTML = html;
    const controls = this.el.panel.querySelector<HTMLElement>('.controls');
    if (controls) {
      this.selectControlsTab(this._controlsDevice);
      controls.addEventListener('click', (event) => {
        event.stopPropagation();
        const tab = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-controls-tab]') : null;
        if (tab) this.selectControlsTab(tab.dataset.controlsTab === 'controller' ? 'controller' : 'mouse');
      });
      controls.addEventListener('keydown', (event) => {
        // Only the tab keys stop here; Space and the pause key still reach the game's Input.
        if (!(event.target instanceof Element) || !event.target.closest('[data-controls-tab]')) return;
        let device: 'mouse' | 'controller';
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') device = this._controlsDevice === 'mouse' ? 'controller' : 'mouse';
        else if (event.key === 'Home') device = 'mouse';
        else if (event.key === 'End') device = 'controller';
        else return;
        event.preventDefault();
        event.stopPropagation();
        this.selectControlsTab(device, true);
      });
    }
    this.el.screen.classList.add('show');
  }

  hideScreen(): void {
    this.el.screen.classList.remove('show');
  }

  setGameplayVisible(v: boolean): void {
    this.root.classList.toggle('nogame', !v);
  }

  update(dt: number): void {
    if (this._msgT > 0) {
      this._msgT -= dt;
      if (this._msgT <= 0) {
        this.el.msg.classList.remove('show');
        this.el.msgsub.textContent = '';
      }
    }
    if (this._tipT > 0) {
      this._tipT -= dt;
      if (this._tipT <= 0) this.el.tip.classList.remove('show');
    }
  }
}

/** Keyboard/mouse labels for each control, as shown in tips and prompts. */
export const KB_KEYS = {
  fire: 'LMB',
  aim: 'RMB',
  block: 'RMB',
  jump: 'Space',
  sprint: 'Shift',
  slide: 'C',
  dash: 'C',
  grapple: 'Q',
  melee: 'F',
  reload: 'R',
  grenade: 'G',
  get focus() { return t('keyFocus'); },
  get next() { return t('keyWheel'); },
  pause: 'Esc',
  confirm: 'Space',
  score: 'Tab',
};

/** A control whose key label `HUD.key()` can show. */
export type ControlName = keyof typeof KB_KEYS;

/** Gamepad (DualSense) labels for each control. */
export const PAD_KEYS: Record<ControlName, string> = {
  fire: 'R2',
  aim: 'L2',
  block: 'L2',
  jump: '✕',
  sprint: 'L3',
  slide: '○',
  dash: '○',
  grapple: 'L1',
  melee: 'R1',
  reload: '□',
  grenade: 'R3',
  focus: 'L2 + R2',
  next: '△',
  pause: 'Options',
  confirm: '✕',
  score: 'Create',
};
