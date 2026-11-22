import type { AchievementNews } from '../contract';

// What uploads did to the player's achievements, kept by match key for the end-of-match screen of that match.

const KEEP = 20;
const news = new Map<string, AchievementNews>();
const listeners = new Set<() => void>();

/** An upload stored these matches; `got` is what they did together. */
export function noteNews(keys: readonly string[], got: AchievementNews) {
  for (const key of keys) {
    news.delete(key);
    news.set(key, got);
  }
  for (const key of [...news.keys()].slice(0, Math.max(0, news.size - KEEP))) news.delete(key);
  for (const fn of listeners) fn();
}

export function newsFor(key: string | null | undefined): AchievementNews | null {
  return (key && news.get(key)) || null;
}

export function subscribeNews(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
