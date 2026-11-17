import { describe, expect, it } from 'vitest';
import { VoicePool } from './voices';

function fill(pool: VoicePool<string>, count: number, priority: number, start = 0) {
  for (let i = 0; i < count; i++) {
    const key = `s${i}`;
    const a = pool.admit(key, priority, start + i * 0.1, start + i * 0.1);
    expect(a).not.toBeNull();
    pool.add({ handle: key, key, priority, start: start + i * 0.1, end: 100 });
  }
}

describe('VoicePool', () => {
  it('admits up to the limit without evicting', () => {
    const pool = new VoicePool<string>(32);
    fill(pool, 32, 5);
    expect(pool.size).toBe(32);
  });

  it('steals the oldest voice among equal priorities when full', () => {
    const pool = new VoicePool<string>(4);
    fill(pool, 4, 5);
    const a = pool.admit('new', 5, 1, 1);
    expect(a?.evicted).toBe('s0');
    expect(pool.size).toBe(3);
  });

  it('steals the lowest priority voice even when it is newer', () => {
    const pool = new VoicePool<string>(3);
    pool.add({ handle: 'gun', key: 'gun', priority: 8, start: 0, end: 10 });
    pool.add({ handle: 'step', key: 'step', priority: 3, start: 0.5, end: 10 });
    pool.add({ handle: 'ui', key: 'ui', priority: 10, start: 0.2, end: 10 });
    expect(pool.admit('impact', 4, 1, 1)?.evicted).toBe('step');
  });

  it('drops a newcomer that every playing voice outranks', () => {
    const pool = new VoicePool<string>(2);
    pool.add({ handle: 'a', key: 'a', priority: 8, start: 0, end: 10 });
    pool.add({ handle: 'b', key: 'b', priority: 6, start: 0, end: 10 });
    expect(pool.admit('casing', 2, 1, 1)).toBeNull();
    expect(pool.size).toBe(2);
  });

  it('caps identical sounds started within the window and softens the second', () => {
    const pool = new VoicePool<string>(32, 0.04);
    const results = Array.from({ length: 8 }, (_, i) => {
      const a = pool.admit('impact:plastic', 4, 1 + i * 0.002, 1);
      if (a) pool.add({ handle: `p${i}`, key: 'impact:plastic', priority: 4, start: 1 + i * 0.002, end: 2 });
      return a;
    });
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(results[0]?.gain).toBe(1);
    expect(results[1]?.gain).toBeLessThan(1);
    expect(pool.admit('impact:plastic', 4, 1.1, 1.1)).not.toBeNull();
  });

  it('prunes finished voices before deciding', () => {
    const pool = new VoicePool<string>(2);
    pool.add({ handle: 'old', key: 'x', priority: 9, start: 0, end: 0.5 });
    pool.add({ handle: 'live', key: 'y', priority: 9, start: 0, end: 5 });
    const a = pool.admit('z', 1, 1, 1);
    expect(a).toEqual({ evicted: null, gain: 1 });
    expect(pool.size).toBe(1);
  });

  it('frees a slot on remove', () => {
    const pool = new VoicePool<string>(1);
    pool.add({ handle: 'a', key: 'a', priority: 9, start: 0, end: 5 });
    expect(pool.admit('b', 1, 0.1, 0.1)).toBeNull();
    pool.remove('a');
    expect(pool.admit('b', 1, 0.1, 0.1)).toEqual({ evicted: null, gain: 1 });
  });
});
