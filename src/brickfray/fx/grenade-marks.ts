import * as THREE from 'three';

/** Billboards face the camera; flat marks lie in the plane of their normal (a ring on the floor or a wall). */
export type MarkShape = 'glow' | 'bulb' | 'ring' | 'star';
const SHAPES: Record<MarkShape, number> = { glow: 0, bulb: 1, ring: 2, star: 3 };

export interface MarkLook {
  shape: MarkShape;
  /** Size in meters, held between `minPx` and `maxPx` on screen (CSS pixels) so it reads far off and never swamps the view up close. */
  size: number;
  minPx: number;
  maxPx: number;
  color: THREE.Color;
  alpha: number;
  /** 0 adds light, 1 covers what is behind (a saturated colour still reads on a pale floor). */
  cover: number;
  /** Ring width as a share of the radius. */
  width?: number;
  /** Lie flat with this normal instead of facing the camera. */
  normal?: THREE.Vector3;
}

const QUADS = 96;
const TRAIL_POINTS = 160;

const QUAD_VERTEX = /* glsl */ `
uniform vec2 uViewport;
attribute vec3 aCenter;
attribute vec2 aCorner;
attribute vec4 aNormal;
attribute vec3 aSize;
attribute vec4 aColor;
attribute vec3 aShape;
varying vec2 vLocal;
varying vec4 vColor;
varying vec3 vShape;
void main() {
  vec4 center = viewMatrix * vec4(aCenter, 1.0);
  float dist = max(-center.z, 1e-3);
  float pxPerMeter = projectionMatrix[1][1] * uViewport.y * 0.5 / dist;
  float px = clamp(aSize.x * pxPerMeter, aSize.y, aSize.z);
  float size = px / pxPerMeter;
  vLocal = aCorner;
  vColor = aColor;
  vShape = aShape;
  // A glow seen up close, far above its minimum size, thins out so it lights the bomb instead of hiding it.
  if (aShape.x < 0.5 && aSize.y > 0.0) vColor.a *= clamp(1.4 * aSize.y / px, 0.45, 1.0);
  if (aNormal.w < 0.5) {
    // Nothing flares in the thrower's face as the bomb leaves the hand.
    vColor.a *= smoothstep(0.6, 1.8, dist);
    // Slide toward the camera (shrunk to keep its size on screen) so a glow on the floor isn't cut in half by it.
    float pull = min(size * 0.5, max(dist - 0.3, 0.0) * 0.5);
    float k = (dist - pull) / dist;
    gl_Position = projectionMatrix * vec4(center.xyz * k + vec3(aCorner * size * 0.5 * k, 0.0), 1.0);
  } else {
    vec3 n = normalize(aNormal.xyz);
    vec3 t = normalize(abs(n.y) > 0.9 ? cross(n, vec3(1.0, 0.0, 0.0)) : cross(n, vec3(0.0, 1.0, 0.0)));
    vec3 b = cross(n, t);
    vec3 world = aCenter + n * 0.025 + (t * aCorner.x + b * aCorner.y) * size * 0.5;
    // Drawn a little nearer than it lies (same place on screen), so studs and pebbles on the floor don't cut it up.
    vec4 view = viewMatrix * vec4(world, 1.0);
    float d = max(-view.z, 1e-3);
    view.xyz *= (d - min(0.15, d * 0.1)) / d;
    gl_Position = projectionMatrix * view;
  }
}`;

const QUAD_FRAGMENT = /* glsl */ `
varying vec2 vLocal;
varying vec4 vColor;
varying vec3 vShape;
void main() {
  float r = length(vLocal);
  if (r > 1.0) discard;
  float shape = vShape.x;
  vec3 col = vColor.rgb;
  float a;
  if (shape < 0.5) {
    float f = 1.0 - r * r;
    a = f * f;
  } else if (shape < 1.5) {
    // A bulb: white-hot middle as bright as it is lit (vShape.z), coloured body, a dark rim so it holds on pale ground.
    a = smoothstep(1.0, 0.9, r);
    col = mix(mix(col, vec3(1.0, 0.97, 0.9), vShape.z), col, smoothstep(0.12, 0.62, r));
    col = mix(col, col * 0.3, smoothstep(0.72, 0.9, r));
  } else if (shape < 2.5) {
    float w = vShape.z;
    a = 1.0 - smoothstep(w * 0.35, w * 0.5, abs(r - (1.0 - w * 0.5)));
  } else {
    float ang = atan(vLocal.y, vLocal.x);
    float petals = 0.35 + 0.65 * pow(abs(cos(ang * 2.0)), 6.0);
    a = smoothstep(petals, petals * 0.3, r) + smoothstep(0.3, 0.0, r);
    a = min(a, 1.0);
    col = mix(vec3(1.0), col, smoothstep(0.1, 0.6, r));
  }
  a *= vColor.a;
  gl_FragColor = vec4(col * a, a * vShape.y);
  #include <colorspace_fragment>
}`;

const TRAIL_VERTEX = /* glsl */ `
uniform vec2 uViewport;
attribute vec3 aPoint;
attribute vec3 aToward;
attribute vec4 aWidth;
attribute vec4 aColor;
varying vec4 vColor;
varying float vSide;
void main() {
  vec4 p = projectionMatrix * viewMatrix * vec4(aPoint, 1.0);
  vec4 q = projectionMatrix * viewMatrix * vec4(aToward, 1.0);
  vColor = aColor;
  vColor.a *= smoothstep(0.6, 1.8, p.w);
  vSide = aWidth.w;
  if (p.w < 0.05 || q.w < 0.05) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec2 halfView = uViewport * 0.5;
  vec2 d = q.xy / q.w * halfView - p.xy / p.w * halfView;
  float len = length(d);
  d = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  float pxPerMeter = projectionMatrix[1][1] * halfView.y / p.w;
  float w = clamp(aWidth.x * pxPerMeter, aWidth.y, aWidth.z);
  p.xy += vec2(-d.y, d.x) * aWidth.w * w * 0.5 / halfView * p.w;
  gl_Position = p;
}`;

const TRAIL_FRAGMENT = /* glsl */ `
varying vec4 vColor;
varying float vSide;
void main() {
  float a = vColor.a * smoothstep(1.0, 0.45, abs(vSide));
  gl_FragColor = vec4(vColor.rgb * a, a * 0.75);
  #include <colorspace_fragment>
}`;

const premultiplied = {
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  toneMapped: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor
} as const;

/**
 * Marks drawn fresh every frame (begin, add, end): camera-facing or flat quads, and trails as screen-space ribbons, each
 * held to a minimum size on screen. Positions live in their own attributes and `position` stays zero, so a pass that
 * swaps the material (ambient occlusion) draws nothing for them.
 */
export class MarkBatch {
  readonly group = new THREE.Group();
  private readonly viewport = { value: new THREE.Vector2(1, 1) };
  private readonly quads: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly trails: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private quadCount = 0;
  private pointCount = 0;
  private trailIndex = 0;
  private readonly q: Record<'center' | 'normal' | 'size' | 'color' | 'shape', THREE.BufferAttribute>;
  private readonly t: Record<'point' | 'toward' | 'width' | 'color', THREE.BufferAttribute>;
  private readonly trailIndices: Uint16Array;

  /** Drawn in `order` among transparent things; without `depthTest` (glare whose source was checked to be in sight) nothing hides it. */
  constructor(name: string, order: number, depthTest = true) {
    const quad = new THREE.BufferGeometry();
    quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array(QUADS * 4 * 3), 3));
    const corners = new Float32Array(QUADS * 8);
    const index = new Uint16Array(QUADS * 6);
    for (let i = 0; i < QUADS; i++) {
      corners.set([-1, -1, 1, -1, 1, 1, -1, 1], i * 8);
      index.set([0, 1, 2, 0, 2, 3].map((k) => k + i * 4), i * 6);
    }
    quad.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
    quad.setIndex(new THREE.BufferAttribute(index, 1));
    this.q = {
      center: dynamic(quad, 'aCenter', QUADS * 4, 3),
      normal: dynamic(quad, 'aNormal', QUADS * 4, 4),
      size: dynamic(quad, 'aSize', QUADS * 4, 3),
      color: dynamic(quad, 'aColor', QUADS * 4, 4),
      shape: dynamic(quad, 'aShape', QUADS * 4, 3)
    };
    const uniforms = { uViewport: this.viewport };
    this.quads = new THREE.Mesh(quad, new THREE.ShaderMaterial({ vertexShader: QUAD_VERTEX, fragmentShader: QUAD_FRAGMENT, uniforms, ...premultiplied, depthTest }));

    const trail = new THREE.BufferGeometry();
    trail.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 2 * 3), 3));
    this.t = {
      point: dynamic(trail, 'aPoint', TRAIL_POINTS * 2, 3),
      toward: dynamic(trail, 'aToward', TRAIL_POINTS * 2, 3),
      width: dynamic(trail, 'aWidth', TRAIL_POINTS * 2, 4),
      color: dynamic(trail, 'aColor', TRAIL_POINTS * 2, 4)
    };
    this.trailIndices = new Uint16Array(TRAIL_POINTS * 6);
    trail.setIndex(new THREE.BufferAttribute(this.trailIndices, 1).setUsage(THREE.DynamicDrawUsage));
    this.trails = new THREE.Mesh(trail, new THREE.ShaderMaterial({ vertexShader: TRAIL_VERTEX, fragmentShader: TRAIL_FRAGMENT, uniforms, ...premultiplied }));

    for (const mesh of [this.trails, this.quads]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      mesh.onBeforeRender = (renderer) => renderer.getSize(this.viewport.value);
      this.group.add(mesh);
    }
    this.group.name = name;
  }

  begin() {
    this.quadCount = 0;
    this.pointCount = 0;
    this.trailIndex = 0;
  }

  add(at: THREE.Vector3, look: MarkLook) {
    if (this.quadCount >= QUADS || look.alpha <= 0.003) return;
    const n = look.normal;
    const c = look.color;
    for (let k = 0; k < 4; k++) {
      const i = this.quadCount * 4 + k;
      this.q.center.setXYZ(i, at.x, at.y, at.z);
      this.q.normal.setXYZW(i, n?.x ?? 0, n?.y ?? 1, n?.z ?? 0, n ? 1 : 0);
      this.q.size.setXYZ(i, look.size, look.minPx, look.maxPx);
      this.q.color.setXYZW(i, c.r, c.g, c.b, look.alpha);
      this.q.shape.setXYZ(i, SHAPES[look.shape], look.cover, look.width ?? 0.2);
    }
    this.quadCount++;
  }

  /**
   * A ribbon through `points` (newest first): `width` meters at the head tapering to nothing, at least `minPx` wide at
   * the head, `color` fading out toward the tail.
   */
  trail(points: readonly THREE.Vector3[], width: number, minPx: number, color: THREE.Color, alpha: number) {
    const count = Math.min(points.length, TRAIL_POINTS - this.pointCount);
    if (count < 2 || alpha <= 0.003) return;
    const base = this.pointCount;
    for (let k = 0; k < count; k++) {
      const p = points[k]!;
      const towardTail = k < count - 1;
      const o = towardTail ? points[k + 1]! : points[k - 1]!;
      const u = k / (count - 1);
      const fade = (1 - u) ** 1.4;
      for (const side of [-1, 1]) {
        const i = (base + k) * 2 + (side > 0 ? 1 : 0);
        this.t.point.setXYZ(i, p.x, p.y, p.z);
        // Toward the next point down the tail; the last point looks back and flips its side to keep the same edge.
        this.t.toward.setXYZ(i, o.x, o.y, o.z);
        this.t.width.setXYZW(i, width * (1 - u * 0.85), minPx * (1 - u * 0.6), 64, towardTail ? side : -side);
        this.t.color.setXYZW(i, color.r, color.g, color.b, alpha * fade);
      }
      if (k > 0) {
        const a = (base + k - 1) * 2;
        const b = (base + k) * 2;
        this.trailIndices.set([a, a + 1, b + 1, a, b + 1, b], this.trailIndex);
        this.trailIndex += 6;
      }
    }
    this.pointCount += count;
  }

  end() {
    for (const attr of Object.values(this.q)) mark(attr, this.quadCount * 4);
    for (const attr of Object.values(this.t)) mark(attr, this.pointCount * 2);
    this.quads.geometry.setDrawRange(0, this.quadCount * 6);
    this.trails.geometry.setDrawRange(0, this.trailIndex);
    if (this.trailIndex > 0) {
      const index = this.trails.geometry.index!;
      index.clearUpdateRanges();
      index.addUpdateRange(0, this.trailIndex);
      index.needsUpdate = true;
    }
    this.quads.visible = this.quadCount > 0;
    this.trails.visible = this.trailIndex > 0;
  }

  dispose() {
    for (const mesh of [this.quads, this.trails]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

function dynamic(geometry: THREE.BufferGeometry, name: string, count: number, size: number) {
  const attr = new THREE.BufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute(name, attr);
  return attr;
}

function mark(attr: THREE.BufferAttribute, count: number) {
  if (count === 0) return;
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count * attr.itemSize);
  attr.needsUpdate = true;
}
