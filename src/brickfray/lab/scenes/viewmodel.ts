import * as THREE from 'three';
import { BrickBuilder } from '../../engine/bricks';
import { buildGround } from '../../engine/ground';
import { PLASTIC } from '../../engine/palette';
import type { CharacterId } from '../../characters/types';
import { createViewModel, type ViewAction, type ViewInput } from '../../weapons';
import type { WeaponId } from '../../weapons/defs';
import type { LabContext } from '../types';

/**
 * First-person view model over a simple brick street. Scripts drive it:
 * equip, act, setInput, then step(seconds) for deterministic frames.
 */
export default function setup(ctx: LabContext) {
  const { renderer: gr, scene } = ctx;
  const kit = { profile: gr.profile, materials: gr.materials };
  scene.add(
    buildGround(
      [
        { x0: -20, z0: -40, x1: 20, z1: 10, y: 0, color: PLASTIC.sandGreen },
        { x0: -3, z0: -40, x1: 3, z1: 10, y: 0.02, color: PLASTIC.darkGray, smooth: true }
      ],
      gr.profile
    )
  );
  const b = new BrickBuilder(gr.profile, gr.materials);
  const colors = [PLASTIC.tan, PLASTIC.offWhite, PLASTIC.tan, PLASTIC.darkTan];
  for (const side of [-1, 1]) {
    for (let layer = 0; layer < 24; layer += 3) {
      for (let gz = -60; gz < -8; gz += 2) {
        b.grid({ w: 1, d: 2, h: 3 }, side * 12 + (side < 0 ? -1 : 0), layer, gz + ((layer / 3) % 2), { color: colors[(gz + layer) & 3]! });
      }
    }
  }
  for (let i = 0; i < 6; i++) b.grid({ w: 2, d: 2, h: 3 }, -4 + i * 1.5, 0, -30 - i * 3, { color: [PLASTIC.red, PLASTIC.blue, PLASTIC.yellow][i % 3]! });
  b.grid({ w: 4, d: 2, h: 6 }, 3, 0, -20, { color: PLASTIC.orange });
  scene.add(b.build());

  const view = createViewModel(kit);
  ctx.setViewLayer(view.scene, view.camera);
  ctx.camera.fov = 74;
  ctx.camera.position.set(0, 1.7, 2);
  ctx.controls.target.set(0, 1.62, -8);
  ctx.controls.enabled = false;
  ctx.camera.updateProjectionMatrix();

  const input: ViewInput = { speed: 0, sprint: false, grounded: true, crouch: 0, sliding: false, ads: 0, look: { yaw: 0, pitch: 0 }, time: 0 };
  let manual = false;
  const cues: string[] = [];
  view.onCue = (cue) => cues.push(`${input.time.toFixed(2)} ${cue}`);
  const advance = (dt: number) => {
    input.time += dt;
    view.update(dt, input);
  };
  ctx.onFrame((dt) => {
    view.orient(ctx.camera.quaternion);
    if (!manual) advance(dt);
  });
  advance(0.5);

  return {
    resize: (w: number, h: number) => view.resize(w, h),
    dispose: () => view.dispose(),
    api: {
      setCharacter: (id: unknown) => view.setCharacter(id as CharacterId),
      equip: (id: unknown) => view.equip(id as WeaponId),
      act: (action: unknown) => view.act(action as ViewAction),
      setInput: (partial: unknown) => {
        Object.assign(input, partial as Partial<ViewInput>);
        // Specs written before the flag existed slide by crouching at speed.
        if (!('sliding' in (partial as object))) input.sliding = input.grounded && input.crouch > 0.5 && input.speed > 3;
      },
      setTime: (t: unknown) => {
        manual = true;
        input.time = Number(t);
      },
      /** Advance by `seconds` in 1/120 s steps (manual mode: frames no longer advance it). */
      step: (seconds: unknown) => {
        manual = true;
        let left = Number(seconds);
        while (left > 1e-6) {
          const h = Math.min(1 / 120, left);
          left -= h;
          advance(h);
        }
        return cues.slice(-12);
      },
      /** Muzzle in view space and its screen position (NDC), to check tracer origins. */
      muzzle: () => {
        const p = view.muzzleViewPosition(new THREE.Vector3());
        const ndc = p.clone().project(view.camera);
        return { view: p.toArray().map((v) => +v.toFixed(3)), ndc: [+ndc.x.toFixed(3), +ndc.y.toFixed(3)] };
      },
      cues: () => cues.slice(-30),
      /** Draw calls and triangles of the view layer alone. */
      viewStats: () => {
        let calls = 0;
        let tris = 0;
        view.scene.traverseVisible((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          calls++;
          const g = m.geometry;
          const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
          tris += (m as THREE.InstancedMesh).isInstancedMesh ? n * (m as THREE.InstancedMesh).count : n;
        });
        return { calls, tris };
      },
      /** Where the sight node sits in view space (on the camera axis when fully aimed). */
      sight: () => {
        let found: THREE.Object3D | undefined;
        view.scene.traverse((o) => {
          if (o.name === 'sight' && o.parent?.visible !== false && !found && o.parent?.parent === view.scene) found = o;
        });
        const p = found ? found.getWorldPosition(new THREE.Vector3()) : null;
        return p?.toArray().map((v) => +v.toFixed(4));
      },
      /** Inspect the rig from outside: move the view camera (meters, view space). */
      viewCam: (pos: unknown, target: unknown, fov: unknown) => {
        const [x, y, z] = pos as number[];
        const [tx, ty, tz] = target as number[];
        view.camera.position.set(x!, y!, z!);
        view.camera.lookAt(tx!, ty!, tz!);
        if (fov) view.camera.fov = Number(fov);
        view.camera.updateProjectionMatrix();
        view.camera.updateMatrixWorld();
      },
      /** Both hand-frame origins in view space, to aim an inspection camera at a grip. */
      hands: () => {
        const at = (name: string) => {
          let found: THREE.Object3D | undefined;
          view.scene.traverse((o) => {
            if (o.name === name) found = o;
          });
          return found?.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4));
        };
        const turn = (name: string) => view.scene.getObjectByName(name)?.getWorldQuaternion(new THREE.Quaternion()).toArray().map((v) => +v.toFixed(4));
        return { right: at('hand:right'), left: at('hand:left'), rightTurn: turn('hand:right'), leftTurn: turn('hand:left') };
      },
      /**
       * Degrees each wrist is bent: `bend` between the forearm and the hand's wrist-to-knuckle line, split into
       * `flex` (toward the palm; negative is extension) and `tilt` (forearm arriving from the pinky side; a relaxed
       * fist sits near 20, a human wrist manages about 0 … 50). `forearm` is its elbow-to-wrist direction in view space.
       */
      wrists: () => {
        view.scene.updateMatrixWorld(true);
        const bend = (side: string) => {
          const fore = view.scene.getObjectByName(`forearm:${side}`);
          const hand = view.scene.getObjectByName(`hand:${side}`);
          if (!fore || !hand) return null;
          const along = new THREE.Vector3(0, 1, 0).transformDirection(fore.matrixWorld);
          const reach = new THREE.Vector3(0, 0, -1).transformDirection(hand.matrixWorld);
          const local = along.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert());
          const deg = (v: number) => Math.round(THREE.MathUtils.radToDeg(v));
          return { bend: deg(along.angleTo(reach)), flex: deg(Math.atan2(side === 'left' ? -local.x : local.x, -local.z)), tilt: deg(Math.asin(local.y)), forearm: along.toArray().map((v) => +v.toFixed(2)) };
        };
        return { right: bend('right'), left: bend('left') };
      },
      /** Screen box (NDC, y up; the frame is -1 … 1) of a named gun part or node, to prove something stays out of frame. */
      partBox: (name: unknown) => {
        const part = view.scene.getObjectByName(String(name));
        if (!part) return null;
        const box = new THREE.Box3().setFromObject(part);
        const lo = new THREE.Vector2(Infinity, Infinity);
        const hi = new THREE.Vector2(-Infinity, -Infinity);
        const p = new THREE.Vector3();
        for (let i = 0; i < 8; i++) {
          p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(view.camera);
          lo.min(p as unknown as THREE.Vector2);
          hi.max(p as unknown as THREE.Vector2);
        }
        return { min: [+lo.x.toFixed(3), +lo.y.toFixed(3)], max: [+hi.x.toFixed(3), +hi.y.toFixed(3)] };
      },
      hide: (hidden: unknown) => view.setHidden(Boolean(hidden))
    }
  };
}
