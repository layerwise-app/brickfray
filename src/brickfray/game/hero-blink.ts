import * as THREE from 'three';
import type { Rig } from '../characters/rig';
import { BONE } from '../characters/skeleton';

/** Columns across a lid and rows down it; the last two rows are the lash line. */
const COLS = 9;
const ROWS = 7;
const LASH = 0.0026;
const LASH_COLOR = new THREE.Color('#1d2026');
const LASH_SURFACE = [0.4, 0, 0, 0] as const;
/** Cells across the height map of each eye's front, and how far the lid stands off it. */
const GRID = 14;
const CLEAR = 0.0011;

interface Eye {
  x: number;
  y: number;
  /** Depth of the eyeball's centre. */
  z: number;
  halfWidth: number;
  halfHeight: number;
  /** The frontmost depth of the face over the eye (white, iris, pupil, glint, the lids round it), GRID × GRID across its box. */
  front: Float32Array;
}

/**
 * Lids that sweep down over a sculpted face's eyes for a blink. The eyes are rigid on the head bone, so the showroom
 * lays its own lids over them: found from the baked face (its eye whites), coloured and shaded like the skin just above
 * them, and drawn only while the eyes are closing.
 */
export class Eyelids {
  private readonly meshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];
  private shut = 0;

  private constructor(
    private readonly eyes: Eye[],
    head: THREE.Bone,
    material: THREE.Material,
    skin: THREE.Color,
    surface: ArrayLike<number>
  ) {
    for (const eye of eyes) {
      const count = COLS * (ROWS + 1);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const color = new Float32Array(count * 3);
      const surf = new Float32Array(count * 4);
      for (let row = 0; row <= ROWS; row++) {
        const lash = row >= ROWS - 1;
        for (let col = 0; col < COLS; col++) {
          const i = row * COLS + col;
          (lash ? LASH_COLOR : skin).toArray(color, i * 3);
          surf.set(lash ? LASH_SURFACE : Array.from(surface), i * 4);
        }
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
      geometry.setAttribute('surface', new THREE.BufferAttribute(surf, 4));
      const index: number[] = [];
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS - 1; col++) {
          const a = row * COLS + col;
          index.push(a, a + 1, a + COLS, a + 1, a + COLS + 1, a + COLS);
        }
      }
      geometry.setIndex(index);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.userData.eye = eye;
      head.add(mesh);
      this.meshes.push(mesh);
    }
  }

  /** Lids for the rig's face, or null when it has none (a helmet, a visor). */
  static fit(rig: Rig): Eyelids | null {
    const geometry = rig.mesh.geometry;
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const surface = geometry.getAttribute('surface');
    const skinIndex = geometry.getAttribute('skinIndex');
    if (!color || !surface) return null;
    const toHead = new THREE.Matrix4().multiplyMatrices(rig.mesh.skeleton.boneInverses[BONE.head]!, rig.mesh.bindMatrix);
    const p = new THREE.Vector3();
    const whites: THREE.Vector3[][] = [[], []];
    for (let i = 0; i < position.count; i++) {
      if (skinIndex.getX(i) !== BONE.head) continue;
      const r = color.getX(i);
      const g = color.getY(i);
      const b = color.getZ(i);
      if (Math.min(r, g, b) < 0.45 || Math.max(r, g, b) - Math.min(r, g, b) > 0.16) continue;
      p.fromBufferAttribute(position, i).applyMatrix4(toHead);
      if (p.y < 0.035 || p.y > 0.12 || p.z > -0.06 || Math.abs(p.x) < 0.012 || Math.abs(p.x) > 0.09) continue;
      whites[p.x < 0 ? 0 : 1]!.push(p.clone());
    }
    if (whites.some((side) => side.length < 12)) return null;
    const eyes = whites.map((points): Eye => {
      const box = new THREE.Box3().setFromPoints(points);
      return {
        x: (box.min.x + box.max.x) / 2,
        y: (box.min.y + box.max.y) / 2,
        z: (box.min.z + box.max.z) / 2,
        halfWidth: (box.max.x - box.min.x) / 2 + 0.0035,
        halfHeight: (box.max.y - box.min.y) / 2 + 0.0025,
        front: new Float32Array(GRID * GRID).fill(Infinity)
      };
    });
    for (let i = 0; i < position.count; i++) {
      if (skinIndex.getX(i) !== BONE.head) continue;
      p.fromBufferAttribute(position, i).applyMatrix4(toHead);
      const eye = eyes[p.x < 0 ? 0 : 1]!;
      const [cx, cy] = cell(eye, p.x, p.y);
      if (cx < -1 || cy < -1 || cx > GRID || cy > GRID || p.z > eye.z + 0.003) continue;
      // Each vertex stands for the patch round it: it raises its own cell and the ones next to it.
      for (let j = Math.max(0, Math.floor(cy) - 1); j <= Math.min(GRID - 1, Math.floor(cy) + 1); j++) {
        for (let k = Math.max(0, Math.floor(cx) - 1); k <= Math.min(GRID - 1, Math.floor(cx) + 1); k++) {
          eye.front[j * GRID + k] = Math.min(eye.front[j * GRID + k]!, p.z);
        }
      }
    }
    for (const eye of eyes) {
      eye.front.forEach((z, i) => (eye.front[i] = Number.isFinite(z) ? z : eye.z));
      // Smoothed, the lid reads as one skin over the eyeball rather than taking the shape of the glint and the iris.
      for (let pass = 0; pass < 2; pass++) blur(eye.front);
    }
    // The face round each eye, shaded as it is baked: the colour and finish a shut lid takes on. Brows, lashes and the
    // eye whites are left out by their brightness.
    const tones: { lum: number; i: number }[] = [];
    for (let i = 0; i < position.count; i++) {
      if (skinIndex.getX(i) !== BONE.head) continue;
      p.fromBufferAttribute(position, i).applyMatrix4(toHead);
      const eye = eyes[p.x < 0 ? 0 : 1]!;
      const r = Math.hypot((p.x - eye.x) / eye.halfWidth, (p.y - eye.y) / eye.halfHeight);
      const lum = color.getX(i) + color.getY(i) + color.getZ(i);
      if (r < 1.1 || r > 1.6 || p.z > eye.z + 0.004 || lum < 0.25 || lum > 2.3) continue;
      tones.push({ lum, i });
    }
    if (tones.length < 3) return null;
    tones.sort((a, b) => a.lum - b.lum);
    const pick = tones[Math.floor(tones.length * 0.5)]!.i;
    const skin = new THREE.Color().fromBufferAttribute(color as THREE.BufferAttribute, pick);
    const finish = [surface.getX(pick), surface.getY(pick), surface.getZ(pick), 0];
    return new Eyelids(eyes, rig.bones[BONE.head]!, rig.mesh.material as THREE.Material, skin, finish);
  }

  /** 0 open, 1 shut. */
  set(shut: number) {
    if (shut === this.shut) return;
    this.shut = shut;
    for (const mesh of this.meshes) {
      mesh.visible = shut > 0.02;
      if (mesh.visible) shape(mesh.geometry, mesh.userData.eye as Eye, shut);
    }
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
  }
}

/** One pass of a 3 × 3 box blur over a GRID × GRID map. */
function blur(map: Float32Array) {
  const copy = map.slice();
  for (let j = 0; j < GRID; j++) {
    for (let k = 0; k < GRID; k++) {
      let sum = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let dk = -1; dk <= 1; dk++) {
          const y = j + dj;
          const x = k + dk;
          if (y < 0 || x < 0 || y >= GRID || x >= GRID) continue;
          sum += copy[y * GRID + x]!;
          n++;
        }
      }
      map[j * GRID + k] = sum / n;
    }
  }
}

/** Grid coordinates of a point over the eye's box (0…GRID-1 inside it). */
function cell(eye: Eye, x: number, y: number) {
  return [((x - eye.x) / eye.halfWidth / 2 + 0.5) * (GRID - 1), ((y - eye.y) / eye.halfHeight / 2 + 0.5) * (GRID - 1)] as const;
}

/** The face's frontmost depth over a point, smoothly between the grid's cells. */
function front(eye: Eye, x: number, y: number) {
  const [gx, gy] = cell(eye, x, y);
  const x0 = Math.max(0, Math.min(GRID - 2, Math.floor(gx)));
  const y0 = Math.max(0, Math.min(GRID - 2, Math.floor(gy)));
  const fx = Math.max(0, Math.min(1, gx - x0));
  const fy = Math.max(0, Math.min(1, gy - y0));
  const at = (i: number, j: number) => eye.front[(y0 + j) * GRID + x0 + i]!;
  return (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy;
}

/** Lays the lid over the eyeball from above its top down to `shut` of the way to its bottom, on a shell just clear of its front. */
function shape(geometry: THREE.BufferGeometry, eye: Eye, shut: number) {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const top = eye.y + eye.halfHeight;
  const edge = top - LASH * 1.3 - shut * (eye.halfHeight * 2 - LASH * 1.3);
  for (let row = 0; row <= ROWS; row++) {
    // Skin rows down to just above the lash line, then the lash line's two rows.
    const y = row === ROWS ? edge : row === ROWS - 1 ? edge + LASH : top + (edge + LASH * 1.3 - top) * (row / (ROWS - 2));
    const dy = (y - eye.y) / eye.halfHeight;
    const half = eye.halfWidth * Math.sqrt(Math.max(0, 1 - dy * dy)) + 0.0015;
    for (let col = 0; col < COLS; col++) {
      const u = (col / (COLS - 1)) * 2 - 1;
      const x = eye.x + u * half;
      // Just clear of whatever stands furthest out under it, tucking in behind the skin at the lid's rim.
      const rim = Math.min(1, u * u + Math.max(0, dy) ** 2);
      position.setXYZ(row * COLS + col, x, y, front(eye, x, y) - CLEAR * (1 - rim) + 0.0006 * rim);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}
