import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCharacter, type Stance } from '../characters';
import { CHARACTER_IDS } from '../characters/roster';
import type { AnimState, CharacterId } from '../characters/types';
import type { Kit } from '../engine/kit';
import type { GameRenderer } from '../engine/renderer';
import { heroHands } from './hero-display';
import { aimed, KEY_DIRECTION, STUDIO_LIGHTS } from './studio';

/**
 * How far the face turns from the lens, away from the key light: toward the stage beside the picker, and with the
 * back turned from view, so nothing carried on it (Moss's hatchet) pokes out past a shoulder. Vega's eyes look off
 * to the side, so his face turns less, until his look meets the viewer's as the others' do.
 */
const TURN: Record<CharacterId, number> = { rivet: -0.3, vega: -0.12, clack: -0.3, coral: -0.3, moss: -0.3, nova: -0.3 };
/** The tile's crop around the head's center, the same for everyone so every face is the same size: collarbone to crown. */
const BELOW = 0.31;
const ABOVE = 0.38;
/**
 * Room drawn over the tile for what rises past its top edge (Sir Clack's crest, Nova's antenna); each shot is then
 * trimmed to its own silhouette, so whatever rises above the tile stands out whole, by the same rule for all six.
 */
const OVER = 0.34;
/** Pixels across a shot: twice the tile's on this screen, within these bounds. */
const SIZES = { min: 128, max: 400, tile: 64 };
/** Lights from behind the head, high on either side, that edge dark helmets and hair against the tile. */
const RIMS = [new THREE.Vector3(0.7, 0.8, -1).normalize(), new THREE.Vector3(-0.8, 0.5, -1).normalize()];
const RIM = { color: '#e2ebff', intensity: 3.2 };

/** Standing square with the arms hanging: nothing a character holds or gestures with reaches into a head shot. */
function portraitStance(id: CharacterId): Stance {
  const hands = heroHands(id);
  const arm = (side: number, shape: Stance['arms']['L']['shape']) => ({
    wrist: [side * 0.3, 0.84, 0.04] as [number, number, number],
    hand: [0, -1.4, 0] as [number, number, number],
    elbow: [side * 0.5, -0.1, 1] as [number, number, number],
    shape
  });
  return {
    pelvis: { at: [0, 0, 0], rot: [0, 0, 0] },
    chest: [0, 0, 0],
    head: [0, 0, 0],
    feet: { L: { at: [-0.13, 0, 0], heading: -0.15 }, R: { at: [0.13, 0, 0], heading: 0.15 } },
    arms: { L: arm(-1, hands.L), R: arm(1, hands.R) },
    life: { breath: 0, sway: 0, look: 0 }
  };
}

/**
 * Head-and-shoulders shots of every character for the character picker, as PNG data URLs: the showroom
 * model standing empty-handed under the showroom's lights, cut out on a clear background for the picker's
 * color swatch, with room over the tile. One character per frame, so building six detailed models never stalls the menu.
 */
export async function renderPortraits(kit: Kit, gr: GameRenderer, pose: AnimState, environment: THREE.Texture | null, onShot: (id: CharacterId, url: string) => boolean) {
  const renderer = gr.renderer;
  // Drawn at twice the size the picker shows it on this screen, so it stays crisp when the browser scales it down.
  const tile = document.querySelector('.bf-menu-thumb')?.getBoundingClientRect().width || SIZES.tile;
  const WIDTH = Math.round(THREE.MathUtils.clamp(2 * tile * (window.devicePixelRatio || 1), SIZES.min, SIZES.max));
  const HEIGHT = Math.round((WIDTH * (BELOW + ABOVE + OVER)) / (BELOW + ABOVE));
  const scene = new THREE.Scene();
  scene.environment = environment;
  const { key, sky, rim, kicker, fill } = STUDIO_LIGHTS;
  const sun = new THREE.DirectionalLight(key.color, key.intensity);
  sun.position.copy(KEY_DIRECTION);
  const backs = RIMS.map(() => new THREE.DirectionalLight(RIM.color, RIM.intensity));
  const lights = [sun, ...backs, aimed(rim), aimed(kicker), aimed(fill)];
  for (const light of lights) scene.add(light, light.target);
  scene.add(new THREE.HemisphereLight(sky.color, sky.ground, sky.intensity * 1.4));
  const camera = new THREE.PerspectiveCamera(22, WIDTH / HEIGHT, 0.05, 20);
  const hdr = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType, samples: 4 });
  const ldr = new THREE.WebGLRenderTarget(WIDTH, HEIGHT);
  const output = new OutputPass();
  output.renderToScreen = false;
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  const canvas = document.createElement('canvas');
  const cutout = document.createElement('canvas');
  canvas.width = cutout.width = WIDTH;
  canvas.height = cutout.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const cut = cutout.getContext('2d')!;
  const image = cut.createImageData(WIDTH, HEIGHT);
  // A faint glow round the cutout keeps a dark helmet from sinking into a dark swatch.
  ctx.shadowColor = 'rgba(255, 246, 232, 0.5)';
  ctx.shadowBlur = (7 * WIDTH) / 192;
  const shot = document.createElement('canvas');
  const out = shot.getContext('2d')!;
  const head = new THREE.Vector3();
  const face = new THREE.Vector3();

  const color = new THREE.Color();
  for (const id of CHARACTER_IDS) {
    // Building a model and drawing it are each a sizeable task: they go in separate frames.
    const rig = createCharacter(id, kit, { hands: heroHands(id) });
    await new Promise(requestAnimationFrame);
    const saved = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, color: renderer.getClearColor(color).getHex(), alpha: renderer.getClearAlpha() };
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    rig.setStance(portraitStance(id));
    scene.add(rig.root);
    rig.update(0.5, pose);
    // A design may turn the head on the body, so the whole figure turns until the face is where the lens wants it.
    rig.root.getObjectByName('head')!.getWorldDirection(face).negate();
    rig.root.rotation.y = Math.PI - TURN[id] - Math.atan2(-face.x, -face.z);
    rig.root.updateMatrixWorld(true);
    rig.headPosition(head);
    const center = head.y + (ABOVE + OVER - BELOW) / 2;
    const distance = (ABOVE + OVER + BELOW) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(head.x, center - 0.07, head.z + distance);
    camera.lookAt(head.x, center, head.z);
    backs.forEach((back, i) => {
      back.target.position.copy(head);
      back.position.copy(head).add(RIMS[i]!);
    });
    renderer.setRenderTarget(hdr);
    renderer.render(scene, camera);
    output.render(renderer, ldr, hdr, 0, false);
    renderer.readRenderTargetPixels(ldr, 0, 0, WIDTH, HEIGHT, pixels);
    // GL rows run bottom-up; edges come back premultiplied by coverage.
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const src = ((HEIGHT - 1 - y) * WIDTH + x) * 4;
        const dst = (y * WIDTH + x) * 4;
        const a = pixels[src + 3]!;
        const k = a > 0 ? 255 / a : 0;
        image.data[dst] = Math.min(255, pixels[src]! * k);
        image.data[dst + 1] = Math.min(255, pixels[src + 1]! * k);
        image.data[dst + 2] = Math.min(255, pixels[src + 2]! * k);
        image.data[dst + 3] = a;
      }
    }
    cut.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(cutout, 0, 0);
    // Trimmed to the silhouette's top with room for its glow: the picker anchors the shot at the tile's foot.
    let top = 0;
    while (top < HEIGHT - 1 && !rowHasInk(image.data, top, WIDTH)) top++;
    top = Math.max(0, top - Math.ceil(ctx.shadowBlur));
    shot.width = WIDTH;
    shot.height = HEIGHT - top;
    out.clearRect(0, 0, WIDTH, HEIGHT);
    out.drawImage(canvas, 0, top, WIDTH, HEIGHT - top, 0, 0, WIDTH, HEIGHT - top);
    scene.remove(rig.root);
    rig.dispose();
    renderer.setRenderTarget(saved.target);
    renderer.autoClear = saved.autoClear;
    renderer.setClearColor(saved.color, saved.alpha);
    if (!onShot(id, shot.toDataURL('image/png'))) break;
    await new Promise(requestAnimationFrame);
  }
  for (const light of lights) light.dispose();
  hdr.dispose();
  ldr.dispose();
  output.dispose();
}

/** Whether row `y` of an RGBA image `width` wide has anything visible in it. */
function rowHasInk(data: Uint8ClampedArray, y: number, width: number) {
  for (let x = 0, i = y * width * 4 + 3; x < width; x++, i += 4) if (data[i]! > 6) return true;
  return false;
}
