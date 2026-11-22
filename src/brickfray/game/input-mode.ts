/** On-screen touch controls, or keyboard and mouse. A device with both follows the input used last. */
export type InputMode = 'touch' | 'mouse';

/** A mouse has to travel this far (px) without a click before a touch player counts as switching to it. */
const MOUSE_TRAVEL = 40;

const listeners = new Set<() => void>();
let mode: InputMode = 'mouse';
let started = false;
let travel = 0;

/** A phone, tablet or touch laptop. Decides defaults (quality tier); which controls show follows `inputMode`. */
export function touchCapable() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/** Phone-sized: plays in landscape only. Tablets play either way up. */
export function phoneSized() {
  if (typeof window === 'undefined') return false;
  return Math.min(screen.width, screen.height) < 600;
}

export function inputMode() {
  return mode;
}

export function onInputMode(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function setMode(next: InputMode) {
  travel = 0;
  if (next === mode) return;
  mode = next;
  document.documentElement.classList.toggle('bf-touch', next === 'touch');
  for (const fn of listeners) fn();
}

const onPointerDown = (e: PointerEvent) => setMode(e.pointerType === 'mouse' ? 'mouse' : 'touch');

const onPointerMove = (e: PointerEvent) => {
  if (mode !== 'touch' || e.pointerType !== 'mouse') return;
  travel += Math.abs(e.movementX) + Math.abs(e.movementY);
  if (travel > MOUSE_TRAVEL) setMode('mouse');
};

/** Starts following the input in use: a coarse primary pointer starts in touch mode, then the last pointer type used wins. */
export function watchInputMode() {
  if (started || typeof window === 'undefined') return () => undefined;
  started = true;
  mode = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'mouse';
  document.documentElement.classList.toggle('bf-touch', mode === 'touch');
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  return () => {
    started = false;
    window.removeEventListener('pointerdown', onPointerDown, { capture: true });
    window.removeEventListener('pointermove', onPointerMove, { capture: true });
  };
}
