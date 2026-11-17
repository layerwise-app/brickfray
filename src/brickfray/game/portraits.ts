import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCharacter } from '../characters';
import { CHARACTER_IDS } from '../characters/roster';
import type { AnimState, CharacterId } from '../characters/types';
import type { Kit } from '../engine/kit';
import type { GameRenderer } from '../engine/renderer';

const SIZE = 192;

/**
 * Head-and-shoulders shots of every character, rendered once from the real
 * models as PNG data URLs for the character picker.
 */
export function renderPortraits(kit: Kit, gr: GameRenderer, pose: AnimState, environment: THREE.Texture | null): Record<CharacterId, string> {
  const renderer = gr.renderer;
  const scene = new THREE.Scene();
  scene.environment = environment;
  const key = new THREE.DirectionalLight('#fff1dc', 2.6);
  key.position.set(-1.4, 2.2, 2.6);
  const rim = new THREE.DirectionalLight('#d6e6ff', 1.8);
  rim.position.set(1.8, 1.2, -2.2);
  scene.add(new THREE.HemisphereLight('#eaf2ff', '#8f7c66', 1.3), key, rim);
  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 20);
  const hdr = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, samples: 4 });
  const ldr = new THREE.WebGLRenderTarget(SIZE, SIZE);
  const output = new OutputPass();
  output.renderToScreen = false;
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(SIZE, SIZE);
  const head = new THREE.Vector3();

  const saved = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);
  const out = {} as Record<CharacterId, string>;
  for (const id of CHARACTER_IDS) {
    const rig = createCharacter(id, kit);
    rig.setWeapon(null, null);
    rig.update(0.5, pose);
    rig.root.rotation.y = Math.PI * 0.88;
    scene.add(rig.root);
    rig.root.updateMatrixWorld(true);
    rig.headPosition(head);
    camera.position.set(head.x + 0.22, head.y + 0.1, head.z + 1.5);
    camera.lookAt(head.x, head.y - 0.02, head.z);
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
    ctx.putImageData(image, 0, 0);
    out[id] = canvas.toDataURL('image/png');
    scene.remove(rig.root);
    rig.dispose();
  }
  renderer.setRenderTarget(saved.target);
  renderer.autoClear = saved.autoClear;
  renderer.setClearColor(saved.color, saved.alpha);
  hdr.dispose();
  ldr.dispose();
  output.dispose();
  return out;
}
