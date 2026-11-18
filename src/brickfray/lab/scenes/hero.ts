import * as THREE from 'three';
import { buildGround } from '../../engine/ground';
import { PLASTIC } from '../../engine/palette';
import { CHARACTER_IDS, createCharacter, idleState, type CharacterId, type CharacterRig } from '../../characters';
import type { HandShape } from '../../characters/parts';
import { READY, type Stance } from '../../characters/stance';
import { HeroDisplay } from '../../game/hero-display';
import { STUDIO } from '../../game/showroom';
import type { LabContext } from '../types';

/**
 * The showroom figure on its own: `show(id)` picks a character, `turn(radians)` faces it (π = toward the camera),
 * `time(seconds)` freezes the idle at a moment, `view(name)` moves the camera (full, bust, face, hands, back, side).
 * `hands(left, right, pitch, heading)` swaps in an unarmed figure holding both hands out in the given shapes;
 * `focus(bone, distance, azimuth, elevation, fov)` frames one bone, e.g. a hand.
 * Backdrop and lights are the main menu's; the lights come round with the camera, so side and back views are lit like the front.
 */
export default function setup(ctx: LabContext) {
  const { renderer: gr, scene } = ctx;
  gr.setAtmosphere(scene, STUDIO);
  scene.add(buildGround([{ x0: -8, z0: -8, x1: 8, z1: 8, y: 0, color: PLASTIC.navy }], gr.profile));
  const display = new HeroDisplay(gr.renderer);
  scene.add(display.group);
  display.takeOver(scene, gr);
  let facing = Math.PI * 0.86;
  /** Turns the studio to the camera's side of the figure; the figure keeps its heading in the world. */
  const studio = (yaw: number) => {
    display.group.rotation.y = yaw;
    display.figure.rotation.y = facing - yaw;
    if (bare) bare.root.rotation.y = facing - yaw;
    scene.environmentRotation.y = yaw;
  };
  let id: CharacterId = 'rivet';
  let frozen = false;
  let bare: CharacterRig | null = null;
  const show = (next: CharacterId) => {
    id = next;
    bare?.dispose();
    bare = null;
    display.figure.visible = true;
    display.setCharacter(id);
    display.update(1 / 60);
  };
  const hands = (left: HandShape, right: HandShape, pitch = 0.5, heading = 0.25) => {
    bare?.dispose();
    bare = createCharacter(id, display.kit, { hands: { L: left, R: right } });
    const arm = (sign: number, shape: HandShape) => ({ wrist: [sign * 0.21, 0.02, -0.26] as [number, number, number], hand: [sign * -heading, pitch, 0] as [number, number, number], elbow: [sign * 0.7, -0.7, 0.3] as [number, number, number], space: 'chest' as const, shape });
    const stance: Stance = { ...READY, chest: [0, 0, 0], head: [0, 0, 0], pelvis: { at: [0, 0, 0], rot: [0, 0, 0] }, arms: { L: arm(-1, left), R: arm(1, right) }, support: false, life: { breath: 0, sway: 0, look: 0 } };
    bare.setStance(stance);
    bare.update(1 / 60, idleState());
    bare.root.rotation.y = display.figure.rotation.y;
    display.figure.visible = false;
    display.group.add(bare.root);
  };
  show(id);
  ctx.onFrame((dt) => {
    if (!frozen) display.update(dt);
  });
  const VIEWS: Record<string, [THREE.Vector3Tuple, THREE.Vector3Tuple, number]> = {
    full: [[0.4, 1.25, 4.4], [0, 0.95, 0], 30],
    bust: [[0.3, 1.5, 2.1], [0, 1.4, 0], 30],
    face: [[0.15, 1.66, 1.1], [0, 1.62, 0], 26],
    hands: [[0.3, 1.2, 1.5], [0, 1.15, 0], 30],
    side: [[4.4, 1.25, 0.4], [0, 0.95, 0], 30],
    back: [[-0.4, 1.25, -4.4], [0, 0.95, 0], 30]
  };
  const FRONT = Math.atan2(0.4, 4.4);
  const view = (name: string) => {
    const [position, target, fov] = VIEWS[name] ?? VIEWS.full!;
    studio(Math.atan2(position[0], position[2]) - FRONT);
    ctx.camera.position.set(...position);
    ctx.controls.target.set(...target);
    ctx.camera.fov = fov;
    ctx.camera.updateProjectionMatrix();
    ctx.controls.update();
  };
  view('full');
  return {
    api: {
      ids: () => CHARACTER_IDS,
      show: (next: unknown) => show(next as CharacterId),
      turn: (radians: unknown) => {
        facing = Number(radians);
        studio(display.group.rotation.y);
      },
      hands: (left: unknown, right: unknown, pitch?: unknown, heading?: unknown) => hands(left as HandShape, right as HandShape, pitch === undefined ? undefined : Number(pitch), heading === undefined ? undefined : Number(heading)),
      time: (seconds: unknown) => {
        frozen = true;
        show(id);
        for (let k = 0; k < Math.round(Number(seconds) * 60); k++) display.update(1 / 60);
      },
      view: (name: unknown) => view(String(name)),
      /** Aims the camera at a bone from `distance` away, `azimuth` radians around it (0 = from +Z) and `elevation` up. */
      focus: (bone: unknown, distance: unknown = 0.6, azimuth: unknown = 0, elevation: unknown = 0.2, fov: unknown = 30) => {
        const root = bare?.root ?? display.figure;
        root.updateMatrixWorld(true);
        const at = root.getObjectByName(String(bone))?.getWorldPosition(new THREE.Vector3());
        if (!at) return;
        const d = Number(distance);
        const el = Number(elevation);
        const az = Number(azimuth);
        studio(az);
        ctx.camera.position.set(at.x + d * Math.cos(el) * Math.sin(az), at.y + d * Math.sin(el), at.z + d * Math.cos(el) * Math.cos(az));
        ctx.controls.target.copy(at);
        ctx.camera.fov = Number(fov);
        ctx.camera.near = 0.02;
        ctx.camera.updateProjectionMatrix();
        ctx.controls.update();
      },
      tris: () => {
        let n = 0;
        (bare?.root ?? display.figure).traverse((o) => {
          const g = (o as THREE.Mesh).geometry;
          if (g) n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        });
        return Math.round(n);
      }
    },
    dispose: () => {
      bare?.dispose();
      display.dispose();
    }
  };
}
