import * as THREE from 'three';
import type { Kit } from '../engine/kit';
import { ballGeo, coneGeo, mergeAll, mat, bake } from './geo';
import type { Vec3 } from './util';

interface Flag {
  origin: Vec3;
  yaw: number;
  width: number;
  height: number;
  colors: string[];
  /** Pole flags flutter from their side; banners hang from their top edge. */
  hang: boolean;
  pattern: FlagPattern;
}

/** bands: horizontal stripes; chevron: field, chevron, optional hem; border: field, border and center lozenge. */
export type FlagPattern = 'bands' | 'chevron' | 'border';

function flagColor(f: Flag, u: number, v: number) {
  const [a, b = a, hem] = f.colors;
  if (f.pattern === 'chevron') {
    if (hem && v > 0.88) return hem;
    const d = v - (0.3 + Math.abs(u - 0.5) * 0.9);
    return d >= 0 && d <= 0.16 ? b : a;
  }
  if (f.pattern === 'border') {
    const edge = Math.min(u, 1 - u, v, 1 - v);
    if (edge < 0.12) return b;
    return Math.abs(u - 0.5) * 1.6 + Math.abs(v - 0.5) < 0.24 ? b : a;
  }
  return f.colors[Math.min(f.colors.length - 1, Math.floor(v * f.colors.length))]!;
}

interface Jet {
  pos: Vec3;
  height: number;
  spread: number;
}

let waterNormal: THREE.DataTexture | null = null;

/** Tileable ripple normal map from integer-frequency sines. */
function rippleTexture() {
  if (waterNormal) return waterNormal;
  const size = 128;
  const h = (x: number, y: number) => {
    const u = (x / size) * Math.PI * 2;
    const v = (y / size) * Math.PI * 2;
    return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 5 - v * 4 + 1.3) * 0.3 + Math.sin(u * 2 + v * 7 + 0.4) * 0.2 + Math.sin(-u * 8 + v * 3) * 0.12;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (h(x - 1, y) - h(x + 1, y)) * 2.2;
      const ny = (h(x, y - 1) - h(x, y + 1)) * 2.2;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  waterNormal = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.magFilter = THREE.LinearFilter;
  waterNormal.minFilter = THREE.LinearMipmapLinearFilter;
  waterNormal.generateMipmaps = true;
  waterNormal.needsUpdate = true;
  return waterNormal;
}

/** Collects every animated bit of a map and turns each kind into one draw call. */
export class Anim {
  private waters: { x0: number; z0: number; x1: number; z1: number; y: number; color: string }[] = [];
  private flags: Flag[] = [];
  private blinks: { pos: Vec3; color: string; radius: number }[] = [];
  private flames: Vec3[] = [];
  private jets: Jet[] = [];

  constructor(readonly kit: Kit) {}

  water(x0: number, z0: number, x1: number, z1: number, y: number, color: string) {
    this.waters.push({ x0, z0, x1, z1, y, color });
  }

  flag(origin: Vec3, yaw: number, width: number, height: number, colors: string[], hang = false, pattern: FlagPattern = 'bands') {
    this.flags.push({ origin, yaw, width, height, colors, hang, pattern });
  }

  blink(pos: Vec3, color: string, radius = 0.18) {
    this.blinks.push({ pos, color, radius });
  }

  flame(pos: Vec3) {
    this.flames.push(pos);
  }

  jet(pos: Vec3, height: number, spread: number) {
    this.jets.push({ pos, height, spread });
  }

  build() {
    const root = new THREE.Group();
    root.name = 'animated';
    const p = this.kit.profile;
    const owned: { dispose(): void }[] = [];
    const updates: ((dt: number, t: number) => void)[] = [];
    const own = <T extends { dispose(): void }>(x: T) => (owned.push(x), x);

    if (this.waters.length) {
      const pos: number[] = [];
      const uv: number[] = [];
      const col: number[] = [];
      const c = new THREE.Color();
      for (const w of this.waters) {
        c.set(w.color);
        for (const [x, z] of [[w.x0, w.z0], [w.x0, w.z1], [w.x1, w.z1], [w.x0, w.z0], [w.x1, w.z1], [w.x1, w.z0]] as const) {
          pos.push(x, w.y, z);
          uv.push(x / 6, z / 6);
          col.push(c.r, c.g, c.b);
        }
      }
      const g = own(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const tex = rippleTexture().clone();
      tex.needsUpdate = true;
      own(tex);
      const m = own(
        p.pbr
          ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.15, normalMap: tex, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.3 })
          : new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 80, specular: 0x557788, normalMap: tex, normalScale: new THREE.Vector2(0.4, 0.4) })
      );
      const mesh = new THREE.Mesh(g, m);
      mesh.name = 'water';
      mesh.receiveShadow = p.shadows;
      root.add(mesh);
      updates.push((_dt, t) => tex.offset.set(t * 0.018, Math.sin(t * 0.21) * 0.05 + t * 0.011));
    }

    if (this.flags.length) {
      const base: number[] = [];
      const color: number[] = [];
      const info: number[] = [];
      const c = new THREE.Color();
      this.flags.forEach((f, fi) => {
        const cols = p.detail >= 1 ? 12 : 4;
        const rows = p.detail >= 1 ? (f.hang ? 14 : 8) : f.hang ? 4 : 2;
        const ca = Math.cos(f.yaw);
        const sa = Math.sin(f.yaw);
        const vert = (k: number, r: number) => {
          const u = k / cols;
          const v = r / rows;
          base.push(f.origin[0] + ca * u * f.width, f.origin[1] - v * f.height, f.origin[2] - sa * u * f.width);
          color.push(c.r, c.g, c.b);
          info.push(f.hang ? v : u, fi * 1.7, sa, ca, u);
        };
        for (let r = 0; r < rows; r++) {
          for (let k = 0; k < cols; k++) {
            c.set(flagColor(f, (k + 0.5) / cols, (r + 0.5) / rows));
            for (const [dk, dr] of [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]] as const) vert(k + dk, r + dr);
          }
        }
      });
      const g = own(new THREE.BufferGeometry());
      const positions = new Float32Array(base);
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
      g.computeVertexNormals();
      const m = own(
        p.pbr
          ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide })
          : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
      );
      const mesh = new THREE.Mesh(g, m);
      mesh.name = 'flags';
      mesh.castShadow = p.shadows;
      root.add(mesh);
      updates.push((_dt, t) => {
        for (let i = 0; i < positions.length / 3; i++) {
          const w = info[i * 5]!;
          const phase = info[i * 5 + 1]!;
          const along = info[i * 5 + 4]!;
          const amp = w * 0.16;
          const off = Math.sin(t * 3.1 + phase - along * 5.5) * amp + Math.sin(t * 1.7 + phase * 2 - along * 3) * amp * 0.5;
          positions[i * 3] = base[i * 3]! + info[i * 5 + 2]! * off;
          positions[i * 3 + 2] = base[i * 3 + 2]! + info[i * 5 + 3]! * off;
        }
        g.getAttribute('position').needsUpdate = true;
        if (p.detail >= 1) g.computeVertexNormals();
      });
    }

    if (this.blinks.length) {
      const g = own(bake(this.blinks.map((b) => ({ g: ballGeo(b.radius, 1), m: mat(...b.pos) }))));
      const m = own(new THREE.MeshBasicMaterial({ color: this.blinks[0]!.color, toneMapped: false }));
      const base = new THREE.Color(this.blinks[0]!.color);
      root.add(new THREE.Mesh(g, m));
      updates.push((_dt, t) => m.color.copy(base).multiplyScalar(t % 1.6 < 0.35 ? 2.2 : 0.18));
    }

    if (this.flames.length) {
      const g = own(mergeAll([coneGeo(0.09, 0, 0.34, 8).clone().translate(0, 0.02, 0), ballGeo(0.085, 0).clone().translate(0, 0.07, 0)]));
      const m = own(new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }));
      const mesh = new THREE.InstancedMesh(g, m, this.flames.length);
      const tmp = new THREE.Matrix4();
      const inner = new THREE.Color('#ffd27a');
      this.flames.forEach((_, i) => mesh.setColorAt(i, i % 2 ? inner : new THREE.Color('#ff9a3c')));
      mesh.frustumCulled = false;
      root.add(mesh);
      updates.push((_dt, t) => {
        this.flames.forEach((f, i) => {
          const s = 1 + Math.sin(t * 11 + i * 2.3) * 0.12 + Math.sin(t * 17.3 + i) * 0.08;
          tmp.compose(new THREE.Vector3(...f), new THREE.Quaternion(), new THREE.Vector3(1 / s, s * 1.1, 1 / s));
          mesh.setMatrixAt(i, tmp);
        });
        mesh.instanceMatrix.needsUpdate = true;
      });
    }

    if (this.jets.length) updates.push(...this.buildJets(root, own));

    return {
      root,
      update(dt: number, t: number) {
        for (const u of updates) u(dt, t);
      },
      dispose() {
        for (const o of owned) o.dispose();
      }
    };
  }

  /** Fountain columns plus droplets riding parabolas. */
  private buildJets(root: THREE.Group, own: <T extends { dispose(): void }>(x: T) => T) {
    const p = this.kit.profile;
    const drops = p.detail >= 2 ? 28 : p.detail >= 1 ? 16 : 8;
    const m = own(
      p.pbr
        ? new THREE.MeshStandardMaterial({ color: '#cdeefc', roughness: 0.05, transparent: true, opacity: 0.62, envMapIntensity: 1.5 })
        : new THREE.MeshPhongMaterial({ color: '#cdeefc', shininess: 90, transparent: true, opacity: 0.6 })
    );
    const column = own(coneGeo(0.09, 0.04, 1, 10).clone());
    const columns = new THREE.InstancedMesh(column, m, this.jets.length);
    const drop = own(ballGeo(0.07, p.detail >= 1 ? 1 : 0).clone());
    const dropMesh = new THREE.InstancedMesh(drop, m, this.jets.length * drops);
    columns.frustumCulled = false;
    dropMesh.frustumCulled = false;
    root.add(columns, dropMesh);
    const tmp = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    return [
      (_dt: number, t: number) => {
        this.jets.forEach((j, i) => {
          const h = j.height * (0.92 + Math.sin(t * 2.4 + i) * 0.08);
          tmp.compose(new THREE.Vector3(...j.pos), q, new THREE.Vector3(1, h, 1));
          columns.setMatrixAt(i, tmp);
          for (let k = 0; k < drops; k++) {
            const a = (k / drops) * Math.PI * 2;
            const life = (t * 0.55 + k * 0.618) % 1;
            const r = j.spread * life;
            const y = j.pos[1] + h * 0.9 + (4 * life - 4 * life * life) * 0.5 - life * life * h * 0.85;
            tmp.compose(new THREE.Vector3(j.pos[0] + Math.cos(a) * r, y, j.pos[2] + Math.sin(a) * r), q, one);
            dropMesh.setMatrixAt(i * drops + k, tmp);
          }
        });
        columns.instanceMatrix.needsUpdate = true;
        dropMesh.instanceMatrix.needsUpdate = true;
      }
    ];
  }
}
