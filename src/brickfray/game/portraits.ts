import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { createCharacter, heroFingerprint, type CharacterRig, type Stance } from '../characters';
import { heroAssetsVersion } from '../characters/hero-assets';
import { CHARACTER_IDS } from '../characters/roster';
import type { AnimState, CharacterId } from '../characters/types';
import type { Kit } from '../engine/kit';
import type { GameRenderer } from '../engine/renderer';
import { heroHands } from './hero-display';
import { keepPrints, keepShot, openShots, pruneShots, readPrints, readShot, versionTag, type ShotKind } from './portrait-store';
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

/** The podium's bust: wider than a tile, down to the chest, at one scale for all six; its lower part fades out. */
const BUST = { width: 0.86, below: 0.5, fade: 0.22 };
/** Pixels across a bust: twice the podium's figure (150 design pixels, scaled like the results screen), within bounds. */
const BUST_SIZES = { min: 192, max: 512, figure: 150 };

/** Takes one shot of a character, their picker portrait or their podium bust, as an image URL; false stops the rest. */
export type ShotHandler = (id: CharacterId, kind: ShotKind, url: string) => boolean;

/**
 * In development the models change without a new build: stored shots show first, and once the menu has built every
 * hero, those whose model has changed since are drawn again.
 */
export const RECHECK_STORED = import.meta.env.DEV;

/** The last set of portraits drawn: what they were drawn with and how wide, so a larger window can have them drawn again. */
let drawn: { args: [Kit, GameRenderer, AnimState, THREE.Texture | null, ShotHandler]; width: number } | null = null;
let drawing = false;

/** Pixels across a shot on this screen: twice the picker tile's width, within bounds. */
function shotWidth() {
  const tile = document.querySelector('.bf-menu-thumb')?.getBoundingClientRect().width || SIZES.tile;
  return Math.round(THREE.MathUtils.clamp(2 * tile * (window.devicePixelRatio || 1), SIZES.min, SIZES.max));
}

function bustWidth() {
  const u = THREE.MathUtils.clamp(Math.min(window.innerWidth / 1440, window.innerHeight / 900), 1, 2.4);
  return Math.round(THREE.MathUtils.clamp(2 * BUST_SIZES.figure * u * (window.devicePixelRatio || 1), BUST_SIZES.min, BUST_SIZES.max));
}

/** Draws the portraits again if the picker's tiles have grown well past the size they were drawn for. */
export function refreshPortraits() {
  if (!drawn || drawing || shotWidth() <= drawn.width * 1.15) return;
  void renderPortraits(...drawn.args, { redraw: 'all' });
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
 * Head-and-shoulders shots of every character for the picker, and wider busts for the results podium, as image URLs:
 * kept from an earlier visit where the browser has them, else drawn from the showroom model standing
 * empty-handed under the showroom's lights, cut out on a clear background, with room over the tile. One character per
 * frame, so building six detailed models never stalls the menu. `redraw` draws them all again, or those whose model has
 * changed since its shots were kept (for models that are all built).
 */
export async function renderPortraits(kit: Kit, gr: GameRenderer, pose: AnimState, environment: THREE.Texture | null, onShot: ShotHandler, options: { redraw?: 'all' | 'changed' } = {}) {
  drawing = true;
  try {
    // Drawn at twice the size they show on this screen, so they stay crisp when the browser scales them down.
    const width = shotWidth();
    const bust = bustWidth();
    drawn = { args: [kit, gr, pose, environment, onShot], width };
    const version = versionTag(`${import.meta.url}|${heroAssetsVersion()}`);
    const store = await openShots();
    let missing = [...CHARACTER_IDS];
    const widths: Record<ShotKind, number> = { portrait: width, bust };
    const prints = store ? await readPrints(store, version) : {};
    if (options.redraw === 'changed') missing = missing.filter((id) => heroFingerprint(id, heroHands(id)) !== prints[id]);
    else if (store && !options.redraw) {
      const stored = await Promise.all(missing.map(async (id) => ({ id, portrait: await readShot(store, version, id, 'portrait', width), bust: await readShot(store, version, id, 'bust', bust) })));
      missing = stored.filter((s) => !s.portrait || !s.bust).map((s) => s.id);
      for (const shot of stored) if (shot.portrait && shot.bust && !(onShot(shot.id, 'portrait', URL.createObjectURL(shot.portrait)) && onShot(shot.id, 'bust', URL.createObjectURL(shot.bust)))) return;
    }
    if (!missing.length) return;
    await draw(kit, gr, pose, environment, missing, widths, (id, kind, shot) => {
      if (store) keepShot(store, version, id, kind, widths[kind], shot).catch((error: unknown) => console.warn('Portrait not kept for the next visit', error));
      return onShot(id, kind, URL.createObjectURL(shot));
    });
    if (!store) return;
    for (const id of missing) prints[id] = heroFingerprint(id, heroHands(id)) ?? '';
    await keepPrints(store, version, prints);
    await pruneShots(store, version);
  } finally {
    drawing = false;
  }
}

/** A shot's size and the buffers it is drawn, cut out and encoded through. */
class Film {
  readonly hdr: THREE.WebGLRenderTarget;
  readonly straight: THREE.WebGLRenderTarget;
  readonly ldr: THREE.WebGLRenderTarget;
  readonly pixels: Uint8Array;
  readonly image: ImageData;
  private readonly cutout = document.createElement('canvas');
  private readonly glow = document.createElement('canvas');
  private readonly shot = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly width: number,
    readonly height: number
  ) {
    this.hdr = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
    this.straight = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType });
    this.ldr = new THREE.WebGLRenderTarget(width, height);
    this.pixels = new Uint8Array(width * height * 4);
    this.cutout.width = this.glow.width = width;
    this.cutout.height = this.glow.height = height;
    // The cutout blurred: the glow's shape.
    this.ctx = this.glow.getContext('2d', { willReadFrequently: true })!;
    this.ctx.filter = `blur(${(GLOW.blur * width) / 192}px)`;
    this.image = this.cutout.getContext('2d')!.createImageData(width, height);
  }

  /** The drawn pixels, sharpened, on their glow, faded over the bottom `fade` of the height and trimmed to the silhouette's top, as a PNG. */
  develop(fade = 0): Promise<Blob> {
    const { width, height, image } = this;
    // GL rows run bottom-up.
    for (let y = 0; y < height; y++) image.data.set(this.pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
    sharpen(image.data, width, height, SHARPEN);
    this.cutout.getContext('2d')!.putImageData(image, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(this.cutout, 0, 0);
    addGlow(image.data, this.ctx.getImageData(0, 0, width, height).data);
    if (fade > 0) fadeFoot(image.data, width, height, Math.round(height * fade));
    // Trimmed to the top of the silhouette's glow: the picker anchors the shot at the tile's foot.
    let top = 0;
    while (top < height - 1 && !rowHasInk(image.data, top, width)) top++;
    this.shot.width = width;
    this.shot.height = height - top;
    this.shot.getContext('2d')!.putImageData(image, 0, -top);
    return new Promise((resolve, reject) => this.shot.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Portrait could not be encoded'))), 'image/png'));
  }

  dispose() {
    this.hdr.dispose();
    this.straight.dispose();
    this.ldr.dispose();
  }
}

async function draw(kit: Kit, gr: GameRenderer, pose: AnimState, environment: THREE.Texture | null, ids: CharacterId[], widths: Record<ShotKind, number>, onShot: (id: CharacterId, kind: ShotKind, shot: Blob) => boolean) {
  const renderer = gr.renderer;
  const tall = BELOW + ABOVE + OVER;
  const film = new Film(widths.portrait, Math.round((widths.portrait * tall) / (BELOW + ABOVE)));
  const bustTall = BUST.below + ABOVE + OVER;
  const bustFilm = new Film(widths.bust, Math.round((widths.bust * bustTall) / BUST.width));
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
  const camera = new THREE.PerspectiveCamera(22, film.width / film.height, 0.05, 20);
  const unmix = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,
    fragmentShader: STRAIGHT,
    depthTest: false,
    depthWrite: false
  });
  const quad = new FullScreenQuad(unmix);
  const output = new OutputPass();
  output.renderToScreen = false;
  const head = new THREE.Vector3();
  const face = new THREE.Vector3();
  const color = new THREE.Color();

  /** Draws the scene through the lens framing `extent` meters top to bottom around `center`, into `into`. */
  const expose = (into: Film, center: number, extent: number) => {
    camera.aspect = into.width / into.height;
    camera.updateProjectionMatrix();
    const distance = extent / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(head.x, center - (0.07 * extent) / tall, head.z + distance);
    camera.lookAt(head.x, center, head.z);
    const saved = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, color: renderer.getClearColor(color).getHex(), alpha: renderer.getClearAlpha() };
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(into.hdr);
    renderer.render(scene, camera);
    unmix.uniforms.tMap!.value = into.hdr.texture;
    renderer.setRenderTarget(into.straight);
    quad.render(renderer);
    output.render(renderer, into.ldr, into.straight, 0, false);
    renderer.readRenderTargetPixels(into.ldr, 0, 0, into.width, into.height, into.pixels);
    renderer.setRenderTarget(saved.target);
    renderer.autoClear = saved.autoClear;
    renderer.setClearColor(saved.color, saved.alpha);
  };

  /** Turns the figure until its face is where the lens wants it, and finds its head. */
  const stand = (id: CharacterId, rig: CharacterRig) => {
    rig.update(0.5, pose);
    // A design may turn the head on the body, so the whole figure turns until the face is where the lens wants it.
    rig.root.getObjectByName('head')!.getWorldDirection(face).negate();
    rig.root.rotation.y = Math.PI - TURN[id] - Math.atan2(-face.x, -face.z);
    rig.root.updateMatrixWorld(true);
    return rig.headPosition(new THREE.Vector3());
  };
  /** Aims the lights on a head. */
  const light = (id: CharacterId) => {
    backs.forEach((back, i) => {
      back.intensity = RIM.intensity * (RIM_BOOST[id] ?? 1);
      back.target.position.copy(head);
      back.position.copy(head).add(RIMS[i]!);
    });
    // From just below the lens, under a hood's brim.
    facing.intensity = FACE_LIGHT.intensity * (FACE_LIGHT.hooded[id] ?? 1);
    facing.target.position.copy(head);
    facing.position.set(head.x - 0.3, head.y - 0.25, head.z + 1);
  };

  // Every portrait first, so the picker fills before the podium's busts are drawn.
  const posed: { id: CharacterId; rig: CharacterRig; at: THREE.Vector3 }[] = [];
  try {
    for (const id of ids) {
      // Building a model and drawing each shot are sizeable tasks: they go in separate frames.
      const rig = createCharacter(id, kit, { hands: heroHands(id) });
      rig.setStance(portraitStance(id));
      await new Promise(requestAnimationFrame);
      scene.add(rig.root);
      const at = stand(id, rig);
      posed.push({ id, rig, at });
      head.copy(at);
      light(id);
      const zoom = ZOOM[id] ?? 1;
      expose(film, head.y + (ABOVE + OVER - BELOW) / 2 / zoom, tall / zoom);
      scene.remove(rig.root);
      if (!onShot(id, 'portrait', await film.develop())) return;
      await new Promise(requestAnimationFrame);
    }
    for (const { id, rig, at } of posed) {
      scene.add(rig.root);
      head.copy(at);
      light(id);
      expose(bustFilm, head.y + (ABOVE + OVER - BUST.below) / 2, bustTall);
      scene.remove(rig.root);
      if (!onShot(id, 'bust', await bustFilm.develop(BUST.fade))) return;
      await new Promise(requestAnimationFrame);
    }
  } finally {
    for (const { rig } of posed) rig.dispose();
    for (const light of lights) light.dispose();
    film.dispose();
    bustFilm.dispose();
    unmix.dispose();
    quad.dispose();
    output.dispose();
  }
}

/** Fades the alpha of the bottom `rows` rows of an RGBA image out toward its foot. */
function fadeFoot(px: Uint8ClampedArray, width: number, height: number, rows: number) {
  for (let y = height - rows; y < height; y++) {
    const t = (height - 1 - y) / rows;
    const k = t * t * (3 - 2 * t);
    for (let x = 0, i = (y * width + x) * 4 + 3; x < width; x++, i += 4) px[i] = px[i]! * k;
  }
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
