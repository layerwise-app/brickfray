import * as THREE from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// FXAA after Jasper Flick's port (three's FXAAShader), reading the linear scene and tone mapping on the way out.
const FRAGMENT = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uExposure;
varying vec2 vUv;

vec3 neutral(vec3 color) {
  const float start = 0.8 - 0.04;
  const float desaturation = 0.15;
  color *= uExposure;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < start) return color;
  float d = 1.0 - start;
  float newPeak = 1.0 - d * d / (peak + d - start);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, pow(c, vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c));
}
// Perceptual enough for edge finding; the tone curve is near identity below 0.76.
float luma(vec2 uv) {
  return sqrt(dot(min(texture2D(tScene, uv).rgb * uExposure, 1.0), vec3(0.299, 0.587, 0.114)));
}

const int STEPS = 6;
const float EDGE_GUESS = 8.0;

void main() {
  vec2 uv = vUv;
  vec2 t = uTexel;
  float m = luma(uv);
  float n = luma(uv + vec2(0.0, t.y));
  float e = luma(uv + vec2(t.x, 0.0));
  float s = luma(uv - vec2(0.0, t.y));
  float w = luma(uv - vec2(t.x, 0.0));
  float hi = max(max(max(max(n, e), s), w), m);
  float lo = min(min(min(min(n, e), s), w), m);
  float contrast = hi - lo;
  if (contrast < max(0.0312, 0.063 * hi)) {
    gl_FragColor = vec4(encode(neutral(texture2D(tScene, uv).rgb)), 1.0);
    return;
  }
  float ne = luma(uv + t);
  float nw = luma(uv + vec2(-t.x, t.y));
  float se = luma(uv + vec2(t.x, -t.y));
  float sw = luma(uv - t);

  float f = (2.0 * (n + e + s + w) + ne + nw + se + sw) / 12.0;
  f = clamp(abs(f - m) / contrast, 0.0, 1.0);
  float pixelBlend = smoothstep(0.0, 1.0, f);
  pixelBlend *= pixelBlend;

  float horizontal = abs(n + s - 2.0 * m) * 2.0 + abs(ne + se - 2.0 * e) + abs(nw + sw - 2.0 * w);
  float vertical = abs(e + w - 2.0 * m) * 2.0 + abs(ne + nw - 2.0 * n) + abs(se + sw - 2.0 * s);
  bool isH = horizontal >= vertical;
  float pL = isH ? n : e;
  float nL = isH ? s : w;
  float pG = abs(pL - m);
  float nG = abs(nL - m);
  float pixelStep = isH ? t.y : t.x;
  float opposite = pL;
  float gradient = pG;
  if (pG < nG) {
    pixelStep = -pixelStep;
    opposite = nL;
    gradient = nG;
  }

  vec2 uvEdge = uv;
  vec2 edgeStep;
  if (isH) {
    uvEdge.y += pixelStep * 0.5;
    edgeStep = vec2(t.x, 0.0);
  } else {
    uvEdge.x += pixelStep * 0.5;
    edgeStep = vec2(0.0, t.y);
  }
  float edgeL = (m + opposite) * 0.5;
  float threshold = gradient * 0.25;
  float stepLen[6] = float[6](1.0, 1.5, 2.0, 2.0, 2.0, 4.0);

  vec2 puv = uvEdge + edgeStep;
  float pDelta = luma(puv) - edgeL;
  bool pEnd = abs(pDelta) >= threshold;
  for (int i = 1; i < STEPS && !pEnd; i++) {
    puv += edgeStep * stepLen[i];
    pDelta = luma(puv) - edgeL;
    pEnd = abs(pDelta) >= threshold;
  }
  if (!pEnd) puv += edgeStep * EDGE_GUESS;

  vec2 nuv = uvEdge - edgeStep;
  float nDelta = luma(nuv) - edgeL;
  bool nEnd = abs(nDelta) >= threshold;
  for (int i = 1; i < STEPS && !nEnd; i++) {
    nuv -= edgeStep * stepLen[i];
    nDelta = luma(nuv) - edgeL;
    nEnd = abs(nDelta) >= threshold;
  }
  if (!nEnd) nuv -= edgeStep * EDGE_GUESS;

  float pDist = isH ? puv.x - uv.x : puv.y - uv.y;
  float nDist = isH ? uv.x - nuv.x : uv.y - nuv.y;
  float shortest = min(pDist, nDist);
  bool deltaSign = pDist <= nDist ? pDelta >= 0.0 : nDelta >= 0.0;
  float edgeBlend = deltaSign == (m - edgeL >= 0.0) ? 0.0 : 0.5 - shortest / (pDist + nDist);

  float blend = max(pixelBlend, edgeBlend);
  if (isH) uv.y += pixelStep * blend;
  else uv.x += pixelStep * blend;
  gl_FragColor = vec4(encode(neutral(texture2D(tScene, uv).rgb)), 1.0);
}`;

/**
 * Anti-aliasing for the tier that can't afford multisampling: the frame renders into a single-sample linear target
 * at full resolution, then one full-screen pass tone maps it onto the canvas with FXAA.
 */
export class PostAA {
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly size = new THREE.Vector2();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { tScene: { value: null }, uTexel: { value: new THREE.Vector2() }, uExposure: { value: 1 } },
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      })
    );
    this.quad.frustumCulled = false;
  }

  /** The target to draw the frame into, sized to the canvas. */
  begin(renderer: THREE.WebGLRenderer) {
    renderer.getDrawingBufferSize(this.size);
    const { x, y } = this.size;
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(x, y, { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    } else if (this.target.width !== x || this.target.height !== y) {
      this.target.setSize(x, y);
    }
    renderer.setRenderTarget(this.target);
    return this.target;
  }

  /** Tone maps and anti-aliases the target onto the canvas. */
  end(renderer: THREE.WebGLRenderer) {
    const u = this.quad.material.uniforms;
    u.tScene!.value = this.target!.texture;
    u.uTexel!.value.set(1 / this.target!.width, 1 / this.target!.height);
    u.uExposure!.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(null);
    renderer.render(this.quad, this.camera);
  }

  dispose() {
    this.target?.dispose();
    this.target = null;
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
