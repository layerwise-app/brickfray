import type { CharacterId } from '../characters/types';
import type { LobbyState } from '../net/protocol';
import type { PublicLobby } from '../net/matchmaking';

export type Screen = 'menu' | 'connecting' | 'lobby' | 'match';

export type AppError = 'hostLeft' | 'full' | 'version' | 'network' | 'notFound' | 'unsupported' | null;

export interface AppState {
  screen: Screen;
  /** What the connecting screen is doing. */
  busy: 'quick' | 'host' | 'join' | 'browse' | 'loading' | null;
  lobby: LobbyState | null;
  isHost: boolean;
  paused: boolean;
  error: AppError;
  lobbies: PublicLobby[] | null;
  audioReady: boolean;
  /** Character picker images (data URLs), rendered shortly after start. */
  /** Picker head shots, filled in as each one is rendered. */
  portraits: Partial<Record<CharacterId, string>>;
}

export class AppStore {
  state: AppState = { screen: 'menu', busy: null, lobby: null, isHost: false, paused: false, error: null, lobbies: null, audioReady: false, portraits: {} };
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.state;

  set(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) fn();
  }
}
