import * as THREE from 'three';
import type { Kit } from '../engine/kit';
import { ballGeo, coneGeo, mat, bake } from './geo';
import { buildFlames, type Flame } from './flames';
import { buildFlags, type Flag, type FlagPattern } from './flags';
import { Foam } from './foam';
import { LightPools } from './light-pools';
import { buildWater, type Sky, type WaterRect } from './water';
import type { Vec3 } from './util';

export type { FlagPattern } from './flags';

interface Jet {
  pos: Vec3;
  height: number;
  spread: number;
}

/** Collects every animated bit of a map and turns each kind into one draw call. */
export class Anim {
  private waters: WaterRect[] = [];
  /** Lines where water meets posts, walls and hulls. */
  readonly foam = new Foam();
  readonly pools = new LightPools();
  /** Sky colours the water reflects where there is no environment map. */
  sky: Sky = { zenith: '#5fa8f0', horizon: '#dbeaf4' };
  private flags: Flag[] = [];
  private blinks: { pos: Vec3; color: string; radius: number }[] = [];
  private flames: Flame[] = [];
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

  flame(pos: Vec3, wall?: Flame['wall']) {
    this.flames.push({ pos, wall });
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
      const water = buildWater(this.waters, this.kit, this.sky);
      own(water);
      root.add(water.mesh);
      updates.push((_dt, t) => water.update(t));
    }
    const foam = this.foam.build();
    if (foam) {
      own(foam);
      root.add(foam.mesh);
      updates.push((_dt, t) => foam.update(t));
    }
    const pools = this.pools.build();
    if (pools) {
      own(pools);
      root.add(pools.mesh);
    }

    if (this.flags.length) {
      const flags = own(buildFlags(this.flags, p));
      root.add(flags.mesh);
      updates.push((_dt, t) => flags.update(t));
    }

    if (this.blinks.length) {
      const g = own(bake(this.blinks.map((b) => ({ g: ballGeo(b.radius, 1), m: mat(...b.pos) }))));
      const m = own(new THREE.MeshBasicMaterial({ color: this.blinks[0]!.color, toneMapped: false }));
      const base = new THREE.Color(this.blinks[0]!.color);
      root.add(new THREE.Mesh(g, m));
      updates.push((_dt, t) => m.color.copy(base).multiplyScalar(t % 1.6 < 0.35 ? 2.2 : 0.18));
    }

    if (this.flames.length) updates.push(buildFlames(this.flames, root, own));

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
    const at = new THREE.Vector3();
    const stretch = new THREE.Vector3(1, 1, 1);
    return [
      (_dt: number, t: number) => {
        this.jets.forEach((j, i) => {
          const h = j.height * (0.92 + Math.sin(t * 2.4 + i) * 0.08);
          tmp.compose(at.set(...j.pos), q, stretch.setY(h));
          columns.setMatrixAt(i, tmp);
          for (let k = 0; k < drops; k++) {
            const a = (k / drops) * Math.PI * 2;
            const life = (t * 0.55 + k * 0.618) % 1;
            const r = j.spread * life;
            const y = j.pos[1] + h * 0.9 + (4 * life - 4 * life * life) * 0.5 - life * life * h * 0.85;
            tmp.compose(at.set(j.pos[0] + Math.cos(a) * r, y, j.pos[2] + Math.sin(a) * r), q, one);
            dropMesh.setMatrixAt(i * drops + k, tmp);
          }
        });
        columns.instanceMatrix.needsUpdate = true;
        dropMesh.instanceMatrix.needsUpdate = true;
      }
    ];
  }
}
