import { createContext, lazy, Suspense, useContext, useEffect, useState, type ReactNode } from 'react';
import { useApp, useGame, useHud } from '../App';

const BoardPanel = lazy(() => import('../board/BoardPanel'));

const Ctx = createContext<{ open: boolean; show: () => void }>({ open: false, show: () => {} });

/** Whether the results' leaderboard is up, and how the results open it. */
export const useResultsBoard = () => useContext(Ctx);

/**
 * The leaderboard opened from the results. It is a page of its own: when the room goes back to its lobby it stays up
 * over the lobby, and closing it shows the room. A new match or leaving the room closes it.
 */
export function ResultsBoard({ children }: { children: ReactNode }) {
  const app = useApp();
  const hud = useHud();
  const game = useGame();
  const [open, setOpen] = useState(false);
  const stays = app.screen === 'lobby' || (app.screen === 'match' && hud.phase === 'ended');
  if (open && !stays) setOpen(false);

  // Esc closes the board instead of opening the pause menu (Input listens on window, bubbling).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      game.audio.play('uiBack');
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, game]);

  const show = () => {
    game.audio.play('uiClick');
    setOpen(true);
  };

  return (
    <Ctx.Provider value={{ open, show }}>
      <div className='contents' inert={open}>
        {children}
      </div>
      {open && (
        <Suspense fallback={null}>
          <div className='pointer-events-auto absolute inset-0 z-40'>
            <BoardPanel
              onClose={() => {
                game.audio.play('uiBack');
                setOpen(false);
              }}
              onName={() => {}}
            />
          </div>
        </Suspense>
      )}
    </Ctx.Provider>
  );
}
