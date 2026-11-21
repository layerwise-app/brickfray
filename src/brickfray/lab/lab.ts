import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadHeroAssets } from '../characters';
import { GameRenderer } from '../engine/renderer';
import type { QualityLevel } from '../engine/quality';
import type { LabContext, LabScene } from './types';

const scenes = import.meta.glob<{ default: (ctx: LabContext) => LabScene | void | Promise<LabScene | void> }>('./scenes/*.ts');

export interface LabHandle {
  ready: boolean;
  error: string | null;
  scenes: string[];
  setCamera(position: [number, number, number], target: [number, number, number], fov?: number): void;
  frames(count: number): Promise<void>;
  stats(): { calls: number; triangles: number; fps: number };
  call(name: string, ...args: unknown[]): unknown;
}

declare global {
  interface Window {
    __lab?: LabHandle;
  }
}

/**
 * Dev harness: `/lab?scene=<file in ./scenes>&quality=low|medium|high`.
 * Scenes get a dressed scene, an orbit camera and a frame hook; scripts drive
 * it through `window.__lab` for headless screenshots.
 */
export async function startLab(canvas: HTMLCanvasElement, sceneName: string, quality: QualityLevel) {
  // `?plain` shows the figures without their baked showroom extras; `?unshaded` and `?bare` are what the bakes are
  // made from: no baked occlusion, and no draped cloth at all.
  const query = new URLSearchParams(location.search);
  if (!query.has('plain')) await loadHeroAssets({ occlusion: !query.has('unshaded') && !query.has('bare'), drapes: !query.has('bare') });
  const gr = new GameRenderer(canvas, quality);
  const scene = new THREE.Scene();
  gr.dress(scene);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 600);
  camera.position.set(4, 3, 6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  const frameHooks: ((dt: number, t: number) => void)[] = [];
  let viewScene: THREE.Scene | null = null;
  let viewCamera: THREE.Camera | null = null;
  const ctx: LabContext = {
    renderer: gr,
    scene,
    camera,
    controls,
    quality,
    onFrame: (fn) => frameHooks.push(fn),
    setViewLayer: (s, c) => {
      viewScene = s;
      viewCamera = c;
    }
  };
  const handle: LabHandle = {
    ready: false,
    error: null,
    scenes: Object.keys(scenes).map((k) => k.replace('./scenes/', '').replace('.ts', '')),
    setCamera(position, target, fov) {
      camera.position.set(...position);
      controls.target.set(...target);
      if (fov) camera.fov = fov;
      camera.updateProjectionMatrix();
      controls.update();
    },
    frames(count) {
      return new Promise((resolve) => {
        let left = count;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
    },
    stats: () => ({ calls: gr.renderer.info.render.calls, triangles: gr.renderer.info.render.triangles, fps }),
    call: (name, ...args) => labScene?.api?.[name]?.(...args)
  };
  window.__lab = handle;
  let labScene: LabScene | void = undefined;
  const loader = scenes[`./scenes/${sceneName}.ts`];
  try {
    if (!loader) throw new Error(`Unknown lab scene "${sceneName}". Known: ${handle.scenes.join(', ')}`);
    labScene = await (await loader()).default(ctx);
  } catch (error) {
    handle.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    console.error(error);
  }
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    gr.resize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    labScene?.resize?.(w, h);
  };
  resize();
  window.addEventListener('resize', resize);
  const clock = new THREE.Clock();
  let fps = 0;
  let acc = 0;
  let frames = 0;
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    acc += dt;
    frames++;
    if (acc > 0.5) {
      fps = frames / acc;
      acc = 0;
      frames = 0;
    }
    controls.update();
    for (const fn of frameHooks) fn(dt, t);
    gr.followShadow(controls.target);
    gr.render(scene, camera, viewScene, viewCamera);
  };
  loop();
  handle.ready = true;
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    controls.dispose();
    labScene?.dispose?.();
    gr.dispose();
  };
}
