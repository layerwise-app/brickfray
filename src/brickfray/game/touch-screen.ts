import { phoneSized } from './input-mode';

type Lockable = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

/** The player switched fullscreen off (settings, menu button): touch play stops bringing it back until they switch it on. */
let declined = false;

/**
 * Fullscreen, and on a phone the landscape lock, where the browser allows them: both need a user gesture, and the lock
 * needs fullscreen (Chrome on Android). iPhone Safari allows neither; there the app turns itself to landscape
 * (ui/touch/landscape.ts) and the menu offers the home-screen install instead. False when the browser refused for want
 * of a gesture, so a later tap can try again.
 */
export async function enterPlayScreen(): Promise<boolean> {
  if (declined) return true;
  try {
    if (!document.fullscreenElement && canFullscreen()) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return false;
  }
  await lockLandscape();
  return true;
}

/** iPhone Safari has no element fullscreen; there the switches for it are left out. */
export function canFullscreen() {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === 'function';
}

/** The player switched fullscreen off themselves. */
export function fullscreenDeclined() {
  return declined;
}

export function isFullscreen() {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

export function onFullscreen(fn: () => void) {
  document.addEventListener('fullscreenchange', fn);
  return () => document.removeEventListener('fullscreenchange', fn);
}

/** The player's own switch (menu button, settings); must run inside a click. */
export async function setFullscreen(on: boolean) {
  declined = !on;
  if (!on) {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    return;
  }
  await enterPlayScreen();
}

/**
 * Phones are landscape only, menus included: in fullscreen the browser holds landscape however the phone is turned,
 * and the app stands straight in it. Leaving fullscreen releases the lock.
 */
async function lockLandscape() {
  if (!phoneSized() || !document.fullscreenElement) return;
  try {
    await (screen.orientation as Lockable | undefined)?.lock?.('landscape');
  } catch {
    // Not every browser locks even in fullscreen; the app turns itself while the phone is upright.
  }
}
