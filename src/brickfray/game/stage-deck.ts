import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The round tile on top of the stand that the figure stands on, and its thickness. */
export const TILE_RADIUS = 0.5;
export const TILE_HEIGHT = 0.022;
/** Rings of studs left bare round the tile, on the deck. */
const STUD_RINGS = [0.548, 0.596];
const STUD = { radius: 0.0165, height: 0.012, pitch: 0.05 };
/** The baseplate floor round the stand: its stud pitch and how far out it is studded. */
const FLOOR = { pitch: 0.12, radius: 0.036, height: 0.026, from: 0.76, to: 2.5 };
const KEY = new THREE.Vector3(-0.5, 0.72, 0.48).normalize();
/** The tile's and its studs' own grey, and how far each takes on the studio's ring colour. */
const TILE = { color: '#2c3446', tint: 0.17 };
const STUDS = { color: '#283041', tint: 0.1 };

/** A stud standing on the origin: open side and top cap, unindexed, position and normal only. */
function stud(radius: number, height: number, segments: number) {
  const side = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true).toNonIndexed();
  side.translate(0, height / 2, 0);
  const cap = new THREE.CircleGeometry(radius, segments).toNonIndexed();
  cap.rotateX(-Math.PI / 2);
  cap.translate(0, height, 0);
  for (const g of [side, cap]) g.deleteAttribute('uv');
  return mergeGeometries([side, cap])!;
}

/** One quarter of the tile's outer band, or (with `start` < 0) its round centre piece, with softly rounded top edges. */
function tilePiece(inner: number, outer: number, start: number, gap: number) {
  const bevel = 0.004;
  const shape = new THREE.Shape();
  if (start < 0) shape.absarc(0, 0, outer - bevel, 0, Math.PI * 2, false);
  else {
    const a0 = start + gap / outer;
    const a1 = start + Math.PI / 2 - gap / outer;
    const b0 = start + gap / inner;
    const b1 = start + Math.PI / 2 - gap / inner;
    shape.absarc(0, 0, outer - bevel, a0, a1, false);
    shape.absarc(0, 0, inner + bevel, b1, b0, true);
    shape.closePath();
  }
  const piece = new THREE.ExtrudeGeometry(shape, { depth: TILE_HEIGHT - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 28 });
  piece.rotateX(-Math.PI / 2);
  piece.translate(0, bevel, 0);
  piece.deleteAttribute('uv');
  return piece.index ? piece.toNonIndexed() : piece;
}

/**
 * The stand's brick top and the studded floor round it. The top, a round tile made of four quarters round a centre
 * piece and ringed by bare studs, turns with the figure as a turntable does, so the feet never slide over it. The
 * floor's studs take the floor's own colour, brighter in the ring's light near the stand, and fade into it outward.
 */
export class StageDeck {
  /** Turn this with the figure. */
  readonly top = new THREE.Group();
  readonly floor: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly tile: THREE.MeshStandardMaterial;
  private readonly studs: THREE.MeshStandardMaterial;
  private readonly owned: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  private readonly radii: number[] = [];

  /** `deck` is the height of the stand's deck the tile and studs sit on. */
  constructor(deck: number) {
    const tile = (this.tile = new THREE.MeshStandardMaterial({ color: TILE.color, roughness: 0.4, metalness: 0.12, envMapIntensity: 0.5 }));
    const pieces = [tilePiece(0, 0.15, -1, 0), ...[0, 1, 2, 3].map((i) => tilePiece(0.155, TILE_RADIUS, (i * Math.PI) / 2 + Math.PI / 4, 0.0025))];
    const tiles = new THREE.Mesh(mergeGeometries(pieces)!, tile);
    for (const p of pieces) p.dispose();
    tiles.position.y = deck;
    tiles.receiveShadow = true;
    tiles.castShadow = true;

    const one = stud(STUD.radius, STUD.height, 12);
    const placed: THREE.BufferGeometry[] = [];
    for (const r of STUD_RINGS) {
      const count = Math.round((Math.PI * 2 * r) / STUD.pitch);
      for (let i = 0; i < count; i++) {
        const a = ((i + (r === STUD_RINGS[0] ? 0 : 0.5)) / count) * Math.PI * 2;
        placed.push(one.clone().translate(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
    }
    this.studs = new THREE.MeshStandardMaterial({ color: STUDS.color, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.45 });
    const studs = new THREE.Mesh(mergeGeometries(placed)!, this.studs);
    for (const p of placed) p.dispose();
    one.dispose();
    studs.position.y = deck;
    studs.receiveShadow = true;
    this.top.add(tiles, studs);
    this.owned.push({ geometry: tiles.geometry, material: tile }, { geometry: studs.geometry, material: studs.material });

    // The floor's studs are shaded once, by their own normals, and coloured per stud by where they stand.
    const floorStud = stud(FLOOR.radius, FLOOR.height, 10);
    const normal = floorStud.getAttribute('normal');
    const shade = new Float32Array(normal.count * 3);
    const n = new THREE.Vector3();
    for (let i = 0; i < normal.count; i++) {
      n.fromBufferAttribute(normal, i);
      shade.fill(n.y > 0.5 ? 1.22 : 0.62 + 0.45 * Math.max(0, n.dot(KEY)), i * 3, i * 3 + 3);
    }
    floorStud.setAttribute('color', new THREE.BufferAttribute(shade, 3));
    const cells: [number, number][] = [];
    const span = Math.ceil(FLOOR.to / FLOOR.pitch);
    for (let i = -span; i <= span; i++) {
      for (let j = -span; j <= span; j++) {
        const x = (i + 0.5) * FLOOR.pitch;
        const z = (j + 0.5) * FLOOR.pitch;
        const r = Math.hypot(x, z);
        if (r >= FLOOR.from && r <= FLOOR.to) cells.push([x, z]);
      }
    }
    this.floor = new THREE.InstancedMesh(floorStud, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), cells.length);
    const m = new THREE.Matrix4();
    cells.forEach(([x, z], i) => {
      const r = Math.hypot(x, z);
      // Toward the edge of the studded patch the studs sink and shrink into the floor.
      const s = Math.max(0.05, 1 - THREE.MathUtils.smoothstep(r, FLOOR.to - 0.7, FLOOR.to));
      this.floor.setMatrixAt(i, m.makeScale(s, s, s).setPosition(x, 0, z));
      this.radii.push(r);
    });
    this.floor.frustumCulled = false;
    this.owned.push({ geometry: floorStud, material: this.floor.material });
  }

  /**
   * Colours the deck for a studio: the tile and its studs tinted toward the ring's colour, and the floor's studs in the
   * floor colour, lifted near the stand and by the ring's light at its foot.
   */
  setColors(floor: THREE.ColorRepresentation, ring: THREE.ColorRepresentation, base: number) {
    const f = new THREE.Color(floor);
    const glow = new THREE.Color(ring);
    this.tile.color.set(TILE.color).lerp(glow, TILE.tint);
    this.studs.color.set(STUDS.color).lerp(glow, STUDS.tint);
    const c = new THREE.Color();
    const lift = new THREE.Color();
    this.radii.forEach((r, i) => {
      const out = Math.max(0, r - base);
      c.copy(f).multiplyScalar((0.72 + 0.75 * Math.exp((-r * r) / 5)) * (1 - 0.55 * Math.exp(-out * 7)));
      c.add(lift.copy(glow).multiplyScalar(0.25 * Math.exp(-out * 3.2)));
      this.floor.setColorAt(i, c);
    });
    this.floor.instanceColor!.needsUpdate = true;
  }

  dispose() {
    for (const { geometry, material } of this.owned) {
      geometry.dispose();
      material.dispose();
    }
  }
}
