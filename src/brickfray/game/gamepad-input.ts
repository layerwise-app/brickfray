import { BUTTON } from '../sim/types';
import type { FrameInput, InputSettings, Picker } from './input';

const DEAD = 0.14;
const dead = (v: number) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
const curve = (v: number) => Math.sign(v) * Math.abs(v) ** 1.8;
/** Standard-mapping button index → command bit (triggers are read by value instead). */
const HELD: [number, number][] = [
  [0, BUTTON.jump],
  [1, BUTTON.crouch],
  [2, BUTTON.reload],
  [5, BUTTON.grenade],
  [11, BUTTON.melee],
  [10, BUTTON.sprint]
];

type Assist = (yawRate: number, pitchRate: number) => [number, number];

/** A standard-mapping controller. Polled only once one has shown up (browsers announce a pad on its first press). */
export class GamepadInput {
  private seen = false;
  private prev: boolean[] = [];
  private cleanup: () => void = () => undefined;

  constructor() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    this.seen = navigator.getGamepads().some((p) => p !== null);
    const connected = () => {
      this.seen = true;
    };
    window.addEventListener('gamepadconnected', connected);
    this.cleanup = () => window.removeEventListener('gamepadconnected', connected);
  }

  private pad(): Gamepad | null {
    if (!this.seen) return null;
    for (const pad of navigator.getGamepads()) if (pad && pad.connected && pad.mapping === 'standard') return pad;
    return null;
  }

  /**
   * Folds the pad into `f` when it is the input in use (any stick or button wakes it; keyboard, mouse or touch in
   * `f` already put it to sleep). Edge presses drive the menu and the upgrade picker.
   */
  read(f: FrameInput, dt: number, zoomScale: number, s: InputSettings, assist: Assist, picker: Picker | null, onMenu: (() => void) | null) {
    const pad = this.pad();
    if (!pad) return;
    const buttons = pad.buttons;
    const lx = dead(pad.axes[0] ?? 0);
    const ly = dead(pad.axes[1] ?? 0);
    const rx = curve(dead(pad.axes[2] ?? 0));
    const ry = curve(dead(pad.axes[3] ?? 0));
    let any = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0;
    for (let i = 0; i < buttons.length && !any; i++) any = buttons[i]!.pressed;
    if (any) f.usingGamepad = true;
    if (f.usingGamepad) {
      f.forward = -ly;
      f.right = lx;
      const rate = 3.2 * s.gamepadSensitivity * zoomScale;
      const [yawRate, pitchRate] = assist(-rx * rate, -ry * rate * (s.invertY ? -1 : 1));
      f.lookYaw += yawRate * dt;
      f.lookPitch += pitchRate * dt;
      if ((buttons[7]?.value ?? 0) > 0.3) f.buttons |= BUTTON.fire;
      if ((buttons[6]?.value ?? 0) > 0.3) f.buttons |= BUTTON.ads;
      for (const [i, bit] of HELD) if (buttons[i]?.pressed) f.buttons |= bit;
      if (this.edge(buttons, 3)) f.cycle = 1;
      if (this.edge(buttons, 9)) onMenu?.();
      if (picker && this.edge(buttons, 14)) picker.step(-1);
      if (picker && this.edge(buttons, 15)) picker.step(1);
      if (picker && this.edge(buttons, 0)) picker.click();
      if (buttons[8]?.pressed) f.scoreboard = true;
    }
    this.prev.length = buttons.length;
    for (let i = 0; i < buttons.length; i++) this.prev[i] = buttons[i]!.pressed;
  }

  private edge(buttons: readonly GamepadButton[], i: number) {
    return (buttons[i]?.pressed ?? false) && !this.prev[i];
  }

  dispose() {
    this.cleanup();
  }
}
