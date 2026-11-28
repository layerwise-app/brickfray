import { expect, test, vi } from 'vitest';
import { DECAL, GROUND, type GroundParams } from './blocks';
import { MAPS } from './index';
import { Plan } from './plan';

test('ground paint of different colours never overlaps at the same height (it would z-fight)', () => {
  const paint: GroundParams[] = [];
  const add = Plan.prototype.add;
  vi.spyOn(Plan.prototype, 'add').mockImplementation(function (this: Plan, el, p) {
    if (el === GROUND || el === DECAL) paint.push(p as GroundParams);
    return add.call(this, el, p);
  });
  const clashes: string[] = [];
  for (const map of Object.values(MAPS)) {
    paint.length = 0;
    map.layout();
    for (const [i, a] of paint.entries()) {
      for (const b of paint.slice(i + 1)) {
        if (a.y !== b.y || a.color === b.color) continue;
        const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const h = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        if (w > 0.01 && h > 0.01) clashes.push(`${map.id} y=${a.y} ${a.color} [${a.x0}, ${a.z0}] × ${b.color} [${b.x0}, ${b.z0}]`);
      }
    }
  }
  expect(clashes).toEqual([]);
});
