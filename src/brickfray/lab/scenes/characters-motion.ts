import * as THREE from 'three';
import { buildGround } from '../../engine/ground';
import type { Kit } from '../../engine/kit';
import { PLASTIC } from '../../engine/palette';
import { createCharacter, type AnimState, type BotKind, type CharacterId, type ShatterPiece } from '../../characters';
import { idleState, mergeState } from '../../characters/labState';
import type { Rig } from '../../characters/rig';
import { standInRifle } from '../../characters/standInRifle';
import type { LabContext } from '../types';

type Id = CharacterId | BotKind;
interface SheetOptions {
  n?: number;
  spacing?: number;
  axis?: 'x' | 'z';
  state?: Partial<AnimState>;
  /** Warm-up seconds before the first frame. */
  t0?: number;
  /** Sample one gait cycle (default) or a fixed time span. */
  span?: number;
  /** Vary one numeric state key from..to across the frames (reload, melee, grenade…). */
  vary?: { key: keyof AnimState; from: number; to: number };
  /** Scripted jump: frames sampled across take-off, flight and landing. */
  jump?: boolean;
  /** Reverse the strip so a front three-quarter camera reads left to right. */
  flip?: boolean;
  fidget?: boolean;
}

const DT = 1 / 120;

/**
 * One character (or a strip of copies sampled at different times) with a
 * deterministic clock, for judging motion in still frames.
 */
export default function setup(ctx: LabContext) {
  const { renderer: gr, scene } = ctx;
  scene.add(buildGround([{ x0: -64, z0: -64, x1: 64, z1: 64, y: 0, color: PLASTIC.sandGreen }], gr.profile));
  const grid = new THREE.GridHelper(32, 80, 0x557766, 0x6f8f80);
  grid.position.y = 0.004;
  (grid.material as THREE.Material).opacity = 0.25;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);
  const kit: Kit = { profile: gr.profile, materials: gr.materials };
  let id: Id = 'rivet';
  let rigs: Rig[] = [];
  let state = idleState();
  let live = true;
  let pieces: ShatterPiece[] = [];

  const make = (count: number) => {
    for (const r of rigs) r.dispose();
    rigs = [];
    for (let i = 0; i < count; i++) {
      const rig = createCharacter(id, kit) as Rig;
      const gun = standInRifle(kit);
      rig.setWeapon(gun.root, gun.supportGrip);
      scene.add(rig.root);
      rigs.push(rig);
    }
  };
  make(1);

  const run = (rig: Rig, seconds: number, at: (t: number) => AnimState) => {
    rig.reset();
    const steps = Math.round(seconds / DT);
    for (let k = 0; k < steps; k++) rig.update(DT, at(k * DT));
  };

  const jumpState = (t: number, t0: number) => {
    const air = t - t0;
    const flight = 0.95;
    if (air < 0 || air > flight) return mergeState(state, { grounded: true, verticalVelocity: air > flight ? 0 : 0 });
    return mergeState(state, { grounded: false, verticalVelocity: 4.6 - 9.8 * air });
  };

  ctx.onFrame((dt) => {
    if (live) for (const r of rigs) r.update(dt, state);
    for (const p of pieces) {
      p.velocity.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.velocity.multiplyScalar(0.4);
        p.velocity.y = Math.abs(p.velocity.y) * 0.3;
        p.angularVelocity.multiplyScalar(0.6);
      }
      p.mesh.rotation.x += p.angularVelocity.x * dt;
      p.mesh.rotation.y += p.angularVelocity.y * dt;
      p.mesh.rotation.z += p.angularVelocity.z * dt;
    }
  });
  ctx.camera.position.set(3.2, 1.3, 0);
  ctx.controls.target.set(0, 0.95, 0);

  return {
    api: {
      setCharacter: (next: unknown) => {
        id = next as Id;
        make(rigs.length || 1);
      },
      setState: (patch: unknown) => {
        state = mergeState(idleState(), patch as Partial<AnimState>);
      },
      setTime: (t: unknown) => {
        live = false;
        make(1);
        run(rigs[0]!, Number(t), () => state);
        return rigs[0]!.animator.gait.phase;
      },
      play: () => {
        live = true;
      },
      sheet: (raw: unknown) => {
        const o = (raw ?? {}) as SheetOptions;
        const n = o.n ?? 8;
        const spacing = o.spacing ?? 1.1;
        state = mergeState(idleState(), o.state ?? {});
        live = false;
        make(n);
        const t0 = o.t0 ?? 2;
        const probe = rigs[0]!;
        run(probe, t0, () => state);
        const g = probe.animator.gait;
        const period = o.span ?? (state.speed > 0.05 && g.params ? g.params.stride / state.speed : 1);
        const align = o.span !== undefined || o.jump ? 0 : (g.backward ? g.phase : (1 - g.phase) % 1) * period;
        rigs.forEach((rig, i) => {
          const u = n > 1 ? i / n : 0;
          const ui = n > 1 ? i / (n - 1) : 0;
          let lift = 0;
          if (o.vary) {
            const s = mergeState(state, { [o.vary.key]: o.vary.from + (o.vary.to - o.vary.from) * ui } as Partial<AnimState>);
            run(rig, t0, () => s);
          } else if (o.jump) {
            const tEnd = t0 + (o.span ?? 1.5) * ui;
            run(rig, tEnd, (t) => jumpState(t, t0));
            const air = tEnd - t0;
            lift = air > 0 && air < 0.95 ? 4.6 * air - 4.9 * air * air : 0;
          } else if (o.fidget) {
            rig.reset();
            const steps = Math.round((t0 + (o.span ?? 2) * ui) / DT);
            for (let k = 0; k < steps; k++) {
              if (k === Math.round(t0 / DT)) rig.animator.playFidget();
              rig.update(DT, state);
            }
          } else run(rig, t0 + align + u * period, () => state);
          const off = (i - (n - 1) / 2) * spacing * (o.flip ? -1 : 1);
          rig.root.position.set(o.axis === 'x' ? off : 0, lift, o.axis === 'x' ? 0 : off);
          rig.root.updateMatrixWorld(true);
        });
        return { period, phase: g.phase };
      },
      shatter: (impulse: unknown) => {
        const [x, y, z] = (impulse as number[] | undefined) ?? [3, 1, 0];
        for (const r of rigs) pieces.push(...r.shatter(new THREE.Vector3(x, y, z)));
        for (const p of pieces) scene.add(p.mesh);
        return pieces.length;
      },
      simulatePieces: (t: unknown) => {
        for (let k = 0; k < Math.round(Number(t) / DT); k++) {
          for (const p of pieces) {
            p.velocity.y -= 9.8 * DT;
            p.mesh.position.addScaledVector(p.velocity, DT);
            if (p.mesh.position.y < 0.05) {
              p.mesh.position.y = 0.05;
              p.velocity.multiplyScalar(0.4);
              p.velocity.y = Math.abs(p.velocity.y) * 0.3;
              p.angularVelocity.multiplyScalar(0.6);
            }
            p.mesh.rotation.x += p.angularVelocity.x * DT;
            p.mesh.rotation.y += p.angularVelocity.y * DT;
            p.mesh.rotation.z += p.angularVelocity.z * DT;
          }
        }
        live = false;
        pieces = pieces.map((p) => ({ ...p, velocity: new THREE.Vector3(), angularVelocity: new THREE.Vector3() }));
      },
      tint: (c: unknown) => rigs.forEach((r) => r.setTint(c as string | null)),
      head: () => rigs[0]!.headPosition(new THREE.Vector3()).toArray(),
      bone: (name: unknown) => rigs[0]!.bones.find((b) => b.name === name)!.getWorldPosition(new THREE.Vector3()).toArray()
    }
  };
}
