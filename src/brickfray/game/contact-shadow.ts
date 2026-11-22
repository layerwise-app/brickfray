import * as THREE from 'three';
import { KEY_DIRECTION } from './studio';

export const SHADOW_LAYER = 5;
/** Half-width of the ground square the contact shadow covers, and how high above it a part still darkens it. */
export const SHADOW_EXTENT = 1.3;
const SHADOW_HEIGHT = 2.2;
/** The shadow camera sits this far under the stand's top: soles that dip into it would otherwise be cut by its near plane. */
const SINK = 0.03;
const SHADOW_SIZE = 256;
/**
 * How far the shadow leans per meter of height, away from the key light. The menu's lens is barely above the stand,
 * which it sees edge-on: the lean is turned toward the side, where it shows, instead of back behind the figure.
 */
const KEY_SLANT = new THREE.Vector2(KEY_DIRECTION.x, KEY_DIRECTION.z * 0.35).multiplyScalar(1.3 / KEY_DIRECTION.y);

/**
 * Soft shadow of the figure's own shape on the floor, drawn from its depth as seen from below:
 * parts near the floor darken it most. It needs no shadow maps, so the figure is grounded on every tier.
 */
export class ContactShadow {
  readonly mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  readonly camera = new THREE.OrthographicCamera(-SHADOW_EXTENT, SHADOW_EXTENT, SHADOW_EXTENT, -SHADOW_EXTENT, 0, SHADOW_HEIGHT + SINK);
  private readonly target = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE);
  private readonly soft = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { depthBuffer: false });
  /** Both sides: seen from below through a sole cut open, a boot's inside still marks its footprint. */
  private readonly depth = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
  private readonly ground = { value: 0 };
  private readonly shear = { value: new THREE.Vector2() };
  private readonly blur: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly clear = new THREE.Color();

  constructor(radius: number) {
    // Looks straight up, so depth is height above the floor; image x runs along world x and image y along world z.
    this.camera.rotation.x = Math.PI / 2;
    this.camera.position.y = -SINK;
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
        `float up = max( fragCoordZ - ${(SINK / (SHADOW_HEIGHT + SINK)).toFixed(5)}, 0.0 );
        gl_FragColor = vec4( vec3( 0.0 ), 0.72 * pow( 1.0 - up, 1.8 ) + 0.3 * pow( 1.0 - up, 40.0 ) );`
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
          float a = texture2D( tMap, vUv ).a;
          float near = a;
          a *= 0.1;
          for ( int i = 0; i < 6; i ++ ) {
            float t = float( i ) * 1.0472;
            float b = texture2D( tMap, vUv + vec2( cos( t ), sin( t ) ) * ${(2.4 / SHADOW_SIZE).toFixed(5)} ).a;
            near = max( near, b );
            a += b * 0.055;
            a += texture2D( tMap, vUv + vec2( cos( t + 0.5236 ), sin( t + 0.5236 ) ) * ${(5 / SHADOW_SIZE).toFixed(5)} ).a * 0.045;
            a += texture2D( tMap, vUv + vec2( cos( t ), sin( t ) ) * ${(9 / SHADOW_SIZE).toFixed(5)} ).a * 0.035;
            a += texture2D( tMap, vUv + vec2( cos( t + 0.5236 ), sin( t + 0.5236 ) ) * ${(14 / SHADOW_SIZE).toFixed(5)} ).a * 0.015;
          }
          // A dark rim a couple of centimetres round whatever touches the tile, in a wider soft penumbra, so the
          // feet read as standing on it rather than pasted over it.
          a = 0.5 * near * near + 0.5 * a;
          gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 - pow( 1.0 - min( a, 1.0 ), 2.2 ) );
        }`
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
    this.quad.frustumCulled = false;

    const geometry = new THREE.CircleGeometry(Math.min(radius, SHADOW_EXTENT), 48);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / (SHADOW_EXTENT * 2) + 0.5, position.getZ(i) / (SHADOW_EXTENT * 2) + 0.5);
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: this.soft.texture, transparent: true, depthWrite: false, opacity: 0.95, fog: false }));
    this.mesh.position.y = 0.006;
    this.mesh.renderOrder = 2;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.camera.updateWorldMatrix(true, false);
    const m = this.camera.matrixWorld.elements;
    this.ground.value = m[13]! + SINK;
    // Leans the shadow away from the key light (KEY_SLANT).
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
