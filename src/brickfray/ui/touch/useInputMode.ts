import { useSyncExternalStore } from 'react';
import { inputMode, onInputMode, type InputMode } from '../../game/input-mode';

const server = (): InputMode => 'mouse';

/** Touch or mouse, re-rendering when the player switches. */
export function useInputMode(): InputMode {
  return useSyncExternalStore(onInputMode, inputMode, server);
}

/** True while the on-screen touch controls are the input in use. */
export function useTouchMode() {
  return useInputMode() === 'touch';
}
