import * as THREE from 'three';

export interface Atmosphere {
  zenith: string;
  horizon: string;
  ground: string;
  sunColor: string;
  sunIntensity: number;
  /** Direction the light travels from (points toward the sun). */
  sunDirection: THREE.Vector3;
  fogNear: number;
  /** Slab clouds circling the sky. */
  clouds?: { count: number; seed: number };
}

export const DEFAULT_ATMOSPHERE: Atmosphere = {
  zenith: '#5fa8f0',
  horizon: '#dbeaf4',
  ground: '#9c9688',
  sunColor: '#fff2dc',
  sunIntensity: 2.7,
  sunDirection: new THREE.Vector3(0.55, 0.78, 0.32).normalize(),
  fogNear: 70
};

const WHITE = new THREE.Color('#ffffff');

/**
 * Lights for the non-PBR tier, which has no sky reflections: a brighter,
 * less tinted ambient stands in for them so warm skies don't turn the map muddy.
 */
export function plainLights(a: Atmosphere) {
  return {
    sky: new THREE.Color(a.horizon).lerp(new THREE.Color(a.zenith), 0.5).lerp(WHITE, 0.35),
    ground: new THREE.Color(a.ground).lerp(WHITE, 0.25),
    sun: new THREE.Color(a.sunColor).lerp(WHITE, 0.3),
    hemi: 2.0,
    sunIntensity: a.sunIntensity
  };
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSun; uniform vec3 uSunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.62, h), 0.8));
  col = mix(col, uGround, smoothstep(0.0, -0.08, h));
  float s = max(dot(d, uSun), 0.0);
  col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.18 + pow(s, 4.0) * 0.06);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** Gradient sky dome with a sun disc, drawn behind everything at the camera's position. */
export function createSky() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uGround: { value: new THREE.Color() },
        uSun: { value: new THREE.Vector3() },
        uSunColor: { value: new THREE.Color() }
      }
    })
  );
}
