import { phoneSized } from './input-mode';

type Lockable = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

let locked = false;
/** The player switched fullscreen off (settings, menu button): touch play stops bringing it back until they switch it on. */
let declined = false;

/**
 * Fullscreen, and on a phone the landscape lock, where the browser allows them: both need a user gesture, and the lock
 * needs fullscreen (Chrome on Android). iPhone Safari allows neither; the layout copes with its bars and the rotate
 * prompt covers portrait. False when the browser refused for want of a gesture, so a later tap can try again.
 */
export async function enterPlayScreen(): Promise<boolean> {
  if (declined) return true;
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && document.fullscreenEnabled && root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return false;
  }
  if (phoneSized() && document.fullscreenElement) {
    try {
      await (screen.orientation as Lockable | undefined)?.lock?.('landscape');
      locked = true;
    } catch {
      // Not every browser locks even in fullscreen.
    }
  }
  return true;
}

/** iPhone Safari has no element fullscreen; there the switches for it are left out. */
export function canFullscreen() {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === 'function';
}

export function isFullscreen() {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

export function onFullscreen(fn: () => void) {
  document.addEventListener('fullscreenchange', fn);
  return () => document.removeEventListener('fullscreenchange', fn);
}

/** The player's own switch (menu button, settings); must run inside a click. In a match, fullscreen is the play screen. */
export async function setFullscreen(on: boolean, playing: boolean) {
  declined = !on;
  if (!on) {
    leavePlayScreen();
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    return;
  }
  if (playing) {
    await enterPlayScreen();
    return;
  }
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
}

/** Leaving the match: menus turn with the phone again. Fullscreen stays, for the next match. */
export function leavePlayScreen() {
  if (!locked) return;
  locked = false;
  try {
    screen.orientation?.unlock();
  } catch {
    // Already unlocked.
  }
}
