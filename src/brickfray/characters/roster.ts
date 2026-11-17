import type { CharacterId, CharacterInfo } from './types';

/** Playable roster; purely cosmetic, every character has the same size and stats. */
export const ROSTER: Record<CharacterId, CharacterInfo> = {
  rivet: { id: 'rivet', name: 'Rivet', primary: '#f58a1f', secondary: '#2b3a55', glove: '#f6c624', sleeve: '#2b3a55' },
  vega: { id: 'vega', name: 'Vega', primary: '#1fa7a0', secondary: '#f2f2ee', glove: '#2a2f38' },
  clack: { id: 'clack', name: 'Sir Clack', primary: '#b9c0c8', secondary: '#c8231b', glove: '#7d848c' },
  coral: { id: 'coral', name: 'Coral', primary: '#f26b5b', secondary: '#c99a3e', glove: '#3a3f47' },
  moss: { id: 'moss', name: 'Moss', primary: '#4f7a3a', secondary: '#7a5a3a', glove: '#5b4630' },
  nova: { id: 'nova', name: 'Nova', primary: '#eef0f4', secondary: '#7b4fd6', glove: '#d9dce3' }
};

export const CHARACTER_IDS = Object.keys(ROSTER) as CharacterId[];
