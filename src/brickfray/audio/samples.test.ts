import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAMPLES } from './samples';
import { SOUNDS } from './sounds';

describe('recorded samples', () => {
  it('every listed file ships in public/audio and belongs to a known sound', () => {
    const missing: string[] = [];
    for (const [id, files] of Object.entries(SAMPLES)) {
      expect(SOUNDS, id).toHaveProperty(id);
      for (const file of files ?? []) if (!existsSync(join(process.cwd(), 'public/audio', file))) missing.push(`${id}: ${file}`);
    }
    expect(missing).toEqual([]);
  });
});
