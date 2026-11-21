import * as THREE from 'three';

/** Direction toward the key light: high on the side the figure faces, so its near flank falls into shade for the rim to catch. */
export const KEY_DIRECTION = new THREE.Vector3(-0.56, 0.68, 0.47).normalize();

/**
 * The studio rig around a figure standing at the origin and facing the camera on +Z: a warm key, a cool rim
 * from behind its shaded side, a weaker kicker behind the lit side, a low fill, and a dim sky light.
 */
export const STUDIO_LIGHTS = {
  key: { color: '#fff0de', intensity: 2.7 },
  rim: { color: '#d3e2ff', intensity: 4.6, position: [2.1, 2.5, -4.6] },
  kicker: { color: '#c3cdff', intensity: 2.3, position: [-2.2, 1.7, -4.5] },
  fill: { color: '#d3dcf2', intensity: 0.5, position: [2.8, 0.9, 3.4] },
  sky: { color: '#b9c6e6', ground: '#75665a', intensity: 0.16 }
} as const;

/** One of the rig's lights, pointed at a figure's chest. */
export function aimed(spec: { color: string; intensity: number; position: readonly [number, number, number] }) {
  const light = new THREE.DirectionalLight(spec.color, spec.intensity);
  light.position.set(...spec.position);
  light.target.position.set(0, 1, 0);
  return light;
}

const ENV_FRAGMENT = /* glsl */ `
varying vec3 vDir;
// A soft-edged light card centered on direction c, its half-size as tangents; brighter toward its top.
float card( vec3 d, vec3 c, vec2 size, float feather ) {
  c = normalize( c );
  float facing = dot( d, c );
  if ( facing <= 0.0 ) return 0.0;
  vec3 r = normalize( cross( vec3( 0.0, 1.0, 0.0 ), c ) );
  vec2 p = vec2( dot( d, r ), dot( d, cross( c, r ) ) ) / facing;
  vec2 edge = smoothstep( size, size - feather, abs( p ) );
  return edge.x * edge.y * ( 0.78 + 0.22 * clamp( p.y / size.y, -1.0, 1.0 ) );
}
void main() {
  vec3 d = normalize( vDir );
  // Walls fall from a pale band at the horizon to a dark ceiling; the floor is a warm bounce, brightest near the horizon.
  vec3 col = d.y > 0.0
    ? mix( vec3( 0.34, 0.37, 0.44 ), vec3( 0.035, 0.04, 0.06 ), smoothstep( 0.0, 0.8, d.y ) )
    : mix( vec3( 0.46, 0.4, 0.35 ), vec3( 0.13, 0.115, 0.105 ), smoothstep( 0.0, -0.8, d.y ) );
  col += vec3( 0.95, 1.0, 1.1 ) * 1.5 * exp( -pow( ( d.y - 0.035 ) / 0.04, 2.0 ) );
  // Behind the lens the studio is dim, as a real one is behind the camera: a flat glossy face turned square to the lens
  // (a gun's side when the figure is turned round) mirrors this, and would wash out on the pale horizon band.
  col *= 1.0 - 0.62 * smoothstep( 0.5, 0.92, d.z );
  col += vec3( 1.0, 0.93, 0.83 ) * 3.4 * card( d, vec3( KEY ), vec2( 0.5, 0.5 ), 0.22 );
  col += vec3( 0.93, 0.96, 1.0 ) * 2.6 * card( d, vec3( 0.4, 1.0, -0.25 ), vec2( 0.75, 0.36 ), 0.2 );
  col += vec3( 0.78, 0.87, 1.0 ) * 9.0 * card( d, vec3( 0.42, 0.32, -0.85 ), vec2( 0.13, 0.85 ), 0.1 );
  col += vec3( 0.76, 0.8, 1.0 ) * 5.0 * card( d, vec3( -0.46, 0.26, -0.85 ), vec2( 0.11, 0.7 ), 0.09 );
  col += vec3( 0.86, 0.9, 1.0 ) * 1.1 * card( d, vec3( 0.74, 0.14, 0.64 ), vec2( 0.5, 0.42 ), 0.3 );
  col += vec3( 1.0, 0.72, 0.46 ) * 0.9 * card( d, vec3( -0.55, -0.3, 0.75 ), vec2( 0.6, 0.3 ), 0.28 );
  gl_FragColor = vec4( col, 1.0 );
}`;

/**
 * Reflections of a photo studio, drawn as one shaded sphere: a big warm softbox on the key side, a top light, cool
 * strips behind for edge highlights, a fill card and a warm floor bounce, on walls that grade from a bright horizon
 * to a dark ceiling. Polished metal mirrors all of it, so nothing here is black and the tints stay near neutral.
 */
export function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      defines: { KEY: KEY_DIRECTION.toArray().map((n) => n.toFixed(4)).join(', ') },
      vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: ENV_FRAGMENT
    })
  );
  scene.add(room);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  room.geometry.dispose();
  room.material.dispose();
  return target;
}

/** Wide soft pool under the figure: the ambient part of its shadow. */
export function blobTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.8)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
