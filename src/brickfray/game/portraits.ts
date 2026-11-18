import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCharacter, STANCES } from '../characters';
import { CHARACTER_IDS } from '../characters/roster';
import type { AnimState, CharacterId } from '../characters/types';
import type { Kit } from '../engine/kit';
import type { GameRenderer } from '../engine/renderer';
import { createWeaponModel } from '../weapons';
import { LOADOUTS } from '../weapons/loadouts';
import { aimed, heroHands, KEY_DIRECTION, STUDIO_LIGHTS } from './hero-display';

const SIZE = 192;
/** How far the face turns from the lens toward the key light. */
const TURN = 0.3;
/** The crop runs from the collarbone to the top of the headgear, but no higher than `ABOVE` over the head's center. */
const BELOW = 0.31;
const ABOVE = 0.37;

/**
 * Head-and-shoulders shots of every character for the character picker, as PNG data URLs: the showroom
 * model in its signature stance under the showroom's lights, on a dark vignette that lets the picker's
 * color swatch show through. One character per frame, so building six detailed models never stalls the menu.
 */
export async function renderPortraits(kit: Kit, gr: GameRenderer, pose: AnimState, environment: THREE.Texture | null, onShot: (id: CharacterId, url: string) => boolean) {
  const renderer = gr.renderer;
  const scene = new THREE.Scene();
  scene.environment = environment;
  const { key, sky, rim, kicker, fill } = STUDIO_LIGHTS;
  const sun = new THREE.DirectionalLight(key.color, key.intensity);
  sun.position.copy(KEY_DIRECTION);
  const lights = [sun, aimed(rim), aimed(kicker), aimed(fill)];
  for (const light of lights) scene.add(light, light.target);
  scene.add(new THREE.HemisphereLight(sky.color, sky.ground, sky.intensity * 1.4));
  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 20);
  const hdr = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, samples: 4 });
  const ldr = new THREE.WebGLRenderTarget(SIZE, SIZE);
  const output = new OutputPass();
  output.renderToScreen = false;
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const canvas = document.createElement('canvas');
  const cutout = document.createElement('canvas');
  canvas.width = canvas.height = cutout.width = cutout.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const cut = cutout.getContext('2d')!;
  const image = cut.createImageData(SIZE, SIZE);
  const vignette = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.42, SIZE * 0.1, SIZE * 0.5, SIZE * 0.5, SIZE * 0.78);
  vignette.addColorStop(0, 'rgba(16,22,44,0.25)');
  vignette.addColorStop(1, 'rgba(8,11,26,0.82)');
  const head = new THREE.Vector3();
  const face = new THREE.Vector3();
  const box = new THREE.Box3();
  const part = new THREE.Box3();

  const color = new THREE.Color();
  for (const id of CHARACTER_IDS) {
    const saved = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, color: renderer.getClearColor(color).getHex(), alpha: renderer.getClearAlpha() };
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    const rig = createCharacter(id, kit, { hands: heroHands(id) });
    const gun = createWeaponModel(LOADOUTS[id].primary, kit, 'third');
    rig.setStance(STANCES[id]);
    rig.setWeapon(gun.root, gun.supportGrip);
    scene.add(rig.root);
    rig.update(0.5, pose);
    // The stance turns the head on the body, so the whole figure turns until the face is where the lens wants it.
    rig.root.getObjectByName('head')!.getWorldDirection(face).negate();
    rig.root.rotation.y = Math.PI - TURN - Math.atan2(-face.x, -face.z);
    rig.root.updateMatrixWorld(true);
    rig.headPosition(head);
    box.makeEmpty();
    rig.root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      mesh.computeBoundingBox();
      box.union(part.copy(mesh.boundingBox!).applyMatrix4(mesh.matrixWorld));
    });
    const top = THREE.MathUtils.clamp(box.max.y, head.y + 0.25, head.y + ABOVE) + 0.02;
    const bottom = head.y - BELOW;
    const center = (top + bottom) / 2;
    const distance = (top - bottom) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(head.x, center - 0.07, head.z + distance);
    camera.lookAt(head.x, center, head.z);
    renderer.setRenderTarget(hdr);
    renderer.render(scene, camera);
    output.render(renderer, ldr, hdr, 0, false);
    renderer.readRenderTargetPixels(ldr, 0, 0, SIZE, SIZE, pixels);
    // GL rows run bottom-up; edges come back premultiplied by coverage.
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const src = ((SIZE - 1 - y) * SIZE + x) * 4;
        const dst = (y * SIZE + x) * 4;
        const a = pixels[src + 3]!;
        const k = a > 0 ? 255 / a : 0;
        image.data[dst] = Math.min(255, pixels[src]! * k);
        image.data[dst + 1] = Math.min(255, pixels[src + 1]! * k);
        image.data[dst + 2] = Math.min(255, pixels[src + 2]! * k);
        image.data[dst + 3] = a;
      }
    }
    cut.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(cutout, 0, 0);
    scene.remove(rig.root);
    rig.dispose();
    gun.dispose();
    renderer.setRenderTarget(saved.target);
    renderer.autoClear = saved.autoClear;
    renderer.setClearColor(saved.color, saved.alpha);
    if (!onShot(id, canvas.toDataURL('image/png'))) break;
    await new Promise(requestAnimationFrame);
  }
  for (const light of lights) light.dispose();
  hdr.dispose();
  ldr.dispose();
  output.dispose();
}
