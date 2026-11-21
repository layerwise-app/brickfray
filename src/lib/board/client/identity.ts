import { newId } from '../db';

// The browser's anonymous player id: made on first use, kept in localStorage, replaced on sign-out.

const KEY = 'brickfray.player.v1';
/** The id the server has a profile for, once it has one (renames before that travel with the first upload). */
const KNOWN = 'brickfray.player.known';
let memory: string | null = null;
const listeners = new Set<() => void>();

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: it lasts for this visit.
  }
}

export function getPlayerId(): string {
  if (memory) return memory;
  const saved = read(KEY);
  if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return (memory = saved);
  return setPlayerId(newId());
}

export function setPlayerId(id: string) {
  if (id === memory) return id;
  memory = id;
  write(KEY, id);
  for (const fn of listeners) fn();
  return id;
}

/** A new anonymous identity: what signing out leaves behind. */
export function freshPlayer() {
  return setPlayerId(newId());
}

export function subscribePlayer(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isKnown() {
  return read(KNOWN) === getPlayerId();
}

export function markKnown() {
  write(KNOWN, getPlayerId());
}
