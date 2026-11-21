import * as THREE from 'three';
import type { Kit } from '../engine/kit';
import type { Vec3 } from './util';

/** Rib pitch of corrugated sheeting in meters. */
export const RIB_PITCH = 0.4;

const VERTEX_PARS = /* glsl */ `
attribute vec2 rib;
varying vec2 vRib;
varying vec3 vRibT;`;

const VERTEX = /* glsl */ `
vRib = rib;
vRibT = normalize(normalMatrix * vec3(-objectNormal.z, 0.0, objectNormal.x));`;

/**
 * Sine corrugation: the normal swings across each rib and crests catch a little more light. It fades to the flat
 * sheet while a rib is still several pixels wide, so a long wall seen edge-on shows no interference bands.
 */
const FRAGMENT = /* glsl */ `
float ribU = vRib.x / ${RIB_PITCH.toFixed(2)};
float ribK = vRib.y * (1.0 - smoothstep(0.06, 0.3, fwidth(ribU)));
float ribA = 6.2831853 * ribU;
normal = normalize(normal + normalize(vRibT) * (sin(ribA) * 0.55 * ribK));
diffuseColor.rgb *= 1.0 + 0.1 * ribK * cos(ribA);`;

/**
 * Corrugated metal boxes (warehouse sheeting) gathered into one mesh. Each box gets ribs on its two long vertical
 * faces, aligned in world space so neighbouring panels continue the same ribs.
 */
export class Siding {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private rib: number[] = [];

  /** Box from min to max; the bottom face is left out (sheeting always stands on something). */
  box(min: Vec3, max: Vec3, color: string) {
    const c = new THREE.Color(color);
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const alongX = x1 - x0 >= z1 - z0;
    const quad = (pts: Vec3[], n: Vec3, ribbed: boolean) => {
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const p = pts[i]!;
        this.pos.push(...p);
        this.nor.push(...n);
        this.col.push(c.r, c.g, c.b);
        this.rib.push(alongX ? p[0] : p[2], ribbed ? 1 : 0);
      }
    };
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], alongX);
    quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], alongX);
    quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], !alongX);
    quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], !alongX);
    quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], false);
  }

  build(kit: Kit): THREE.Mesh | null {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('rib', new THREE.Float32BufferAttribute(this.rib, 2));
    g.computeBoundingSphere();
    const p = kit.profile;
    // Low has no shadow maps, so the sun reaches inside faces too: a matte sheet keeps a metal highlight off them.
    const material = p.pbr
      ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6, envMapIntensity: 0.8 })
      : new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x101010, shininess: 8 });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${VERTEX}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRib;\nvarying vec3 vRibT;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAGMENT}`);
    };
    const mesh = new THREE.Mesh(g, material);
    mesh.name = 'siding';
    mesh.castShadow = p.shadows;
    mesh.receiveShadow = p.shadows;
    return mesh;
  }
}
