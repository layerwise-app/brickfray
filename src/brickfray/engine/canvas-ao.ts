import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

/** AO is computed at this share of the drawn width and height: at 0.5 it cost 1 ms more at 1440p and looked the same. */
const AO_SCALE = 0.35;

/**
 * Ambient occlusion for a frame drawn straight to the canvas. GTAO runs on its own reduced-size normal and depth pass
 * before the canvas is touched, and its result is multiplied over the drawn world (before the view model). A
 * composer target instead (4x multisampled, half float) is stored, reloaded and resolved off tile: about 15 ms a
 * frame at 1440p here, against nothing for the canvas's own multisampling.
 */
export class CanvasAO extends GTAOPass {
  private readonly blend = new FullScreenQuad(
    new THREE.ShaderMaterial({
      uniforms: { tAO: { value: null }, intensity: { value: 0.85 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      // The canvas holds display (sRGB) values: darkening linear light by `ao` is a factor of about ao^(1/2.2) here.
      fragmentShader: /* glsl */ `
        uniform sampler2D tAO;
        uniform float intensity;
        varying vec2 vUv;
        void main() {
          float ao = mix(1.0, texture2D(tAO, vUv).r, intensity);
          gl_FragColor = vec4(vec3(pow(ao, 0.4545)), 1.0);
        }`,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      depthTest: false,
      depthWrite: false
    })
  );
  private readonly size = new THREE.Vector2();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super(scene, camera, 1, 1);
    this.output = GTAOPass.OUTPUT.Off;
    this.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1, scale: 1, samples: 12 });
    // Radius in AO pixels (about 9 on screen; the full-size pass blurred 6).
    this.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 3, rings: 2, samples: 12 });
  }

  /** Before anything is drawn to the canvas: AO for a frame `width` by `height` drawn pixels. */
  draw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, width: number, height: number) {
    this.scene = scene;
    this.camera = camera;
    const w = Math.max(1, Math.round(width * AO_SCALE));
    const h = Math.max(1, Math.round(height * AO_SCALE));
    if (w !== this.size.x || h !== this.size.y) {
      this.size.set(w, h);
      this.setSize(w, h);
    }
    const target = renderer.getRenderTarget();
    this.render(renderer, null as unknown as THREE.WebGLRenderTarget, null as unknown as THREE.WebGLRenderTarget, 0, false);
    renderer.setRenderTarget(target);
  }

  /** Multiplies the AO over what the current target's viewport holds. */
  composite(renderer: THREE.WebGLRenderer) {
    (this.blend.material as THREE.ShaderMaterial).uniforms.tAO!.value = this.pdRenderTarget.texture;
    this.blend.render(renderer);
  }

  /** Parts that only stand in for detail (userData.noAO) stay out of the AO's normal and depth pass. */
  override overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse((o) => {
      if (o.userData.noAO) o.visible = false;
    });
  }

  override dispose() {
    super.dispose();
    this.blend.material.dispose();
    this.blend.dispose();
  }
}
