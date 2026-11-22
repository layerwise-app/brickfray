import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
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
 * How much closer the lens comes for a face that reads small in that crop: Vega's, bare and narrow beside the helmets,
 * and Moss's, deep in a hood.
 */
const ZOOM: Partial<Record<CharacterId, number>> = { vega: 1.2, moss: 1.1 };
/** A soft light from the lens on the face, stronger where a hood shades it, so it reads on a tile of its own colour. */
const FACE_LIGHT = { color: '#fff1e0', intensity: 0.5, hooded: { moss: 1.5 } as Partial<Record<CharacterId, number>> };
/** How strongly each shot's colour is sharpened: drawn at twice a picker tile or more, it is scaled down and softened. */
const SHARPEN = 0.7;
/**
 * Room drawn over the tile for what rises past its top edge (Sir Clack's crest, Nova's antenna); each shot is then
 * trimmed to its own silhouette, so whatever rises above the tile stands out whole, by the same rule for all six.
 */
const OVER = 0.34;
/** The glow round each cutout: its colour, strength, and blur radius in pixels of a 192-pixel-wide shot. */
const GLOW = { rgb: [255, 246, 232], alpha: 0.62, blur: 3.5 };
/** Pixels across a shot: twice the tile's on this screen, within these bounds. */
const SIZES = { min: 128, max: 400, tile: 64 };
/** Lights from behind the head, high on either side, that edge dark helmets and hair against the tile. */
const RIMS = [new THREE.Vector3(0.7, 0.8, -1).normalize(), new THREE.Vector3(-0.8, 0.5, -1).normalize()];
const RIM = { color: '#e2ebff', intensity: 3.2 };
/** Stronger rims for a figure dressed in its own tile's colour (Moss's green hood on the green tile), to edge it off the tile. */
const RIM_BOOST: Partial<Record<CharacterId, number>> = { moss: 1.8 };

/** Divides the multisampled edges' colour by their coverage before tone mapping, which would brighten and tint them after. */
const STRAIGHT = /* glsl */ `
uniform sampler2D tMap;
varying vec2 vUv;
void main() {
  vec4 c = texture2D( tMap, vUv );
  gl_FragColor = c.a > 0.0 ? vec4( c.rgb / c.a, c.a ) : vec4( 0.0 );
}`;

/** The last set of portraits drawn: what they were drawn with and how wide, so a larger window can have them drawn again. */
let drawn: { args: Parameters<typeof renderPortraits>; width: number } | null = null;
let drawing = false;

/** Pixels across a shot on this screen: twice the picker tile's width, within bounds. */
function shotWidth() {
  const tile = document.querySelector('.bf-menu-thumb')?.getBoundingClientRect().width || SIZES.tile;
  return Math.round(THREE.MathUtils.clamp(2 * tile * (window.devicePixelRatio || 1), SIZES.min, SIZES.max));
}

/** Draws the portraits again if the picker's tiles have grown well past the size they were drawn for. */
export function refreshPortraits() {
  if (!drawn || drawing || shotWidth() <= drawn.width * 1.15) return;
  void renderPortraits(...drawn.args);
}

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
  drawing = true;
  try {
    // Drawn at twice the size the picker shows it on this screen, so it stays crisp when the browser scales it down.
    const width = shotWidth();
    drawn = { args: [kit, gr, pose, environment, onShot], width };
    await draw(kit, gr, pose, environment, onShot, width);
  } finally {
    drawing = false;
  }
}

async function draw(kit: Kit, gr: GameRenderer, pose: AnimState, environment: THREE.Texture | null, onShot: (id: CharacterId, url: string) => boolean, WIDTH: number) {
  const renderer = gr.renderer;
  const HEIGHT = Math.round((WIDTH * (BELOW + ABOVE + OVER)) / (BELOW + ABOVE));
  const scene = new THREE.Scene();
  scene.environment = environment;
  const { key, sky, rim, kicker, fill } = STUDIO_LIGHTS;
  const sun = new THREE.DirectionalLight(key.color, key.intensity);
  sun.position.copy(KEY_DIRECTION);
  const backs = RIMS.map(() => new THREE.DirectionalLight(RIM.color, RIM.intensity));
  const facing = new THREE.DirectionalLight(FACE_LIGHT.color, FACE_LIGHT.intensity);
  const lights = [sun, ...backs, facing, aimed(rim), aimed(kicker), aimed(fill)];
  for (const light of lights) scene.add(light, light.target);
  scene.add(new THREE.HemisphereLight(sky.color, sky.ground, sky.intensity * 1.4));
  const camera = new THREE.PerspectiveCamera(22, WIDTH / HEIGHT, 0.05, 20);
  const hdr = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType, samples: 4 });
  const straight = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType });
  const ldr = new THREE.WebGLRenderTarget(WIDTH, HEIGHT);
  const unmix = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: hdr.texture } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,
    fragmentShader: STRAIGHT,
    depthTest: false,
    depthWrite: false
  });
  const quad = new FullScreenQuad(unmix);
  const output = new OutputPass();
  output.renderToScreen = false;
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  const canvas = document.createElement('canvas');
  const cutout = document.createElement('canvas');
  canvas.width = cutout.width = WIDTH;
  canvas.height = cutout.height = HEIGHT;
  // The cutout blurred: the glow's shape.
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.filter = `blur(${(GLOW.blur * WIDTH) / 192}px)`;
  const cut = cutout.getContext('2d')!;
  const image = cut.createImageData(WIDTH, HEIGHT);
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
    const zoom = ZOOM[id] ?? 1;
    const center = head.y + (ABOVE + OVER - BELOW) / 2 / zoom;
    const distance = (ABOVE + OVER + BELOW) / 2 / zoom / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(head.x, center - 0.07 / zoom, head.z + distance);
    camera.lookAt(head.x, center, head.z);
    backs.forEach((back, i) => {
      back.intensity = RIM.intensity * (RIM_BOOST[id] ?? 1);
      back.target.position.copy(head);
      back.position.copy(head).add(RIMS[i]!);
    });
    // From just below the lens, under a hood's brim.
    facing.intensity = FACE_LIGHT.intensity * (FACE_LIGHT.hooded[id] ?? 1);
    facing.target.position.copy(head);
    facing.position.set(head.x - 0.3, head.y - 0.25, head.z + 1);
    renderer.setRenderTarget(hdr);
    renderer.render(scene, camera);
    renderer.setRenderTarget(straight);
    quad.render(renderer);
    output.render(renderer, ldr, straight, 0, false);
    renderer.readRenderTargetPixels(ldr, 0, 0, WIDTH, HEIGHT, pixels);
    // GL rows run bottom-up.
    for (let y = 0; y < HEIGHT; y++) image.data.set(pixels.subarray((HEIGHT - 1 - y) * WIDTH * 4, (HEIGHT - y) * WIDTH * 4), y * WIDTH * 4);
    sharpen(image.data, WIDTH, HEIGHT, SHARPEN);
    cut.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(cutout, 0, 0);
    addGlow(image.data, ctx.getImageData(0, 0, WIDTH, HEIGHT).data);
    // Trimmed to the top of the silhouette's glow: the picker anchors the shot at the tile's foot.
    let top = 0;
    while (top < HEIGHT - 1 && !rowHasInk(image.data, top, WIDTH)) top++;
    shot.width = WIDTH;
    shot.height = HEIGHT - top;
    out.putImageData(image, 0, -top);
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
  straight.dispose();
  ldr.dispose();
  unmix.dispose();
  quad.dispose();
  output.dispose();
}

/**
 * Lays the cutout (straight alpha) over a faint warm glow of its own blurred silhouette, in place, so a dark helmet
 * does not sink into a dark swatch. Done here rather than with a canvas shadow, whose faint outer pixels round to pink.
 */
function addGlow(px: Uint8ClampedArray, halo: Uint8ClampedArray) {
  for (let i = 0; i < px.length; i += 4) {
    const f = px[i + 3]! / 255;
    const g = halo[i + 3]! < 4 ? 0 : (GLOW.alpha * halo[i + 3]!) / 255;
    const a = f + g * (1 - f);
    if (a <= 0) continue;
    const k = g * (1 - f);
    for (let c = 0; c < 3; c++) px[i + c] = (px[i + c]! * f + GLOW.rgb[c]! * k) / a;
    px[i + 3] = a * 255;
  }
}

/**
 * Unsharp mask on the cutout's colour (straight alpha), in place: each pixel pushed away from the mean of its 3×3
 * neighbourhood, weighted by coverage so the clear background does not darken the edges.
 */
function sharpen(px: Uint8ClampedArray, width: number, height: number, amount: number) {
  const src = px.slice();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (src[i + 3] === 0) continue;
      let weight = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = i + (dy * width + dx) * 4;
          const k = src[j + 3]! * (dx && dy ? 1 : dx || dy ? 2 : 4);
          weight += k;
          r += src[j]! * k;
          g += src[j + 1]! * k;
          b += src[j + 2]! * k;
        }
      }
      px[i] = src[i]! + amount * (src[i]! - r / weight);
      px[i + 1] = src[i + 1]! + amount * (src[i + 1]! - g / weight);
      px[i + 2] = src[i + 2]! + amount * (src[i + 2]! - b / weight);
    }
  }
}

/** Whether row `y` of an RGBA image `width` wide has anything visible in it. */
function rowHasInk(data: Uint8ClampedArray, y: number, width: number) {
  for (let x = 0, i = y * width * 4 + 3; x < width; x++, i += 4) if (data[i]! > 6) return true;
  return false;
}
