import { phoneSized } from './input-mode';

type Lockable = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

let locked = false;

/**
 * Fullscreen, and on a phone the landscape lock, where the browser allows them: both need a user gesture, and the lock
 * needs fullscreen (Chrome on Android). iPhone Safari allows neither; the layout copes with its bars and the rotate
 * prompt covers portrait. False when the browser refused for want of a gesture, so a later tap can try again.
 */
export async function enterPlayScreen(): Promise<boolean> {
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
