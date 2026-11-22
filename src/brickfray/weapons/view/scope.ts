import * as THREE from 'three';
import type { WeaponId } from '../defs';

/** Guns whose aimed picture is the scope itself: the gun is put away and the lens fills the eye. */
const SCOPED: ReadonlySet<WeaponId> = new Set(['sniper']);
/** Aim blend at which the eye is at the eyepiece (the sim's `ads`; the HUD and touch layer key off the same value). */
export const SCOPE_IN = 0.85;
/** Lens radius in half screen heights: once the eye is in, and as the gun's own eyepiece looks at the switch. */
const LENS = 0.72;
const EYEPIECE = 0.38;
/** Aim blend over which the lens grows from the eyepiece to the full picture. */
const OPEN = 0.13;
/** How far the lens picture is carried by the gun's turn (half heights per radian) and its push back (per meter). */
const SWING = 0.9;
const PUSH = 0.7;
/** Seconds a shot's flash and its smoke last in the lens. */
const FLASH = 0.05;
const SMOKE = 0.7;

const VERTEX = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
varying vec2 vNdc;
uniform float uAspect;
uniform float uRadius;
uniform vec2 uLens;
uniform float uSurround;
uniform float uOpen;
uniform float uKick;
uniform float uFlash;
uniform float uSmoke;
uniform float uTime;

vec4 acc;
void layer(vec3 c, float a) {
  a = clamp(a, 0.0, 1.0);
  acc = vec4(c * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a));
}
float band(float d, float w, float px) {
  return 1.0 - smoothstep(w * 0.5 - px * 0.6, w * 0.5 + px * 0.6, d);
}

void main() {
  acc = vec4(0.0);
  vec2 p = vec2(vNdc.x * uAspect, vNdc.y);
  float px = max(fwidth(p.y), 1e-4);
  vec2 q = p - uLens;
  float r = length(q);
  float R = uRadius;
  float inside = 1.0 - smoothstep(R - px, R + px, r);
  vec2 dir = q / max(r, 1e-4);
  float lit = 0.5 + 0.5 * dot(dir, normalize(vec2(-0.55, 0.85)));

  // The lens: a faint cool cast, the coating's sheen, the scope shadow closing in from the rim (deeper on a kick), a
  // thin colour fringe right at the rim, the shot's flash and its smoke drifting up.
  float edge = r / R;
  layer(vec3(0.7, 0.9, 1.0), 0.055 * inside);
  vec2 g = (q - R * vec2(-0.42, 0.5)) / (R * vec2(0.55, 0.32));
  layer(vec3(0.62, 0.5, 1.0), 0.07 * exp(-dot(g, g)) * inside);
  float shadow = smoothstep(0.66 - 0.24 * uKick, 1.0, edge);
  layer(vec3(0.0), (shadow * shadow * 0.92 + 0.12 * edge * edge) * inside);
  float fringe = exp(-pow((edge - 0.985) / 0.009, 2.0));
  layer(mix(vec3(0.9, 0.45, 0.1), vec3(0.15, 0.4, 0.9), smoothstep(0.975, 0.995, edge)), 0.1 * fringe * inside);
  // The flash: a white-hot core low in the glass, where the muzzle is under the line of sight, throwing short spikes up
  // and out, with a warm bloom round it; the rest of the picture stays clear and the reticle is drawn over it.
  vec2 m = (q - vec2(0.0, -0.8 * R)) / R;
  float core = exp(-dot(m, m) / 0.035);
  float spikes = pow(abs(cos(atan(m.x, m.y) * 3.5)), 10.0) * exp(-length(m) / 0.38) * step(-0.1, m.y);
  float bloom = exp(-dot(m, m) / 0.5);
  float hot = min(1.0, core * 1.5 + spikes);
  layer(mix(vec3(1.0, 0.58, 0.2), vec3(1.0, 0.96, 0.86), hot), uFlash * min(1.0, hot + bloom * 0.32) * inside);
  float curl = 0.5 + 0.5 * sin(q.x * 11.0 / R + uTime * 1.7 + 2.0 * sin(q.y * 7.0 / R - uTime * 2.3));
  layer(vec3(0.6, 0.6, 0.58), uSmoke * 0.22 * curl * smoothstep(0.9, -0.9, q.y / R + (1.0 - uSmoke) * 0.8) * inside);

  // Reticle at the screen centre, where the shot goes: a duplex cross with mil dots and a lit centre dot.
  vec2 a = abs(p);
  float thin = 1.3 * px;
  float post = 4.0 * px;
  float reach = 0.4 * R;
  float cross = band(a.y, thin, px) * step(a.x, reach) + band(a.x, thin, px) * step(a.y, reach);
  float taper = smoothstep(reach - 0.002, reach + 0.03, max(a.x, a.y));
  cross += band(a.y, mix(thin, post, taper), px) * step(reach, a.x) + band(a.x, mix(thin, post, taper), px) * step(reach, a.y);
  for (int i = 1; i <= 5; i++) {
    float m = float(i) * 0.07 * R;
    cross += 1.0 - smoothstep(1.5 * px, 2.4 * px, min(length(p - vec2(m, 0.0)), min(length(p + vec2(m, 0.0)), min(length(p - vec2(0.0, m)), length(p + vec2(0.0, m))))));
  }
  layer(vec3(0.02, 0.02, 0.025), 0.92 * min(1.0, cross) * inside);
  float lamp = 1.0 - smoothstep(1.6 * px, 2.6 * px, length(p));
  layer(vec3(1.0, 0.18, 0.08), (lamp + 0.25 * exp(-dot(p, p) / (36.0 * px * px))) * inside);

  // Beyond the lens: the dark of the eyecup, the eyepiece's metal lip catching the light just outside the glass.
  float out_ = 1.0 - inside;
  float lip = exp(-pow((r - R - 2.5 * px) / (2.0 * px), 2.0));
  // As the eye closes on the eyepiece the dark spreads out from it: the world at the edges goes last.
  float spread = 1.0 - (1.0 - uOpen) * 0.7 * smoothstep(R + 0.05, R + 0.75, r);
  layer(vec3(0.0012, 0.0013, 0.0016) + vec3(0.03, 0.032, 0.035) * lip * (0.2 + 0.8 * lit), uSurround * spread * out_);
  // Blended like any transparent surface: the straight colour goes through the output encoding, then is weighed.
  gl_FragColor = vec4(acc.a > 0.0 ? acc.rgb / acc.a : vec3(0.0), acc.a);
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;
}`;

/**
 * The scope's picture, drawn in the view layer on the same frame the gun is put away: the lens grows from the eyepiece
 * as the eye closes on it, the scope shadow and the lens drift with the gun's sway and kick, and a shot flashes and
 * smokes in the glass. The reticle stays on the screen centre, where the shot goes.
 */
export class ScopeOverlay {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private sinceShot = Infinity;
  private time = 0;
  /** Whether the scope picture is up this frame (the gun and hands are hidden for it). */
  up = false;

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera
  ) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uAspect: { value: 1 },
        uRadius: { value: LENS },
        uLens: { value: new THREE.Vector2() },
        uSurround: { value: 1 },
        uOpen: { value: 1 },
        uKick: { value: 0 },
        uFlash: { value: 0 },
        uSmoke: { value: 0 },
        uTime: { value: 0 }
      },
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** A shot through the scope. */
  fire() {
    if (this.up) this.sinceShot = 0;
  }

  /** `ads` is the sim's aim blend; `turn` and `push` are the gun's procedural turn (rad) and its back travel (m). */
  update(dt: number, gun: WeaponId, ads: number, turn: THREE.Vector3, push: number) {
    this.up = SCOPED.has(gun) && ads > SCOPE_IN;
    this.mesh.visible = this.up;
    this.time += dt;
    this.sinceShot += dt;
    if (!this.up) return;
    const u = this.material.uniforms;
    const open = THREE.MathUtils.smoothstep(ads, SCOPE_IN, SCOPE_IN + OPEN);
    const fit = Math.min(1, this.camera.aspect);
    u.uAspect!.value = this.camera.aspect;
    u.uRadius!.value = (EYEPIECE + (LENS - EYEPIECE) * open) * fit * (1 - Math.min(0.08, Math.max(0, push) * PUSH));
    (u.uLens!.value as THREE.Vector2).set(-turn.y * SWING, -turn.x * SWING).clampLength(0, 0.2);
    u.uSurround!.value = 0.985;
    u.uOpen!.value = open;
    u.uKick!.value = Math.min(1, (Math.abs(turn.x) + Math.abs(turn.y)) * 6);
    u.uFlash!.value = this.sinceShot < FLASH ? (1 - this.sinceShot / FLASH) ** 2 : 0;
    u.uSmoke!.value = this.sinceShot < SMOKE ? Math.sin((Math.PI * this.sinceShot) / SMOKE) ** 0.6 * (1 - this.sinceShot / SMOKE) : 0;
    u.uTime!.value = this.time;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
