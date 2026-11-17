import * as THREE from 'three';
import type { AudioEngine } from '../audio/types';
import type { Kit } from '../engine/kit';
import type { Snapshot } from '../net/codec';
import { createWeaponModel } from '../weapons';
import type { WeaponModel } from '../weapons/types';

/** Live grenades from snapshots, interpolated, with bounce sounds. */
export class GrenadeView {
  readonly group = new THREE.Group();
  private models = new Map<number, { model: WeaponModel; bounces: number; spin: number }>();

  constructor(
    private readonly kit: Kit,
    private readonly audio: AudioEngine
  ) {}

  update(snapshots: readonly Snapshot[], renderTime: number) {
    let a: Snapshot | undefined;
    let b: Snapshot | undefined;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i]!.time <= renderTime) {
        a = snapshots[i];
        b = snapshots[i + 1];
        break;
      }
    }
    a ??= snapshots[0];
    const seen = new Set<number>();
    if (a) {
      const k = b ? THREE.MathUtils.clamp((renderTime - a.time) / Math.max(1e-4, b.time - a.time), 0, 1) : 0;
      for (const g of a.grenades) {
        const n = b?.grenades.find((x) => x.id === g.id) ?? g;
        seen.add(g.id);
        let entry = this.models.get(g.id);
        if (!entry) {
          entry = { model: createWeaponModel('grenade', this.kit, 'third'), bounces: 0, spin: Math.random() * 6 };
          this.group.add(entry.model.root);
          this.models.set(g.id, entry);
        }
        const root = entry.model.root;
        root.position.set(g.x + (n.x - g.x) * k, g.y + (n.y - g.y) * k, g.z + (n.z - g.z) * k);
        const moving = Math.hypot(n.x - g.x, n.y - g.y, n.z - g.z) > 0.01;
        if (moving) entry.spin += 0.25;
        root.rotation.set(entry.spin, entry.spin * 0.7, 0);
        if (g.bounces > entry.bounces) {
          entry.bounces = g.bounces;
          this.audio.play('grenadeBounce', { position: root.position, volume: 0.8 });
        }
      }
    }
    for (const [id, entry] of this.models) {
      if (seen.has(id)) continue;
      this.group.remove(entry.model.root);
      entry.model.dispose();
      this.models.delete(id);
    }
  }

  dispose() {
    for (const entry of this.models.values()) entry.model.dispose();
    this.models.clear();
    this.group.clear();
  }
}
