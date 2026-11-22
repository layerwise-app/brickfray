import type { Game } from '../../game/game';
import { STICK_SPRINT, type Drag, type TouchButton } from '../../game/touch-input';
import { DRAG_AIMS, RUN_LOCK, STICK } from './touch-layout';

/** The stick's parts: the ring (moved to where the thumb lands) and the knob inside it. */
export interface StickParts {
  base: HTMLElement;
  knob: HTMLElement;
}

interface Slot {
  kind: 'stick' | 'look' | 'button';
  id: TouchButton | null;
  el: HTMLElement | null;
  drag: Drag | null;
}

const newDrag = (): Drag => ({ x: 0, y: 0, t: 0, speed: 0, live: false });
const prevent = (e: Event) => e.preventDefault();

/**
 * Routes every finger on the touch layer by its pointer id: the first on the stick side floats the stick to where it
 * lands, the first on the other side looks, and any finger on a button presses it (fire, aim and grenade also aim
 * while dragged). Fingers never take over each other's job, so a press never disturbs the look.
 */
export class TouchPad {
  private readonly slots = new Map<number, Slot>();
  private stickId = -1;
  private lookId = -1;
  private baseX = 0;
  private baseY = 0;
  private armed = false;
  private stance = '';
  private live: boolean;
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly parts: StickParts,
    private readonly game: Game
  ) {
    const on = <K extends keyof HTMLElementEventMap>(target: HTMLElement | Document, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    on(root, 'pointerdown', this.down);
    on(root, 'pointermove', this.move);
    on(root, 'pointerup', this.up);
    on(root, 'pointercancel', this.up);
    on(root, 'lostpointercapture', this.up);
    on(root, 'contextmenu', prevent);
    // iOS Safari still pans, zooms or bounces on some gestures that touch-action alone doesn't stop.
    on(document, 'touchmove', prevent, { passive: false });
    on(document, 'gesturestart' as keyof HTMLElementEventMap, prevent, { passive: false });
    this.live = this.canAct();
    this.cleanup.push(game.hud.subscribe(this.onHud));
  }

  /** Alive and not choosing an upgrade: the stick, the look side and the action buttons work. */
  private canAct() {
    const s = this.game.hud.state;
    return s.alive && !(s.offer && !s.offer.picked);
  }

  /** Death or the upgrade cards let go of everything: fingers still down do nothing until lifted. */
  private onHud = () => {
    const live = this.canAct();
    if (live === this.live) return;
    this.live = live;
    if (live) return;
    for (const slot of this.slots.values()) if (slot.el) slot.el.dataset.pressed = 'false';
    this.slots.clear();
    this.stickId = this.lookId = -1;
    this.game.input.touch.reset();
    this.rest();
  };

  private get settings() {
    return this.game.settings.input.touch;
  }

  private down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone.
    }
    const touch = this.game.input.touch;
    const el = (e.target as Element).closest<HTMLElement>('[data-touch]');
    const control = el?.dataset.touch;
    if (control === 'pause') return this.game.setPaused(true);
    if (control === 'scoreboard') return touch.toggleScoreboard();
    if (!this.live) return;
    const now = performance.now();
    if (el && control) {
      const id = control as TouchButton;
      touch.press(id, now);
      el.dataset.pressed = 'true';
      let drag: Drag | null = null;
      if (DRAG_AIMS.has(id)) {
        drag = newDrag();
        touch.beginDrag(drag, e.clientX, e.clientY, e.timeStamp, false);
      }
      this.slots.set(e.pointerId, { kind: 'button', id, el, drag });
      return;
    }
    const half = this.root.clientWidth / 2;
    const stickSide = this.settings.leftHanded ? e.clientX >= half : e.clientX < half;
    if (stickSide && this.stickId === -1) {
      this.stickId = e.pointerId;
      this.slots.set(e.pointerId, { kind: 'stick', id: null, el: null, drag: null });
      this.startStick(e.clientX, e.clientY);
    } else if (!stickSide && this.lookId === -1) {
      this.lookId = e.pointerId;
      const drag = newDrag();
      touch.beginDrag(drag, e.clientX, e.clientY, e.timeStamp, true);
      this.slots.set(e.pointerId, { kind: 'look', id: null, el: null, drag });
    }
  };

  private move = (e: PointerEvent) => {
    const slot = this.slots.get(e.pointerId);
    if (!slot) return;
    if (slot.kind === 'stick') this.stickTo(e.clientX, e.clientY);
    else if (slot.drag) this.game.input.touch.drag(slot.drag, e.clientX, e.clientY, e.timeStamp);
  };

  private up = (e: PointerEvent) => {
    const slot = this.slots.get(e.pointerId);
    if (e.type === 'pointerup') void this.game.input.playScreen();
    if (!slot) return;
    this.slots.delete(e.pointerId);
    const touch = this.game.input.touch;
    if (slot.drag) touch.endDrag();
    if (slot.kind === 'stick') {
      this.stickId = -1;
      touch.stickEnd(this.armed);
      this.rest();
    } else if (slot.kind === 'look') this.lookId = -1;
    else if (slot.id && slot.el) {
      touch.release(slot.id, performance.now());
      slot.el.dataset.pressed = 'false';
    }
  };

  private get radius() {
    return STICK.radius * this.settings.buttonSize;
  }

  private startStick(x: number, y: number) {
    const r = this.radius;
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.baseX = Math.min(w - r - 6, Math.max(r + 6, x));
    this.baseY = Math.min(h - r - 6, Math.max(r + 6, y));
    const base = this.parts.base;
    base.style.setProperty('--bx', `${this.baseX}px`);
    base.style.setProperty('--by', `${this.baseY}px`);
    base.dataset.active = 'true';
    this.stickTo(x, y);
  }

  private stickTo(x: number, y: number) {
    const r = this.radius;
    const dx = x - this.baseX;
    const dy = y - this.baseY;
    const dist = Math.hypot(dx, dy);
    const k = dist > r ? r / dist : 1;
    this.parts.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    this.game.input.touch.stick((dx * k) / r, (dy * k) / r);
    this.armed = -dy > r * RUN_LOCK && Math.abs(dx) < r * 0.9;
    const running = dist * k >= r * STICK_SPRINT && -dy > dist * 0.5;
    this.setStance(this.armed ? 'lock' : running ? 'run' : 'walk');
  }

  private setStance(stance: string) {
    if (stance === this.stance) return;
    this.stance = stance;
    this.parts.base.dataset.stance = stance;
  }

  /** Back to the resting place, faint, until the next thumb lands. */
  private rest() {
    this.armed = false;
    this.parts.base.dataset.active = 'false';
    this.parts.knob.style.transform = '';
    this.setStance('');
  }

  dispose() {
    for (const fn of this.cleanup) fn();
    this.slots.clear();
  }
}
