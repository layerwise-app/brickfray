import { BUTTON } from '../sim/types';
import { GamepadInput } from './gamepad-input';
import { inputMode, onInputMode, watchInputMode } from './input-mode';
import { TouchInput, type TouchSettings } from './touch-input';
import { enterPlayScreen } from './touch-screen';

export { DEFAULT_TOUCH } from './touch-input';

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
  touch: TouchSettings;
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
const noAssist = (yaw: number, pitch: number): [number, number] => [yaw, pitch];

/** An on-screen choice (solo upgrade cards): while one is up, the captured mouse moves its pointer instead of the view. */
export interface Picker {
  move(dx: number, dy: number): void;
  click(): void;
  choose(index: number): void;
  step(direction: number): void;
  /** A tap on a card takes it at once. */
  pick(index: number): void;
}

const PICK_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };

/** Ctrl+W closes the tab in browsers everywhere but on Apple systems, where that is Cmd+W. */
function ctrlClosesTab() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return !/mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent);
}

type KeyboardLock = { lock(codes?: string[]): Promise<void>; unlock(): void };
const keyboardLock = () => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;

/** Chromium only: elsewhere Esc in fullscreen also leaves fullscreen, and Ctrl+W closes the tab. */
export const canLockKeyboard = () => typeof keyboardLock()?.lock === 'function';

/**
 * Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Q, Ctrl+Tab and Esc belong to the browser, and a page can't cancel them in a window.
 * During a fullscreen match, Keyboard Lock hands them to the game: Esc then only pauses, and holding it leaves
 * fullscreen (the browser says so when fullscreen starts).
 */
async function lockKeyboard(on: boolean) {
  const keyboard = keyboardLock();
  if (!keyboard) return;
  if (!on) return keyboard.unlock();
  try {
    await keyboard.lock(['KeyW', 'KeyT', 'KeyN', 'KeyQ', 'Tab', 'Escape']);
  } catch {
    // The browser refused (fullscreen not entered through the page, or no support).
  }
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

/**
 * Keyboard, pointer-locked mouse, gamepad and the on-screen touch controls, merged into per-frame intent. Touch play
 * has no pointer lock: being engaged (in a match, no menu up) stands in for it, so `locked`, `lock` and `unlock` mean
 * "the player is in control" either way.
 */
export class Input {
  settings: InputSettings;
  readonly touch = new TouchInput();
  /** For auto-fire: true while the sight is on an enemy. The game sets it for the running match. */
  sights: (() => boolean) | null = null;
  private pointerLocked = false;
  private engaged = false;
  private wantPlayScreen = false;
  private down = new Set<string>();
  private pressedOnce = new Set<string>();
  private dx = 0;
  private dy = 0;
  private wheel = 0;
  private adsToggled = false;
  private readonly pad = new GamepadInput();
  private readonly frame: FrameInput = { lookYaw: 0, lookPitch: 0, forward: 0, right: 0, buttons: 0, slot: null, cycle: 0, scoreboard: false, usingGamepad: false };
  usingGamepad = false;
  onMenu: (() => void) | null = null;
  onChat: (() => void) | null = null;
  onCtrlHint: (() => void) | null = null;
  private picker: Picker | null = null;
  private on = false;
  private lockLostAt = -Infinity;
  private cleanup: (() => void)[] = [];

  /** On during a match. */
  get enabled() {
    return this.on;
  }

  set enabled(on: boolean) {
    this.on = on;
    this.syncKeyboard();
  }

  private syncKeyboard = () => void lockKeyboard(this.on && !!document.fullscreenElement);

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
      this.pointerLocked = document.pointerLockElement === this.element;
      if (!this.pointerLocked) {
        this.down.clear();
        this.lockLostAt = performance.now();
      }
    });
    on(window, 'blur', () => this.down.clear());
    on(document, 'fullscreenchange', this.syncKeyboard);
    this.cleanup.push(watchInputMode(), onInputMode(this.onMode), () => void lockKeyboard(false));
  }

  get touchMode() {
    return inputMode() === 'touch';
  }

  /** The player is in control: the pointer is captured, or (touch) the match is being played. */
  get locked() {
    return this.touchMode ? this.engaged : this.pointerLocked;
  }

  get active() {
    return this.enabled && this.locked;
  }

  /** Must run inside a click: browsers only grant pointer lock (and fullscreen) to a user gesture. */
  async lock() {
    if (this.touchMode) {
      if (!this.engaged) this.setEngaged(true);
      this.wantPlayScreen = true;
      return this.playScreen();
    }
    if (this.pointerLocked) return;
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
    if (this.engaged) this.setEngaged(false);
    if (!this.enabled) {
      this.frame.slot = null;
      this.frame.cycle = 0;
    }
  }

  /** Fullscreen and the landscape lock, from a tap when the match start came without one. */
  async playScreen() {
    if (!this.wantPlayScreen) return;
    this.wantPlayScreen = false;
    if (!(await enterPlayScreen())) this.wantPlayScreen = true;
  }

  /** Game pauses and resumes on pointer lock changes; touch play has no lock and announces itself the same way. */
  private setEngaged(on: boolean) {
    this.engaged = on;
    this.touch.reset();
    this.down.clear();
    document.dispatchEvent(new Event('pointerlockchange'));
  }

  private onMode = () => {
    this.touch.reset();
    if (!this.enabled) return;
    if (this.touchMode && this.pointerLocked) {
      // A touch on a game the trackpad had captured (tablet with a keyboard case) carries on by touch.
      this.engaged = true;
      document.exitPointerLock();
    } else if (!this.touchMode && this.engaged) {
      // A mouse taken up mid-match has to capture the pointer, from a click on the pause menu.
      this.setEngaged(false);
    }
  };

  private matches(action: Action, code: string) {
    const b = this.settings.bindings[action];
    return b[0] === code || b[1] === code;
  }

  private key(e: KeyboardEvent, down: boolean) {
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (down && e.code === 'Escape') {
      // With Esc locked (fullscreen match) the browser passes it on instead of freeing the mouse; freeing it pauses.
      // The Esc that the browser itself used to free the mouse may still arrive here; it must not close the menu it opened.
      if (this.pointerLocked) this.unlock();
      else if (performance.now() - this.lockLostAt > 300) this.onMenu?.();
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
    this.touch.reset();
  }

  /** A tap on upgrade card `index`. */
  pick(index: number) {
    if (this.active) this.picker?.pick(index);
  }

  private mouse(e: MouseEvent, down: boolean) {
    if (!this.enabled || !this.pointerLocked) return;
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
    if (!this.enabled || !this.pointerLocked) return;
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

  /**
   * Collect this frame's intent; `adsZoom` scales look speed while aiming. The result is reused every frame. A slot
   * change still on it was not taken (the frame ran no tick) and carries over to this one.
   */
  read(dt: number, adsZoom: number, assist: (yawRate: number, pitchRate: number) => [number, number] = noAssist): FrameInput {
    const s = this.settings;
    const f = this.frame;
    const zoomScale = adsZoom > 1 ? (1 / adsZoom) * s.adsSensitivity : 1;
    const k = MOUSE_RADIANS * s.sensitivity * zoomScale;
    f.lookYaw = -this.dx * k;
    f.lookPitch = -this.dy * k * (s.invertY ? -1 : 1);
    this.dx = 0;
    this.dy = 0;
    f.forward = (this.held('forward') ? 1 : 0) - (this.held('back') ? 1 : 0);
    f.right = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let b = 0;
    if (this.held('fire')) b |= BUTTON.fire;
    if (s.toggleAds ? this.adsToggled : this.held('ads')) b |= BUTTON.ads;
    if (this.held('jump')) b |= BUTTON.jump;
    if (this.held('crouch')) b |= BUTTON.crouch;
    if (this.held('sprint')) b |= BUTTON.sprint;
    if (this.held('reload')) b |= BUTTON.reload;
    if (this.held('melee')) b |= BUTTON.melee;
    if (this.held('grenade')) b |= this.held('sprint') ? BUTTON.grenade | BUTTON.grenadeLow : BUTTON.grenade;
    f.buttons = b;
    if (this.pressed('weapon2')) f.slot = 1;
    else if (this.pressed('weapon1')) f.slot = 0;
    const wheel = Math.sign(this.wheel);
    this.wheel = 0;
    if (wheel) f.cycle = wheel;
    f.scoreboard = this.held('scoreboard');
    if (this.touchMode) {
      const t = s.touch;
      this.touch.apply(f, dt, performance.now(), t.sensitivity * zoomScale, s.invertY, dt > 0 ? assist : null, t.autoFire && this.active ? this.sights : null);
    }
    f.usingGamepad = this.usingGamepad && !(f.forward || f.right || f.lookYaw || f.lookPitch || f.buttons);
    this.pad.read(f, dt, zoomScale, s, assist, this.picker, this.onMenu);
    this.usingGamepad = f.usingGamepad;
    this.pressedOnce.clear();
    return f;
  }


  dispose() {
    for (const fn of this.cleanup) fn();
    this.pad.dispose();
    this.unlock();
  }
}
