import { useSyncExternalStore } from 'react';
import { isFullscreen, onFullscreen } from '../game/touch-screen';

/** Whether the page is fullscreen now; follows the browser's own way out (Esc) too. */
export function useFullscreen() {
  return useSyncExternalStore(onFullscreen, isFullscreen, () => false);
}
