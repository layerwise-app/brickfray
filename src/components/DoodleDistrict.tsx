import { useEffect, useRef } from 'react';

// Resolved at build time: the server bundle never includes the game.
const loadGame = import.meta.env.SSR ? null : () => import('~/game');

/**
 * Full-screen host for the Doodle District game.
 *
 * The game touches `window`, WebGL and Web Audio, so it is loaded lazily on the
 * client only and torn down again when the component unmounts.
 */
export function DoodleDistrict() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !loadGame) return;

    let disposed = false;
    let dispose: (() => void) | undefined;

    loadGame()
      .then(({ startGame }) => {
        if (disposed) return;
        dispose = startGame(root).dispose;
      })
      .catch((error: unknown) => {
        console.error('Doodle District failed to start', error);
      });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);

  return <div ref={rootRef} className='dd-root' />;
}
