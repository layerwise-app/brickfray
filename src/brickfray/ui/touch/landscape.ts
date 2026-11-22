import { useSyncExternalStore } from 'react';
import { phoneSized, touchCapable } from '../../game/input-mode';
import { fitStyleSheets, watchStyleSheets } from './frame-css';

/**
 * Phones are landscape only. Held upright (the browser in portrait), the whole app is drawn turned a quarter clockwise
 * in a box as wide as the viewport is tall, so turning the phone to the left shows it the right way up; the browser's
 * bars then sit at the box's short ends. Once the browser itself turns to landscape (or locks it in fullscreen), the
 * app stands straight in that viewport. Tablets and desktops are never turned.
 */
export interface Frame {
  rotated: boolean;
  /** The app's own landscape box, in CSS px. */
  width: number;
  height: number;
}

let frame: Frame = { rotated: false, width: 0, height: 0 };
let held = false;
const listeners = new Set<() => void>();

export function currentFrame() {
  return frame;
}

export function onFrame(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** A viewport point (clientX, clientY) in the app's own box. */
export function toFrame(x: number, y: number) {
  return frame.rotated ? { x: y, y: frame.height - x } : { x, y };
}

/** An element's box in the app's own coordinates (a quarter turn keeps boxes square to the axes). */
export function frameRect(el: Element): DOMRect {
  const r = el.getBoundingClientRect();
  return frame.rotated ? new DOMRect(r.top, frame.height - r.right, r.height, r.width) : r;
}

function measure(): Frame {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const rotated = height > width && phoneSized() && touchCapable();
  return rotated ? { rotated, width: Math.min(height, barFreeHeight()), height: width } : { rotated, width, height };
}

/**
 * The viewport's height with every browser bar showing (100svh). A browser whose bar floats over the page (Safari on
 * newer iPhones) can report the page's height under it; the turned app ends above the bar instead.
 */
function barFreeHeight() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const tall = probe.getBoundingClientRect().height;
  probe.remove();
  return tall > 0 ? tall : Infinity;
}

const INSETS = { top: 'right', right: 'bottom', bottom: 'left', left: 'top' } as const;

function apply(fromResize: boolean) {
  if (held) return;
  const next = measure();
  if (next.rotated === frame.rotated && next.width === frame.width && next.height === frame.height) return;
  const turned = next.rotated !== frame.rotated;
  frame = next;
  const html = document.documentElement;
  html.classList.toggle('bf-rotated', next.rotated);
  const vars: Record<string, string> = {
    '--bf-frame-w': `${next.width}px`,
    '--bf-frame-h': `${next.height}px`,
    '--bf-vw': `${next.width / 100}px`,
    '--bf-vh': `${next.height / 100}px`
  };
  for (const [side, from] of Object.entries(INSETS)) vars[`--bf-inset-${side}`] = `env(safe-area-inset-${next.rotated ? from : side}, 0px)`;
  for (const [name, value] of Object.entries(vars)) html.style.setProperty(name, value);
  if (turned || next.rotated) fitStyleSheets(next.rotated ? next : null);
  for (const fn of listeners) fn();
  // The game sizes its canvas on window resizes; a change that came without one has to tell it.
  if (!fromResize) window.dispatchEvent(new Event('resize'));
}

/**
 * Keeps the box as it is while the upright text editor is open: the on-screen keyboard can shrink the viewport and must
 * not turn the app or resize it under the editor.
 */
export function holdFrame(on: boolean) {
  held = on;
  if (!on) apply(false);
}

/** Follows the viewport while the app is mounted. Started before the game, so this resize listener runs ahead of the game's. */
export function watchFrame() {
  const onResize = () => apply(true);
  // iOS can report the old size on the first resize after a turn; the settled size follows shortly.
  let settle = 0;
  const onTurn = () => {
    clearTimeout(settle);
    settle = window.setTimeout(() => apply(false), 350);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onTurn);
  const offSheets = watchStyleSheets(() => {
    if (frame.rotated) fitStyleSheets(frame);
  });
  apply(true);
  return () => {
    clearTimeout(settle);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onTurn);
    offSheets();
    fitStyleSheets(null);
    document.documentElement.classList.remove('bf-rotated');
    frame = { rotated: false, width: 0, height: 0 };
  };
}

/** The app's box, re-rendering when it turns or resizes. */
export function useFrame() {
  return useSyncExternalStore(onFrame, currentFrame, currentFrame);
}
