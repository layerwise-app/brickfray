import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { loadHeroAssets } from '../characters';
import { Game } from '../game/game';
import { loadSettings } from '../game/settings';
import { Connecting, ErrorBanner } from './Connecting';
import { Hud } from './hud/Hud';
import { Lobby } from './Lobby';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { RunSaved } from './hud/RunSaved';
import { SettingsPanel } from './SettingsPanel';
import { watchFrame } from './touch/landscape';
import { UprightEditor } from './touch/UprightEditor';
import './game.css';

const GameContext = createContext<Game | null>(null);

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error('useGame outside the game');
  return game;
}

export function useApp() {
  const game = useGame();
  return useSyncExternalStore(game.app.subscribe, game.app.getSnapshot, game.app.getSnapshot);
}

export function useHud() {
  const game = useGame();
  return useSyncExternalStore(game.hud.subscribe, game.hud.getSnapshot, game.hud.getSnapshot);
}

/** Client-only root: owns the canvas and the Game, and switches screens. */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The viewport is the external system: a phone held upright turns the app. Before the game, which sizes to it.
  useEffect(() => watchFrame(), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the WebGL game is created once per mount
  useEffect(() => {
    let instance: Game | null = null;
    let unmounted = false;
    // The showroom figure is built once, with its baked extras: they have to be there first.
    void loadHeroAssets().then(() => {
      if (unmounted) return;
      instance = new Game(canvasRef.current!, tagsRef.current!, loadSettings());
      setGame(instance);
      (window as Window & { __game?: Game }).__game = instance;
    });
    return () => {
      unmounted = true;
      instance?.dispose();
    };
  }, []);

  return (
    <>
      <div className='bf-root'>
        <canvas ref={canvasRef} className='bf-canvas' tabIndex={-1} />
        <div ref={tagsRef} className='pointer-events-none absolute inset-0 overflow-hidden' />
        {game && (
          <GameContext.Provider value={game}>
            <Screens
              openSettings={() => {
                game.audio.play('uiClick');
                setSettingsOpen(true);
              }}
            />
            {settingsOpen && (
              <SettingsPanel
                onClose={() => {
                  game.audio.play('uiBack');
                  setSettingsOpen(false);
                }}
              />
            )}
          </GameContext.Provider>
        )}
      </div>
      <UprightEditor />
    </>
  );
}

function Screens({ openSettings }: { openSettings: () => void }) {
  const app = useApp();
  return (
    <>
      {app.screen === 'menu' && <MainMenu openSettings={openSettings} />}
      {app.screen === 'connecting' && <Connecting />}
      {app.screen === 'lobby' && <Lobby />}
      {app.screen === 'match' && <Hud />}
      {app.screen === 'match' && app.paused && <PauseMenu openSettings={openSettings} />}
      <RunSaved />
      {app.error && <ErrorBanner error={app.error} />}
    </>
  );
}
