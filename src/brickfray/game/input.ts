import { BUTTON } from '../sim/types';

export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'crouch'
  | 'sprint'
  | 'reload'
  | 'melee'
  | 'grenade'
  | 'fire'
  | 'ads'
  | 'weapon1'
  | 'weapon2'
  | 'scoreboard'
  | 'chat';

/** KeyboardEvent.code values, or Mouse0/Mouse1/Mouse2. Two bindings per action. */
export type Bindings = Record<Action, [string, string?]>;

export const DEFAULT_BINDINGS: Bindings = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  crouch: ['KeyC', 'ControlLeft'],
  sprint: ['ShiftLeft'],
  reload: ['KeyR'],
  melee: ['KeyF', 'KeyV'],
  grenade: ['KeyG'],
  fire: ['Mouse0'],
  ads: ['Mouse2'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  scoreboard: ['Tab'],
  chat: ['Enter', 'KeyT']
};

export interface InputSettings {
  bindings: Bindings;
  /** Degrees of yaw per mouse count ×0.022 (CS-style). */
  sensitivity: number;
  adsSensitivity: number;
  invertY: boolean;
  toggleAds: boolean;
  gamepadSensitivity: number;
  aimAssist: number;
}

export interface FrameInput {
  lookYaw: number;
  lookPitch: number;
  forward: number;
  right: number;
  buttons: number;
  /** Requested slot change this frame: 0 primary, 1 sidearm; or +1/-1 cycle via `cycle`. */
  slot: number | null;
  cycle: number;
  scoreboard: boolean;
  usingGamepad: boolean;
}

const MOUSE_RADIANS = (0.022 * Math.PI) / 180;

/** An on-screen choice (solo upgrade cards): while one is up, the captured mouse moves its pointer instead of the view. */
export interface Picker {
  move(dx: number, dy: number): void;
  click(): void;
  choose(index: number): void;
  step(direction: number): void;
}

const PICK_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };

/** Ctrl+W closes the tab in browsers everywhere but on Apple systems, where that is Cmd+W. */
function ctrlClosesTab() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return !/mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent);
}

const HINT_SEEN = 'brickfray.ctrlHintSeen';
let hintSeenFallback = false;

/** The Ctrl+W hint shows at most once per browser session. */
function takeCtrlHint() {
  try {
    if (sessionStorage.getItem(HINT_SEEN)) return false;
    sessionStorage.setItem(HINT_SEEN, '1');
    return true;
  } catch {
    if (hintSeenFallback) return false;
    hintSeenFallback = true;
    return true;
  }
}

/** Keyboard, pointer-locked mouse and gamepad, merged into per-frame intent. */
export class Input {
  settings: InputSettings;
  locked = false;
  private down = new Set<string>();
  private pressedOnce = new Set<string>();
  private dx = 0;
  private dy = 0;
  private wheel = 0;
  private adsToggled = false;
  private padPrev: boolean[] = [];
  usingGamepad = false;
  onMenu: (() => void) | null = null;
  onChat: (() => void) | null = null;
  onCtrlHint: (() => void) | null = null;
  private picker: Picker | null = null;
  enabled = false;
  private cleanup: (() => void)[] = [];

  constructor(
    private readonly element: HTMLElement,
    settings: InputSettings
  ) {
    this.settings = settings;
    const on = <K extends keyof DocumentEventMap>(target: Window | Document | HTMLElement, type: K, fn: (e: DocumentEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', (e) => this.key(e, true));
    on(window, 'keyup', (e) => this.key(e, false));
    on(element, 'mousedown', (e) => this.mouse(e, true));
    on(window, 'mouseup', (e) => this.mouse(e, false));
    on(window, 'mousemove', (e) => this.move(e));
    on(element, 'wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
    on(element, 'contextmenu', (e) => e.preventDefault());
    on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      if (!this.locked) this.down.clear();
    });
    on(window, 'blur', () => this.down.clear());
  }

  /** Must run inside a click: browsers only grant pointer lock to a user gesture. */
  async lock() {
    if (this.locked) return;
    try {
      await (this.element.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => Promise<void>)({ unadjustedMovement: true });
    } catch {
      try {
        await this.element.requestPointerLock();
      } catch {
        // Refused (e.g. clicked again right after Esc); the click-to-play prompt stays up.
      }
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  get active() {
    return this.enabled && this.locked;
  }

  private matches(action: Action, code: string) {
    const b = this.settings.bindings[action];
    return b[0] === code || b[1] === code;
  }

  private key(e: KeyboardEvent, down: boolean) {
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (down && e.code === 'Escape' && !this.locked) {
      this.onMenu?.();
      return;
    }
    if (!this.active) return;
    const pick = PICK_KEYS[e.code];
    if (this.picker && pick !== undefined) {
      e.preventDefault();
      if (down && !e.repeat) this.picker.choose(pick);
      if (!down) this.down.delete(e.code);
      return;
    }
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ControlLeft', 'Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code) || e.ctrlKey) e.preventDefault();
    if (down && this.matches('chat', e.code)) {
      // Otherwise this Enter's keypress lands in the chat box that just opened and submits it.
      e.preventDefault();
      this.onChat?.();
      return;
    }
    if (down && (e.code === 'ControlLeft' || e.code === 'ControlRight') && !document.fullscreenElement && ctrlClosesTab() && takeCtrlHint()) this.onCtrlHint?.();
    if (down) {
      if (!this.down.has(e.code)) this.pressedOnce.add(e.code);
      this.down.add(e.code);
    } else this.down.delete(e.code);
  }

  /** A held trigger or aim lets go when a choice comes up, so the gun stops with it. */
  setPicker(picker: Picker | null) {
    this.picker = picker;
    this.down.delete('Mouse0');
    this.down.delete('Mouse2');
    this.dx = this.dy = 0;
  }

  private mouse(e: MouseEvent, down: boolean) {
    if (!this.active) return;
    if (this.picker && down) {
      e.preventDefault();
      if (e.button === 0) this.picker.click();
      return;
    }
    const code = `Mouse${e.button}`;
    if (down) {
      e.preventDefault();
      if (!this.down.has(code)) this.pressedOnce.add(code);
      this.down.add(code);
      if (this.settings.toggleAds && this.matches('ads', code)) this.adsToggled = !this.adsToggled;
    } else this.down.delete(code);
  }

  private move(e: MouseEvent) {
    if (!this.active) return;
    // Ignore the occasional giant jump some browsers emit when lock engages.
    if (Math.abs(e.movementX) > 600 || Math.abs(e.movementY) > 600) return;
    if (this.picker) return this.picker.move(e.movementX, e.movementY);
    this.dx += e.movementX;
    this.dy += e.movementY;
  }

  private held(action: Action) {
    const [a, b] = this.settings.bindings[action];
    return this.down.has(a) || (b !== undefined && this.down.has(b));
  }

  private pressed(action: Action) {
    const [a, b] = this.settings.bindings[action];
    return this.pressedOnce.has(a) || (b !== undefined && this.pressedOnce.has(b));
  }

  /** Collect this frame's intent; `adsZoom` scales look speed while aiming. */
  read(dt: number, adsZoom: number, assist: (yawRate: number, pitchRate: number) => [number, number] = (y, p) => [y, p]): FrameInput {
    const s = this.settings;
    const zoomScale = adsZoom > 1 ? (1 / adsZoom) * s.adsSensitivity : 1;
    const k = MOUSE_RADIANS * s.sensitivity * zoomScale;
    let lookYaw = -this.dx * k;
    let lookPitch = -this.dy * k * (s.invertY ? -1 : 1);
    this.dx = 0;
    this.dy = 0;
    let forward = (this.held('forward') ? 1 : 0) - (this.held('back') ? 1 : 0);
    let right = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let buttons = 0;
    const set = (bit: number, on: boolean) => {
      if (on) buttons |= bit;
    };
    set(BUTTON.fire, this.held('fire'));
    set(BUTTON.ads, s.toggleAds ? this.adsToggled : this.held('ads'));
    set(BUTTON.jump, this.held('jump'));
    set(BUTTON.crouch, this.held('crouch'));
    set(BUTTON.sprint, this.held('sprint'));
    set(BUTTON.reload, this.held('reload'));
    set(BUTTON.melee, this.held('melee'));
    set(BUTTON.grenade, this.held('grenade'));
    set(BUTTON.grenadeLow, this.held('grenade') && this.held('sprint'));
    let slot: number | null = null;
    (['weapon1', 'weapon2'] as const).forEach((a, i) => {
      if (this.pressed(a)) slot = i;
    });
    let cycle = Math.sign(this.wheel);
    this.wheel = 0;
    let scoreboard = this.held('scoreboard');
    if (forward || right || lookYaw || lookPitch || buttons) this.usingGamepad = false;

    const pad = this.readGamepad();
    if (pad) {
      const dead = (v: number) => (Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86);
      const curve = (v: number) => Math.sign(v) * Math.abs(v) ** 1.8;
      const lx = dead(pad.axes[0] ?? 0);
      const ly = dead(pad.axes[1] ?? 0);
      const rx = curve(dead(pad.axes[2] ?? 0));
      const ry = curve(dead(pad.axes[3] ?? 0));
      const b = (i: number) => pad.buttons[i]?.pressed ?? false;
      const edge = (i: number) => b(i) && !this.padPrev[i];
      if (lx || ly || rx || ry || pad.buttons.some((x) => x.pressed)) this.usingGamepad = true;
      if (this.usingGamepad) {
        forward = -ly;
        right = lx;
        const rate = 3.2 * s.gamepadSensitivity * zoomScale;
        const [yawRate, pitchRate] = assist(-rx * rate, -ry * rate * (s.invertY ? -1 : 1));
        lookYaw += yawRate * dt;
        lookPitch += pitchRate * dt;
        set(BUTTON.fire, (pad.buttons[7]?.value ?? 0) > 0.3);
        set(BUTTON.ads, (pad.buttons[6]?.value ?? 0) > 0.3);
        set(BUTTON.jump, b(0));
        set(BUTTON.crouch, b(1));
        set(BUTTON.reload, b(2));
        set(BUTTON.grenade, b(5));
        set(BUTTON.melee, b(11));
        set(BUTTON.sprint, b(10) || (forward > 0.9 && b(10)));
        if (edge(3)) cycle = 1;
        if (edge(9)) this.onMenu?.();
        if (this.picker && edge(14)) this.picker.step(-1);
        if (this.picker && edge(15)) this.picker.step(1);
        if (this.picker && edge(0)) this.picker.click();
        scoreboard ||= b(8);
      }
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }
    this.pressedOnce.clear();
    return { lookYaw, lookPitch, forward, right, buttons, slot, cycle, scoreboard, usingGamepad: this.usingGamepad };
  }

  private readGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    for (const pad of navigator.getGamepads()) if (pad && pad.connected && pad.mapping === 'standard') return pad;
    return null;
  }

  /** In fullscreen, Keyboard Lock lets Ctrl+W and Esc reach the game instead of the browser. */
  static async lockKeyboard() {
    const keyboard = (navigator as Navigator & { keyboard?: { lock(codes?: string[]): Promise<void> } }).keyboard;
    try {
      await keyboard?.lock(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft', 'Tab', 'Escape']);
    } catch {
      // Not supported outside fullscreen or in this browser.
    }
  }

  dispose() {
    for (const fn of this.cleanup) fn();
    this.unlock();
  }
}
