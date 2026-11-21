import * as THREE from 'three';

const FRAGMENT_PARS = /* glsl */ `
varying vec2 vFoam;
varying vec2 vFoamW;
uniform float uTime;
float foamHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float foamNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(foamHash(i), foamHash(i + vec2(1.0, 0.0)), f.x), mix(foamHash(i + vec2(0.0, 1.0)), foamHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

/**
 * A bright line hugging the contact, lace that thins out with distance from it, and a ring creeping outward and
 * fading. Partly self-lit so it stays white under a sunset sun.
 */
const FRAGMENT = /* glsl */ `
float foamD = clamp(vFoam.x, 0.0, 1.0);
float drift = foamNoise(vec2(vFoam.y * 0.6, uTime * 0.12));
// Seen edge-on far away the strip is a pixel or less across: the line keeps 1.5 px and dims instead of breaking into
// dashes, and the fine noise (a 0.1 m grain) settles to its mean once a pixel covers it.
float foamFw = max(fwidth(vFoam.x), 1e-4);
float foamGrain = smoothstep(0.03, 0.1, length(fwidth(vFoamW)));
float fine = mix(foamNoise(vFoamW * 4.5 + vec2(uTime * 0.21, -uTime * 0.15)) * 0.65 + foamNoise(vFoamW * 9.0 - vec2(uTime * 0.13, uTime * 0.27)) * 0.35, 0.5, foamGrain);
float lineW = 0.19 - 0.12 * drift;
float lineWpx = max(lineW, 1.5 * foamFw);
float line = (1.0 - smoothstep(lineWpx - 0.11 - foamFw, lineWpx + 0.11 + foamFw, foamD)) * (lineW / lineWpx) * (0.75 + 0.25 * fine);
float cut = 0.5 + 0.38 * foamD + 0.12 * drift;
float lace = smoothstep(cut, cut + 0.07, fine) * (1.0 - foamD);
float creep = fract(uTime * 0.08 + drift * 0.5);
float ringX = (foamD - creep) * 9.0;
float ring = exp(-ringX * ringX) * (1.0 - creep) * smoothstep(0.35, 0.55, fine);
diffuseColor.a *= clamp(max(line, max(lace * 0.85, ring * 0.7)), 0.0, 0.95);`;

/**
 * Foam lines where water meets pilings, quay walls, hulls and banks, as one translucent mesh lying just above the
 * water. Strips run along a contact with `foam.x` = 0 at the contact and 1 at the outer edge.
 */
export class Foam {
  private pos: number[] = [];
  private foam: number[] = [];

  /** Strip along the segment a→b on water level y, widening toward the side given by the outward normal (nx, nz). */
  edge(ax: number, az: number, bx: number, bz: number, y: number, nx: number, nz: number, width: number) {
    const len = Math.hypot(bx - ax, bz - az);
    const quad: [number, number, number, number][] = [
      [ax, az, 0, 0],
      [bx, bz, 0, len],
      [bx + nx * width, bz + nz * width, 1, len],
      [ax + nx * width, az + nz * width, 1, 0]
    ];
    // Wound counter-clockwise seen from above, so the strip faces up and takes the sun.
    const up = (bx - ax) * nz - (bz - az) * nx < 0;
    for (const i of up ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) {
      const [x, z, d, u] = quad[i]!;
      this.pos.push(x, y + 0.012, z);
      this.foam.push(d, u + ax * 0.37 + az * 0.61);
    }
  }

  /** Ring around a round post of radius r standing in the water. */
  ring(x: number, z: number, y: number, r: number, width: number, segments = 10) {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      this.edge(x + Math.cos(a0) * r, z + Math.sin(a0) * r, x + Math.cos(a1) * r, z + Math.sin(a1) * r, y, Math.cos(am), Math.sin(am), width);
    }
  }

  /** Around a closed outline (any winding) of a hull or pier block standing in the water. */
  outline(points: [number, number][], y: number, width: number) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const [ax, az] = points[i]!;
      const [bx, bz] = points[(i + 1) % points.length]!;
      area += ax * bz - bx * az;
    }
    const s = area > 0 ? 1 : -1;
    for (let i = 0; i < points.length; i++) {
      const [ax, az] = points[i]!;
      const [bx, bz] = points[(i + 1) % points.length]!;
      const len = Math.hypot(bx - ax, bz - az) || 1;
      this.edge(ax, az, bx, bz, y, (s * (bz - az)) / len, (-s * (bx - ax)) / len, width);
    }
  }

  build() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(this.pos.length / 3).fill([0, 1, 0]).flat(), 3));
    g.setAttribute('foam', new THREE.Float32BufferAttribute(this.foam, 2));
    g.computeBoundingSphere();
    const time = { value: 0 };
    const material = new THREE.MeshLambertMaterial({ color: '#f6f5f0', emissive: '#6d6d6a', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 foam;\nvarying vec2 vFoam;\nvarying vec2 vFoamW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoam = foam;\nvFoamW = (modelMatrix * vec4(position, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
        .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>\n${FRAGMENT}`);
    };
    const mesh = new THREE.Mesh(g, material);
    mesh.name = 'foam';
    mesh.renderOrder = 1;
    return {
      mesh,
      update: (t: number) => (time.value = t),
      dispose() {
        g.dispose();
        material.dispose();
      }
    };
  }
}
