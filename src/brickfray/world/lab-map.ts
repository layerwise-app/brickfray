import * as THREE from 'three';
import type { LabContext, LabScene } from '../lab/types';
import { lastBuildStats, lastElementStats } from './plan';
import type { MapDefinition, MapLayout } from './types';
import type { Vec3 } from './util';
import { validateLayout } from './validate';

export interface LabView {
  name: string;
  cam: Vec3;
  target: Vec3;
  fov?: number;
}

const SURFACE_COLORS: Record<string, string> = {
  plastic: '#ff3b8d',
  stone: '#ffe14d',
  wood: '#ff9d2e',
  metal: '#47e0ff',
  glass: '#b9f6ff',
  foliage: '#5dff6a',
  water: '#3a7bff'
};

function colliderLines(layout: MapLayout) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const b of layout.colliders) {
    c.set(b.bulletsPass ? '#ffffff' : SURFACE_COLORS[b.surface] ?? '#ff00ff');
    const [x0, y0, z0] = b.min;
    const [x1, y1, z1] = b.max;
    const v = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]
    ];
    for (const [a, e] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const) {
      pos.push(...v[a]!, ...v[e]!);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 }));
  lines.renderOrder = 20;
  return lines;
}

function spawnMarkers(layout: MapLayout) {
  const group = new THREE.Group();
  const cone = new THREE.ConeGeometry(0.28, 0.7, 10);
  cone.rotateX(-Math.PI / 2);
  for (const s of layout.spawns) {
    const color = s.team === 0 ? '#2f7bff' : s.team === 1 ? '#ff4a3a' : '#ffffff';
    const m = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color, depthTest: false }));
    m.position.set(s.position[0], s.position[1] + 1, s.position[2]);
    m.rotation.y = s.yaw;
    m.renderOrder = 21;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    post.position.set(s.position[0], s.position[1] + 0.5, s.position[2]);
    post.renderOrder = 21;
    group.add(m, post);
  }
  return group;
}

function waypointLines(layout: MapLayout) {
  const pos: number[] = [];
  for (const w of layout.waypoints) {
    for (const j of w.links) {
      const b = layout.waypoints[j]!.position;
      pos.push(w.position[0], w.position[1] + 0.25, w.position[2], b[0], b[1] + 0.25, b[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#00ffd0', depthTest: false, transparent: true, opacity: 0.7 }));
  const dots = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(layout.waypoints.flatMap((w) => [w.position[0], w.position[1] + 0.25, w.position[2]]), 3)),
    new THREE.PointsMaterial({ color: '#ffffff', size: 6, sizeAttenuation: false, depthTest: false })
  );
  const group = new THREE.Group();
  group.add(lines, dots);
  group.renderOrder = 22;
  lines.renderOrder = 22;
  dots.renderOrder = 23;
  return group;
}

/** Shared lab scene for a map: atmosphere, scenery, named views and debug overlays. */
export function mapLab(ctx: LabContext, def: MapDefinition, views: LabView[]): LabScene {
  const { renderer: gr, scene } = ctx;
  gr.setAtmosphere(scene, def.atmosphere);
  const t0 = performance.now();
  const layout = def.layout();
  const t1 = performance.now();
  const visual = def.build({ profile: gr.profile, materials: gr.materials });
  const t2 = performance.now();
  scene.add(visual.root);
  ctx.onFrame((dt, t) => visual.update(dt, t));
  const overlays: Record<string, THREE.Object3D | null> = { colliders: null, spawns: null, waypoints: null };
  const toggle = (name: string, make: () => THREE.Object3D, on: unknown) => {
    if (on && !overlays[name]) scene.add((overlays[name] = make()));
    if (!on && overlays[name]) {
      scene.remove(overlays[name]!);
      overlays[name] = null;
    }
    return !!on;
  };
  const view = (name: unknown) => {
    const v = views.find((x) => x.name === name) ?? views[0]!;
    ctx.camera.position.set(...v.cam);
    ctx.controls.target.set(...v.target);
    ctx.camera.fov = v.fov ?? 60;
    ctx.camera.updateProjectionMatrix();
    ctx.controls.update();
    return v.name;
  };
  view(views[0]!.name);
  return {
    api: {
      views: () => views.map((v) => v.name),
      view,
      debugColliders: (on) => toggle('colliders', () => colliderLines(layout), on),
      debugSpawns: (on) => toggle('spawns', () => spawnMarkers(layout), on),
      debugWaypoints: (on) => toggle('waypoints', () => waypointLines(layout), on),
      info: () => ({
        colliders: layout.colliders.length,
        spawns: layout.spawns.length,
        team0: layout.spawns.filter((s) => s.team === 0).length,
        team1: layout.spawns.filter((s) => s.team === 1).length,
        waypoints: layout.waypoints.length,
        layoutMs: Math.round(t1 - t0),
        buildMs: Math.round(t2 - t1)
      }),
      validate: () => validateLayout(layout),
      tris: () => ({ families: lastBuildStats, elements: lastElementStats }),
      passes: async () => {
        const measure = async () => {
          await new Promise((r) => setTimeout(r, 300));
          return gr.renderer.info.render.triangles;
        };
        const all = await measure();
        gr.sun.castShadow = false;
        const noShadow = await measure();
        gr.sun.castShadow = gr.profile.shadows;
        return { all, shadowPass: all - noShadow };
      }
    },
    dispose() {
      scene.remove(visual.root);
      visual.dispose();
    }
  };
}
