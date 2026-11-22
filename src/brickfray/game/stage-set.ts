import * as THREE from 'three';
import type { CharacterId } from '../characters/types';
import { roundedCylinder } from '../engine/geometry';
import { StageDeck, TILE_HEIGHT } from './stage-deck';
import { StageProps } from './stage-props';

/** The deck the figure stands on, and the foot under it that carries the light ring. */
export const STAND_RADIUS = 0.62;
export const BASE_RADIUS = 0.69;
const FOOT = 0.058;
const RING = 0.024;
const DECK = 0.078;
/** Height of the top of the tile the figure stands on above the floor. */
export const STAND_TOP = FOOT + RING + DECK + TILE_HEIGHT;

/**
 * A character's studio: the light ring's color, the wall's pool of light behind the figure, the wall at eye level
 * and in the corners, and the floor near the stand. The pool is the wall's own hue, brighter: mixing two hues there
 * goes muddy.
 */
interface Palette {
  ring: string;
  glow: string;
  wall: string;
  top: string;
  floor: string;
}

const PALETTES: Record<CharacterId, Palette> = {
  rivet: { ring: '#ff9a2e', glow: '#3f86ee', wall: '#1d3a7c', top: '#060b1d', floor: '#0e1830' },
  vega: { ring: '#27d3c8', glow: '#8a5ce6', wall: '#3a2a80', top: '#0a071e', floor: '#15102f' },
  clack: { ring: '#ff4a3c', glow: '#5b74ee', wall: '#252f7e', top: '#07091f', floor: '#10142f' },
  coral: { ring: '#ff7d6b', glow: '#22a9bd', wall: '#0e4c62', top: '#03111b', floor: '#08202c' },
  moss: { ring: '#86cc52', glow: '#ee8f3e', wall: '#7c3423', top: '#150809', floor: '#1d0e12' },
  nova: { ring: '#9d70ff', glow: '#5a4fe2', wall: '#1c1c5c', top: '#04040f', floor: '#0b0b22' }
};

const WALL_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;
}`;
/**
 * Wall and floor in one seamless sweep, drawn from the view direction alone. Everything is measured in meters on
 * the upright plane through the stand that faces the lens, so the picture around the figure is the same at every
 * screen size and lens distance: a pool of light behind the chest with faint rays, dark corners, and a floor that
 * curves up into the wall instead of ending at a horizon. Noise finer than one 8-bit step keeps the gradients
 * from banding.
 */
const WALL_FRAGMENT = /* glsl */ `
uniform vec3 uTop; uniform vec3 uWall; uniform vec3 uGlow; uniform vec3 uFloor; uniform vec3 uRing; uniform vec3 uEye;
uniform float uGain; uniform float uTime;
varying vec3 vDir;
const float CHEST = ${(STAND_TOP + 1.25).toFixed(3)};
const float BASE = ${BASE_RADIUS.toFixed(3)};

vec3 wall( vec2 p ) {
  vec3 col = mix( uWall, uTop, smoothstep( 0.0, 2.8, p.y - uEye.y ) );
  vec2 c = p - vec2( 0.0, CHEST );
  vec2 q = c / vec2( 1.3, 1.15 );
  float pool = exp( -dot( q, q ) );
  float rays = smoothstep( -0.5, 0.5, sin( atan( c.y, c.x ) * 12.0 + uTime * 0.04 ) );
  float reach = length( c );
  pool += ( rays - 0.5 ) * 0.09 * smoothstep( 0.4, 1.3, reach ) * exp( -reach * reach / 7.0 );
  return mix( col, uGlow, clamp( pool * 0.74 * uGain, 0.0, 1.0 ) );
}

void main() {
  vec3 d = normalize( vDir );
  float lens = length( uEye.xz );
  vec2 toward = -uEye.xz / lens;
  float t = lens / max( dot( d.xz, toward ), 0.001 );
  vec2 p = vec2( dot( d.xz, vec2( -toward.y, toward.x ) ) * t, uEye.y + d.y * t );
  vec3 col;
  if ( d.y >= 0.0 ) {
    col = wall( p );
  } else {
    vec2 g = uEye.xz + d.xz * ( uEye.y / -d.y );
    float r = length( g );
    float out_ = max( r - BASE, 0.0 );
    vec3 floor_ = uFloor * ( 0.72 + 0.75 * exp( -r * r / 5.0 ) );
    floor_ *= 1.0 - 0.55 * exp( -out_ * 7.0 );
    floor_ += uRing * ( 0.42 * exp( -out_ * 3.2 ) + 0.5 * exp( -out_ * 12.0 ) ) * smoothstep( -0.04, 0.03, r - BASE );
    // 1 at the stand's own depth and nearer, 0 where the floor has finished curving up into the wall.
    float near = clamp( ( uEye.y - p.y ) / uEye.y, 0.0, 1.0 );
    col = mix( wall( vec2( p.x, uEye.y ) ), floor_, smoothstep( 0.0, 0.5, near ) );
  }
  vec2 v = ( p - vec2( 0.0, CHEST - 0.15 ) ) * vec2( 0.78, 0.8 );
  col = mix( col, uTop * 0.7, 0.82 * smoothstep( 0.85, 2.7, length( v ) ) );
  gl_FragColor = vec4( col, 1.0 );
  #include <colorspace_fragment>
  gl_FragColor.rgb += ( fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5 ) / 255.0;
}`;

/** Lens distance the far props were laid out for; they are stretched in depth to look the same from any other. */
const DESIGN_DISTANCE = 6.5;

const RING_VERTEX = /* glsl */ `
varying float vT;
void main() {
  vT = position.y / ${RING.toFixed(3)};
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
/** The light ring as a diffuser lit from inside: hottest, nearly white, along its middle and dimming toward both edges. */
const RING_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vT;
void main() {
  float c = 1.0 - abs( vT * 2.0 - 1.0 );
  float core = c * c * ( 3.0 - 2.0 * c );
  gl_FragColor = vec4( mix( uColor, vec3( 1.0 ), 0.4 * pow( core, 5.0 ) ) * ( 0.5 + 0.7 * core ), 1.0 );
  #include <colorspace_fragment>
}`;

/** The glow's reach above and below the ring, in meters. */
const HALO = 0.075;
const HALO_VERTEX = /* glsl */ `
varying float vY;
varying float vFacing;
void main() {
  vY = position.y / ${HALO.toFixed(3)};
  vec4 view = modelViewMatrix * vec4( position, 1.0 );
  vFacing = abs( dot( normalize( normalMatrix * normal ), normalize( -view.xyz ) ) );
  gl_Position = projectionMatrix * view;
}`;
/**
 * The ring's light in the air round it, added over the foot and the deck: falling off away from the ring, and
 * strongest where the lens looks along the shell at the stand's sides, as a glow thickens toward a lamp's outline.
 */
const HALO_FRAGMENT = /* glsl */ `
uniform vec3 uColor; uniform float uGain;
varying float vY;
varying float vFacing;
void main() {
  float fall = exp( -abs( vY ) * ( vY < 0.0 ? 6.5 : 4.2 ) ) * ( 1.0 - smoothstep( 0.75, 1.0, abs( vY ) ) );
  // The shell itself has no thickness: at its very outline the glow fades out instead of drawing a line.
  float glow = fall * ( 0.45 + 0.55 * pow( 1.0 - vFacing, 2.0 ) ) * smoothstep( 0.03, 0.3, vFacing ) * uGain;
  gl_FragColor = vec4( uColor * glow, 1.0 );
  #include <colorspace_fragment>
}`;

/**
 * Everything on the menu's stage but the figure: a low round stand with a ring of light in the character's color,
 * a seamless studio wall and floor, and soft toy shapes far behind that set the character's scene.
 */
export class StageSet {
  readonly group = new THREE.Group();
  private readonly ring = new THREE.ShaderMaterial({ vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, uniforms: { uColor: { value: new THREE.Color() } } });
  private readonly halo = new THREE.ShaderMaterial({
    vertexShader: HALO_VERTEX,
    fragmentShader: HALO_FRAGMENT,
    uniforms: { uColor: { value: new THREE.Color() }, uGain: { value: 1 } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  private readonly wall: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly props = new StageProps();
  private readonly deck = new StageDeck(FOOT + RING + DECK);
  private readonly fog = new THREE.Fog('#000000', 10, 60);
  private readonly ringColor = new THREE.Color();
  private readonly owned: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];

  constructor() {
    const part = (radius: number, height: number, y: number, edge: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(roundedCylinder(radius, height, 72, edge), material);
      mesh.position.y = y;
      mesh.receiveShadow = true;
      this.owned.push({ geometry: mesh.geometry, material });
      this.group.add(mesh);
      return mesh;
    };
    // Satin, not glossy: at the lens's grazing angle a glossy deck mirrors the bright wall and turns into a grey puck.
    part(BASE_RADIUS, FOOT, 0, 0.012, new THREE.MeshStandardMaterial({ color: '#10141d', roughness: 0.42, metalness: 0.35, envMapIntensity: 0.55 }));
    part(BASE_RADIUS - 0.022, RING, FOOT, 0, this.ring).receiveShadow = false;
    part(STAND_RADIUS, DECK, FOOT + RING, 0.014, new THREE.MeshStandardMaterial({ color: '#2a3243', roughness: 0.56, metalness: 0.2, envMapIntensity: 0.45 }));
    const shell = new THREE.CylinderGeometry(BASE_RADIUS + 0.004, BASE_RADIUS + 0.004, HALO * 2, 96, 1, true);
    const halo = new THREE.Mesh(shell, this.halo);
    halo.position.y = FOOT + RING / 2;
    halo.renderOrder = 1;
    this.owned.push({ geometry: shell, material: this.halo });
    this.group.add(halo);

    this.wall = new THREE.Mesh(
      new THREE.SphereGeometry(200, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: WALL_VERTEX,
        fragmentShader: WALL_FRAGMENT,
        uniforms: {
          uTop: { value: new THREE.Color() },
          uWall: { value: new THREE.Color() },
          uGlow: { value: new THREE.Color() },
          uFloor: { value: new THREE.Color() },
          uRing: { value: new THREE.Color() },
          uEye: { value: new THREE.Vector3() },
          uGain: { value: 1 },
          uTime: { value: 0 }
        }
      })
    );
    this.wall.frustumCulled = false;
    this.wall.renderOrder = -10;
    this.group.add(this.wall, this.props.group, this.deck.top, this.deck.floor);
  }

  /** The haze the far props fade into; set it as the scene's fog. */
  get haze() {
    return this.fog;
  }

  /** Builds `id`'s far set ahead of its first pick. */
  prebuild(id: CharacterId) {
    this.props.prebuild(id);
  }

  setCharacter(id: CharacterId) {
    const palette = PALETTES[id];
    const u = this.wall.material.uniforms;
    u.uTop!.value.set(palette.top);
    u.uWall!.value.set(palette.wall);
    u.uGlow!.value.set(palette.glow);
    u.uFloor!.value.set(palette.floor);
    this.ringColor.set(palette.ring);
    this.fog.color.set(palette.wall);
    this.props.show(id, palette);
    this.deck.setColors(palette.floor, palette.ring, BASE_RADIUS);
  }

  /**
   * Follows the lens; `pulse` is the reveal's flash, 1 fading to 0, `left` and `right` where the screen's edges fall
   * in meters across the stand, and `turn` the figure's, which the stand's top turns with.
   */
  update(camera: THREE.PerspectiveCamera, time: number, pulse: number, left: number, right: number, turn: number) {
    this.deck.top.rotation.y = turn;
    const u = this.wall.material.uniforms;
    const lit = pulse ** 2;
    this.ring.uniforms.uColor!.value.copy(this.ringColor).multiplyScalar(0.95 + lit * 1.5);
    this.halo.uniforms.uColor!.value.copy(this.ringColor);
    this.halo.uniforms.uGain!.value = 0.55 + lit * 0.9;
    u.uRing!.value.copy(this.ringColor).multiplyScalar(0.6 + lit * 0.5);
    u.uGain!.value = 1 + lit * 0.35;
    u.uTime!.value = time;
    u.uEye!.value.copy(camera.position);
    this.wall.position.copy(camera.position);
    const distance = Math.hypot(camera.position.x, camera.position.z);
    const stretch = distance / DESIGN_DISTANCE;
    this.props.group.scale.z = stretch;
    this.props.fit(left, right, camera.position, stretch);
    this.fog.near = distance + 4 * stretch;
    this.fog.far = distance + 75 * stretch;
  }

  dispose() {
    for (const { geometry, material } of this.owned) {
      geometry.dispose();
      material.dispose();
    }
    this.wall.geometry.dispose();
    this.wall.material.dispose();
    this.props.dispose();
    this.deck.dispose();
  }
}
