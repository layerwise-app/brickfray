// Unified keyboard/mouse + gamepad (PS5 DualSense / standard mapping) input.
import { clamp } from './math';

/** Weapon slot hotkeys (1-5). */
export type SlotAction = `slot${1 | 2 | 3 | 4 | 5}`;

/** Every logical action a key, mouse button or pad button can map to. */
export type InputAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'crouch'
  | 'reload'
  | 'grapple'
  | 'melee'
  | SlotAction
  | 'pause'
  | 'confirm'
  | 'grenade'
  | 'dash'
  | 'music'
  | 'talk'
  | 'score'
  | 'fire'
  | 'aim'
  | 'nextWeapon'
  | 'prevWeapon';

/** Which actions are held, keyed by action. */
type ActionFlags = Partial<Record<InputAction, boolean>>;

/** A 2D axis value, e.g. movement or look delta. */
export interface Axis2 {
  x: number;
  y: number;
}

const KEYMAP: Readonly<Partial<Record<string, InputAction>>> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'forward',
  ArrowDown: 'back',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  ControlLeft: 'crouch',
  KeyC: 'crouch',
  KeyR: 'reload',
  KeyQ: 'grapple',
  KeyE: 'grapple',
  KeyF: 'melee',
  KeyV: 'melee',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  Digit4: 'slot4',
  Digit5: 'slot5',
  Escape: 'pause',
  KeyP: 'pause',
  Enter: 'confirm',
  KeyG: 'grenade',
  KeyX: 'dash',
  AltLeft: 'dash',
  KeyM: 'music',
  KeyT: 'talk',
  Tab: 'score',
};
const MOUSEMAP: Readonly<Partial<Record<number, InputAction>>> = {
  0: 'fire',
  2: 'aim',
  1: 'grapple',
  3: 'grapple',
  4: 'melee',
};
// Standard gamepad mapping (DualSense): 0 cross,1 circle,2 square,3 triangle,4 L1,5 R1,6 L2,7 R2,8 create,9 options,10 L3,11 R3,12-15 dpad
const PADMAP: ReadonlyArray<readonly [button: number, action: InputAction]> = [
  [0, 'jump'],
  [1, 'crouch'],
  [2, 'reload'],
  [3, 'nextWeapon'],
  [4, 'grapple'],
  [5, 'melee'],
  [6, 'aim'],
  [7, 'fire'],
  [8, 'score'],
  [9, 'pause'],
  [10, 'sprint'],
  [11, 'grenade'],
  [12, 'grenade'],
  [13, 'slot5'],
  [14, 'prevWeapon'],
  [15, 'nextWeapon'],
  [17, 'confirm'],
];

/** Some browsers only expose the older `hapticActuators` list. */
type GamepadWithHaptics = Gamepad & { hapticActuators?: readonly GamepadHapticActuator[] };

/** The actions currently set in `flags`, in insertion order. */
function heldActions(flags: ActionFlags): InputAction[] {
  // Object.keys loses the key type; every key of ActionFlags is an InputAction
  return (Object.keys(flags) as InputAction[]).filter((a) => flags[a]);
}

/**
 * Polls keyboard, mouse and gamepad into per-frame action states.
 * Call `update(dt)` once per frame, then query `down` / `pressed` / `released`.
 */
export class Input {
  readonly canvas: HTMLCanvasElement;

  private state: ActionFlags = {};
  private prev: ActionFlags = {};
  private keys: ActionFlags = {};
  private mouseBtns: ActionFlags = {};
  private padState: ActionFlags = {};
  private padPrev: ActionFlags = {};

  /** Movement axis, -1..1 each, length clamped to 1 (y = forward). */
  readonly move: Axis2 = { x: 0, y: 0 };
  /** Look delta in radians for this frame. */
  readonly look: Axis2 = { x: 0, y: 0 };
  private mx = 0;
  private my = 0;
  private wheel = 0;

  mouseSens = 0.0022;
  padSensX = 3.4;
  padSensY = 2.6;
  invertY = false;

  /** True while the last input came from a gamepad. */
  usingGamepad = false;
  private gamepadIndex = -1;
  private padHoldTime = 0;
  private _pad: Gamepad | null = null;

  pointerLocked = false;
  /** Set once the user has pressed anything (used to unlock audio). */
  anyInput = false;
  /** `performance.now()` of the last real input. */
  lastActive = performance.now();

  onLockChange: ((locked: boolean) => void) | null = null;
  onDeviceChange: ((usingGamepad: boolean) => void) | null = null;

  private wantLock = false;
  private _lockRetry: ReturnType<typeof setTimeout> | undefined;

  /**
   * @param canvas the element pointer lock is requested on
   * @param signal aborting it removes every listener this instance added
   */
  constructor(canvas: HTMLCanvasElement, signal?: AbortSignal) {
    this.canvas = canvas;
    const opts: AddEventListenerOptions = { signal };

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.repeat) return;
        this.lastActive = performance.now();
        const a = KEYMAP[e.code];
        if (a) {
          this.keys[a] = true;
          if (this.usingGamepad && this.onDeviceChange) this.onDeviceChange(false);
          this.usingGamepad = false;
        }
        if (!e.shiftKey) this.keys.sprint = false;
        if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
        this.anyInput = true;
      },
      opts,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        const a = KEYMAP[e.code];
        if (a) this.keys[a] = false;
        if (!e.shiftKey) this.keys.sprint = false;
      },
      opts,
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          this.keys = {};
          this.mouseBtns = {};
        }
      },
      opts,
    );
    window.addEventListener(
      'blur',
      () => {
        this.keys = {};
        this.mouseBtns = {};
      },
      opts,
    );
    document.addEventListener(
      'mousemove',
      (e) => {
        if (!this.pointerLocked) return;
        let dx = e.movementX;
        let dy = e.movementY;
        // guard against pointer-lock spikes
        if (Math.abs(dx) > 400) dx = 0;
        if (Math.abs(dy) > 400) dy = 0;
        this.mx += dx;
        this.my += dy;
        this.usingGamepad = false;
        this.lastActive = performance.now();
      },
      opts,
    );
    document.addEventListener(
      'mousedown',
      (e) => {
        const a = MOUSEMAP[e.button];
        if (a) this.mouseBtns[a] = true;
        if (this.usingGamepad && this.onDeviceChange) this.onDeviceChange(false);
        this.usingGamepad = false;
        this.anyInput = true;
        this.lastActive = performance.now();
        if (e.button === 1 || e.button === 3 || e.button === 4) e.preventDefault();
      },
      opts,
    );
    document.addEventListener(
      'mouseup',
      (e) => {
        const a = MOUSEMAP[e.button];
        if (a) this.mouseBtns[a] = false;
      },
      opts,
    );
    document.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    document.addEventListener(
      'wheel',
      (e) => {
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: true, signal },
    );
    document.addEventListener(
      'pointerlockchange',
      () => {
        this.pointerLocked = document.pointerLockElement === this.canvas;
        if (this.onLockChange) this.onLockChange(this.pointerLocked);
      },
      opts,
    );
    window.addEventListener(
      'gamepadconnected',
      (e) => {
        this.gamepadIndex = e.gamepad.index;
      },
      opts,
    );
    // a pending lock retry must not outlive the game
    signal?.addEventListener(
      'abort',
      () => {
        this.wantLock = false;
        clearTimeout(this._lockRetry);
      },
      { once: true },
    );
  }

  // browsers refuse a new pointer lock for about a second after Esc released the last one, so a
  // failed request is retried until it takes or the game stops wanting it
  requestLock(): void {
    this.wantLock = true;
    if (this.pointerLocked) return;
    const attempt = (opts?: PointerLockOptions): Promise<void> => {
      try {
        // older browsers return undefined instead of a promise
        const p: Promise<void> | undefined = this.canvas.requestPointerLock(opts);
        return p && typeof p.catch === 'function' ? p : Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    };
    attempt({ unadjustedMovement: true })
      .catch(() => attempt())
      .catch(() => {
        clearTimeout(this._lockRetry);
        this._lockRetry = setTimeout(() => {
          if (this.wantLock && !this.pointerLocked) this.requestLock();
        }, 1200);
      });
  }

  exitLock(): void {
    this.wantLock = false;
    clearTimeout(this._lockRetry);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private _getPad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const known = this.gamepadIndex >= 0 ? pads[this.gamepadIndex] : null;
    if (known) return known;
    for (const p of pads) {
      if (p && p.connected) {
        this.gamepadIndex = p.index;
        return p;
      }
    }
    return null;
  }

  update(dt: number): void {
    // rotate button states
    this.prev = this.state;
    this.state = {};
    const s = this.state;
    for (const k of heldActions(this.keys)) s[k] = true;
    for (const k of heldActions(this.mouseBtns)) s[k] = true;
    if (this.wheel > 0) s.nextWeapon = true;
    else if (this.wheel < 0) s.prevWeapon = true;
    this.wheel = 0;

    // movement from keys
    let mx = (s.right ? 1 : 0) - (s.left ? 1 : 0);
    let my = (s.forward ? 1 : 0) - (s.back ? 1 : 0);
    // look from mouse
    let lx = -this.mx * this.mouseSens;
    let ly = -this.my * this.mouseSens;
    this.mx = 0;
    this.my = 0;

    const pad = this._getPad();
    const padS: ActionFlags = {};
    if (pad) {
      const dz = (v: number): number => (Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86);
      const ax = dz(pad.axes[0] || 0);
      const ay = dz(pad.axes[1] || 0);
      const rx = dz(pad.axes[2] || 0);
      const ry = dz(pad.axes[3] || 0);
      let padActive = false;
      if (Math.abs(ax) > 0 || Math.abs(ay) > 0) {
        mx = ax;
        my = -ay;
        padActive = true;
      }
      if (Math.abs(rx) > 0 || Math.abs(ry) > 0) {
        padActive = true;
        const mag = Math.hypot(rx, ry);
        if (mag > 0.94) this.padHoldTime += dt;
        else this.padHoldTime = 0;
        const accel = 1 + clamp((this.padHoldTime - 0.25) / 0.6, 0, 1) * 0.9;
        const curve = (v: number): number => Math.sign(v) * Math.pow(Math.abs(v), 1.8);
        lx += -curve(rx) * this.padSensX * accel * dt;
        ly += -curve(ry) * this.padSensY * accel * dt;
      } else {
        this.padHoldTime = 0;
      }
      for (const [idx, action] of PADMAP) {
        const b = pad.buttons[idx];
        if (!b) continue;
        const pressed = b.pressed || b.value > 0.35;
        if (pressed) {
          s[action] = true;
          padS[action] = true;
          padActive = true;
        }
      }
      if (padActive) {
        if (!this.usingGamepad && this.onDeviceChange) this.onDeviceChange(true);
        this.usingGamepad = true;
        this.anyInput = true;
        this.lastActive = performance.now();
      }
      this._pad = pad;
    } else {
      this._pad = null;
    }
    this.padPrev = this.padState;
    this.padState = padS;

    const ml = Math.hypot(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    this.move.x = mx;
    this.move.y = my;
    this.look.x = lx;
    this.look.y = this.invertY ? -ly : ly;
  }

  /** Whether `a` is held this frame. */
  down(a: InputAction): boolean {
    return !!this.state[a];
  }

  /** Seconds since the last real input. */
  get idleSeconds(): number {
    return (performance.now() - this.lastActive) / 1000;
  }

  /** Whether `a` went down this frame (pad edges are tracked separately so `consume` can't hide them). */
  pressed(a: InputAction): boolean {
    return (!!this.state[a] && !this.prev[a]) || (!!this.padState[a] && !this.padPrev[a]);
  }

  /** Whether `a` was let go this frame. */
  released(a: InputAction): boolean {
    return !this.state[a] && !!this.prev[a];
  }

  /** Clears `a` for the rest of this frame. */
  consume(a: InputAction): void {
    this.state[a] = false;
  }

  /** Whether any action went down this frame. */
  anyPressed(): boolean {
    for (const k of heldActions(this.state)) if (!this.prev[k]) return true;
    return false;
  }

  /** Plays a dual-motor rumble on the active gamepad, if it supports haptics. */
  rumble(strong = 0.5, weak = 0.5, ms = 80): void {
    const pad: GamepadWithHaptics | null = this._pad;
    if (!pad) return;
    const act = pad.vibrationActuator || (pad.hapticActuators && pad.hapticActuators[0]);
    if (!act || !act.playEffect) return;
    try {
      void act.playEffect('dual-rumble', {
        duration: ms,
        strongMagnitude: clamp(strong, 0, 1),
        weakMagnitude: clamp(weak, 0, 1),
      });
    } catch {
      /* ignore */
    }
  }
}
