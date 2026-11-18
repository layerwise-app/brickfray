import * as THREE from 'three';
import { createCharacter, STANCES } from '../characters';
import type { CharacterId, CharacterRig } from '../characters/types';
import type { Kit } from '../engine/kit';
import { Materials } from '../engine/materials';
import { QUALITY } from '../engine/quality';
import type { GameRenderer } from '../engine/renderer';
import { createWeaponModel } from '../weapons';
import { LOADOUTS } from '../weapons/loadouts';
import type { WeaponModel } from '../weapons/types';

/** Direction toward the key light: high on the side the figure faces, so its near flank falls into shade for the rim to catch. */
export const KEY_DIRECTION = new THREE.Vector3(-0.56, 0.68, 0.47).normalize();

/**
 * The studio rig around a figure standing at the origin and facing the camera on +Z: a warm key, a cool rim
 * from behind its shaded side, a weaker kicker behind the lit side, a low fill, and a dim sky light.
 */
export const STUDIO_LIGHTS = {
  key: { color: '#ffeeda', intensity: 2.75 },
  rim: { color: '#bcd6ff', intensity: 6, position: [3.1, 2, -3.5] },
  kicker: { color: '#9fb4ff', intensity: 2, position: [-3, 1.4, -3.4] },
  fill: { color: '#c9d6f2', intensity: 0.32, position: [2.8, 0.7, 3.4] },
  sky: { color: '#aebfe6', ground: '#6b5c50', intensity: 0.4 }
} as const;

/** One of the rig's lights, pointed at a figure's chest. */
export function aimed(spec: { color: string; intensity: number; position: readonly [number, number, number] }) {
  const light = new THREE.DirectionalLight(spec.color, spec.intensity);
  light.position.set(...spec.position);
  light.target.position.set(0, 1, 0);
  return light;
}

/** The stance each hero model is baked for; portraits ask for the same hands so they share the geometry. */
export function heroHands(id: CharacterId) {
  const stance = STANCES[id];
  return { L: stance.support ? ('cup' as const) : stance.arms.L.shape, R: stance.arms.R.shape };
}

/**
 * The character on show: the showroom build of the model in its signature
 * stance with its primary, under studio lights. It always uses the best
 * materials, whatever quality the match runs at — it is one figure on a
 * static stage.
 */
export class HeroDisplay {
  /** The figure with its lights and ground shadows; turning it turns the whole studio. */
  readonly group = new THREE.Group();
  /** Turn this to face the figure. */
  readonly figure = new THREE.Group();
  readonly kit: Kit = { profile: QUALITY.high, materials: new Materials(QUALITY.high) };
  readonly environment: THREE.Texture;
  private readonly envTarget: THREE.WebGLRenderTarget;
  private readonly key: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly kicker: THREE.DirectionalLight;
  private readonly contact: ContactShadow;
  private readonly blob: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private rig: CharacterRig | null = null;
  private gun: WeaponModel | null = null;
  private flash = 0;
  private frame = 0;

  /** `floorRadius` clips the ground shadows to a round stand; without it they fade out on an open floor. */
  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    floorRadius = SHADOW_EXTENT
  ) {
    this.envTarget = studioEnvironment(renderer);
    this.environment = this.envTarget.texture;

    const { key, rim, kicker, fill, sky } = STUDIO_LIGHTS;
    this.key = aimed({ ...key, position: [KEY_DIRECTION.x * 7, KEY_DIRECTION.y * 7 + 1, KEY_DIRECTION.z * 7] });
    // Real shadows from the key where the tier has shadow maps: a tight frustum around the one figure.
    this.key.castShadow = renderer.shadowMap.enabled;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.radius = 3;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.015;
    const frustum = this.key.shadow.camera;
    frustum.left = frustum.bottom = -2.1;
    frustum.right = frustum.top = 2.1;
    frustum.near = 1;
    frustum.far = 14;
    this.rim = aimed(rim);
    this.kicker = aimed(kicker);
    for (const light of [this.key, this.rim, this.kicker, aimed(fill)]) this.group.add(light, light.target);
    this.group.add(new THREE.HemisphereLight(sky.color, sky.ground, sky.intensity));

    const blobRadius = Math.min(0.95, floorRadius);
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(blobRadius, 40),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.6, fog: false })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.003;
    this.blob.renderOrder = 1;
    this.contact = new ContactShadow(floorRadius);
    this.group.add(this.figure, this.blob, this.contact.mesh, this.contact.camera);
  }

  setCharacter(id: CharacterId) {
    this.rig?.dispose();
    const stance = STANCES[id];
    this.rig = createCharacter(id, this.kit, { hands: heroHands(id) });
    this.rig.setStance(stance);
    const primary = LOADOUTS[id].primary;
    if (this.gun?.id !== primary) {
      this.gun?.dispose();
      this.gun = createWeaponModel(primary, this.kit, 'third');
    }
    this.rig.setWeapon(this.gun.root, this.gun.supportGrip);
    this.figure.add(this.rig.root);
    this.figure.traverse((o) => o.layers.enable(SHADOW_LAYER));
    this.flash = 1;
    this.frame = 0;
  }

  /**
   * Makes this display the scene's lighting: its reflections, and the renderer's own sun and sky light put away.
   * Call after `dress()`; the next scene to be dressed (a match) takes them back.
   */
  takeOver(scene: THREE.Scene, gr: GameRenderer) {
    scene.remove(gr.sun, gr.sun.target, gr.hemi);
    scene.environment = this.environment;
  }

  /** 1 right after a character change, fading to 0: the reveal's light pulse. */
  get pulse() {
    return this.flash;
  }

  update(dt: number) {
    this.rig?.update(dt, IDLE_STATE);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    const boost = 1 + this.flash ** 2 * 1.6;
    this.rim.intensity = STUDIO_LIGHTS.rim.intensity * boost;
    this.kicker.intensity = STUDIO_LIGHTS.kicker.intensity * boost;
    // The shadow is soft and the figure moves slowly: redrawing it every other frame halves its cost.
    if (this.frame++ % 2) return;
    let root: THREE.Object3D = this.group;
    while (root.parent) root = root.parent;
    if ((root as THREE.Scene).isScene) this.contact.render(this.renderer, root as THREE.Scene);
  }

  dispose() {
    this.rig?.dispose();
    this.gun?.dispose();
    this.blob.geometry.dispose();
    this.blob.material.map?.dispose();
    this.blob.material.dispose();
    this.contact.dispose();
    this.key.dispose();
    this.kit.materials.dispose();
    this.envTarget.dispose();
  }
}

const SHADOW_LAYER = 5;
/** Half-width of the ground square the contact shadow covers, and how high above it a part still darkens it. */
const SHADOW_EXTENT = 1.3;
const SHADOW_HEIGHT = 2.2;
const SHADOW_SIZE = 256;
const KEY_SLANT = new THREE.Vector2(KEY_DIRECTION.x, KEY_DIRECTION.z).multiplyScalar(0.4 / KEY_DIRECTION.y);

const IDLE_STATE = {
  localVelocity: { x: 0, z: 0 },
  speed: 0,
  grounded: true,
  verticalVelocity: 0,
  crouch: 0,
  sprint: false,
  aimPitch: 0,
  ads: 0,
  weapon: 'ar' as const,
  sinceShot: 99,
  reload: -1,
  melee: -1,
  grenade: -1,
  sinceHurt: 99,
  hurtDirection: { x: 0, z: 0 }
};

/**
 * Soft shadow of the figure's own shape on the floor, drawn from its depth as seen from below:
 * parts near the floor darken it most. It needs no shadow maps, so the figure is grounded on every tier.
 */
class ContactShadow {
  readonly mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  readonly camera = new THREE.OrthographicCamera(-SHADOW_EXTENT, SHADOW_EXTENT, SHADOW_EXTENT, -SHADOW_EXTENT, 0, SHADOW_HEIGHT);
  private readonly target = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE);
  private readonly soft = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { depthBuffer: false });
  private readonly depth = new THREE.MeshDepthMaterial();
  private readonly ground = { value: 0 };
  private readonly shear = { value: new THREE.Vector2() };
  private readonly blur: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly clear = new THREE.Color();

  constructor(radius: number) {
    // Looks straight up, so depth is height above the floor; image x runs along world x and image y along world z.
    this.camera.rotation.x = Math.PI / 2;
    this.camera.layers.set(SHADOW_LAYER);
    this.depth.onBeforeCompile = (shader) => {
      shader.uniforms.uShear = this.shear;
      shader.uniforms.uGround = this.ground;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec2 uShear;\nuniform float uGround;')
        .replace(
          '#include <project_vertex>',
          /* glsl */ `vec4 mvPosition = modelMatrix * vec4( transformed, 1.0 );
          mvPosition.xz -= uShear * max( mvPosition.y - uGround, 0.0 );
          mvPosition = viewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 2.2 ) );'
      );
    };
    // One pass: every extra render target costs a weak GPU more than these taps do.
    this.blur = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: { tMap: { value: this.target.texture } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap; varying vec2 vUv;
        void main() {
          float a = texture2D( tMap, vUv ).a * 0.16;
          for ( int i = 0; i < 6; i ++ ) {
            float t = float( i ) * 1.0472;
            a += texture2D( tMap, vUv + vec2( cos( t ), sin( t ) ) * ${(2.2 / SHADOW_SIZE).toFixed(5)} ).a * 0.09;
            a += texture2D( tMap, vUv + vec2( cos( t + 0.5236 ), sin( t + 0.5236 ) ) * ${(4.6 / SHADOW_SIZE).toFixed(5)} ).a * 0.05;
          }
          gl_FragColor = vec4( 0.0, 0.0, 0.0, a );
        }`
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
    this.quad.frustumCulled = false;

    const geometry = new THREE.CircleGeometry(Math.min(radius, SHADOW_EXTENT), 48);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / (SHADOW_EXTENT * 2) + 0.5, position.getZ(i) / (SHADOW_EXTENT * 2) + 0.5);
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: this.soft.texture, transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
    this.mesh.position.y = 0.006;
    this.mesh.renderOrder = 2;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.camera.updateWorldMatrix(true, false);
    const m = this.camera.matrixWorld.elements;
    this.ground.value = m[13]!;
    // Leans the shadow away from the key light, a fraction of the true slant so it stays a contact shadow.
    // The camera's x and y axes are the display's x and z, so this follows the display when it is turned.
    this.shear.value.set(m[0]! * KEY_SLANT.x + m[4]! * KEY_SLANT.y, m[2]! * KEY_SLANT.x + m[6]! * KEY_SLANT.y);
    const saved = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, alpha: renderer.getClearAlpha(), override: scene.overrideMaterial, background: scene.background };
    renderer.getClearColor(this.clear);
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    scene.overrideMaterial = this.depth;
    scene.background = null;
    renderer.setRenderTarget(this.target);
    renderer.render(scene, this.camera);
    scene.overrideMaterial = saved.override;
    scene.background = saved.background;
    renderer.setRenderTarget(this.soft);
    renderer.render(this.quad, this.quadCamera);
    renderer.setRenderTarget(saved.target);
    renderer.autoClear = saved.autoClear;
    renderer.setClearColor(this.clear, saved.alpha);
  }

  dispose() {
    this.target.dispose();
    this.soft.dispose();
    this.depth.dispose();
    this.blur.dispose();
    this.quad.geometry.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/**
 * Reflections of a dark photo studio: a big warm softbox on the key side, cool strips behind for edge
 * highlights, a dim fill and a floor bounce. Dark walls keep chrome and clearcoat contrasty instead of milky.
 */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const box = new THREE.BoxGeometry();
  const materials: THREE.Material[] = [];
  const slab = (color: string, strength: number, position: THREE.Vector3Tuple, size: THREE.Vector3Tuple, side: THREE.Side = THREE.FrontSide) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side });
    materials.push(material);
    const mesh = new THREE.Mesh(box, material);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    scene.add(mesh);
    return mesh;
  };
  /** A light card of `width` × `height` facing the figure. */
  const card = (color: string, strength: number, position: THREE.Vector3Tuple, width: number, height: number) => slab(color, strength, position, [width, height, 0.2]).lookAt(0, 1, 0);
  slab('#27304a', 1, [0, 5, 0], [30, 14, 30], THREE.BackSide);
  slab('#8a7a6c', 0.5, [0, -1.2, 0], [28, 0.2, 28]);
  // Key softbox, top light, two back strips, fill card.
  card('#fff0dc', 11, [-6.5, 6.5, 5.5], 5.5, 5.5);
  card('#e9f0ff', 4.5, [0.5, 9.5, 0.5], 7, 4);
  card('#a9c8ff', 13, [6.5, 4, -7.5], 1.6, 8);
  card('#93a6ff', 7, [-8, 3.2, -6], 1.4, 6.5);
  card('#cdd8f0', 1.6, [7.5, 2, 6], 5, 4);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  box.dispose();
  for (const material of materials) material.dispose();
  return target;
}

/** Wide soft pool under the figure: the ambient part of its shadow. */
function blobTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.8)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
