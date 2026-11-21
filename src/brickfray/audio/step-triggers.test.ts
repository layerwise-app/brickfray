import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FootStrikes, OwnSteps, STRIKE_PHASE } from './step-triggers';

describe('OwnSteps', () => {
  it('lands one step each time the bob phase passes a strike, including across the 4π wrap', () => {
    const steps = new OwnSteps();
    const at: number[] = [];
    let phase = 0;
    for (let i = 0; i < 240; i++) {
      phase = (phase + (1 / 60) * Math.PI * 1.9) % (4 * Math.PI);
      if (steps.update(1 / 60, phase, true, false, false)) at.push(phase);
    }
    expect(at.length).toBe(7);
    for (const p of at) expect(((p - STRIKE_PHASE) % Math.PI + Math.PI) % Math.PI).toBeLessThan(0.11);
  });

  it('stays silent while standing and keeps its own clock without a view model', () => {
    const steps = new OwnSteps();
    let n = 0;
    for (let i = 0; i < 120; i++) if (steps.update(1 / 60, null, false, false, false)) n++;
    expect(n).toBe(0);
    for (let i = 0; i < 120; i++) if (steps.update(1 / 60, null, true, true, false)) n++;
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(6);
  });
});

describe('FootStrikes', () => {
  it('counts a foot once when it comes down after being lifted', () => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    const pelvis = new THREE.Bone();
    pelvis.name = 'pelvis';
    const feet = ['footL', 'footR'].map((name) => Object.assign(new THREE.Bone(), { name }));
    root.add(body);
    body.add(pelvis);
    for (const f of feet) body.add(f);
    const strikes = new FootStrikes(root);
    const pose = (l: number, r: number) => {
      feet[0]!.position.y = l;
      feet[1]!.position.y = r;
      root.updateMatrixWorld(true);
      return strikes.update();
    };
    expect(pose(0.085, 0.085)).toBe(0);
    expect(pose(0.2, 0.085)).toBe(0);
    expect(pose(0.095, 0.085)).toBe(1);
    expect(pose(0.11, 0.085)).toBe(0);
    expect(pose(0.09, 0.085)).toBe(0);
    expect(pose(0.2, 0.2)).toBe(0);
    expect(pose(0.085, 0.085)).toBe(2);
  });
});
