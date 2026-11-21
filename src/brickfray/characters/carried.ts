import * as THREE from 'three';
import type { Kit } from '../engine/kit';
import { createWeaponModel } from '../weapons/model';
import type { Carried, MagazineState } from './actions';
import { SOCKET_L } from './upper';

type Item = Exclude<Carried, 'none'> | 'grenade';

const shapes = new Map<string, THREE.BufferGeometry>();

/** A cylinder along the hand's -Z, `from`…`to` meters ahead of the palm point. */
function rod(key: string, radius: number, from: number, to: number, segments: number, tip = radius) {
  let g = shapes.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(tip, radius, to - from, segments);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -(from + to) / 2);
    shapes.set(key, g);
  }
  return g;
}

function build(item: Item, kit: Kit): THREE.Object3D {
  const group = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, color: string, finish: 'plastic' | 'metal') => {
    const mesh = new THREE.Mesh(geometry, kit.materials.get(color, finish));
    mesh.castShadow = kit.profile.shadows;
    group.add(mesh);
  };
  const seg = kit.profile.detail === 0 ? 6 : 10;
  switch (item) {
    // Props are drawn a little larger than life so a reload reads at fighting distance.
    case 'shell':
      add(rod(`shell:${seg}`, 0.021, -0.03, 0.07, seg), '#e0412a', 'plastic');
      add(rod(`shellBase:${seg}`, 0.0225, -0.052, -0.03, seg), '#e2b048', 'metal');
      break;
    case 'rounds':
      add(rod(`rounds:${seg}`, 0.033, -0.026, 0.016, seg), '#e2b048', 'metal');
      add(rod(`roundsHub:${seg}`, 0.014, -0.05, -0.026, seg), '#3d444c', 'metal');
      break;
    case 'bolt':
      add(rod('boltShaft', 0.0095, -0.2, 0.3, 6), '#d3d8dc', 'metal');
      add(rod('boltHead', 0.024, 0.3, 0.4, 6, 0.001), '#e0a53e', 'metal');
      add(rod('boltFletch', 0.022, -0.24, -0.16, 4, 0.006), '#d8452e', 'plastic');
      break;
    case 'grenade': {
      const model = createWeaponModel('grenade', kit, 'third').root;
      model.traverse((o) => (o.castShadow = kit.profile.shadows));
      model.scale.setScalar(1.3);
      model.position.y = 0.02;
      group.add(model);
      break;
    }
  }
  group.position.copy(SOCKET_L);
  group.name = `carried:${item}`;
  return group;
}

/** A magazine in the hand is drawn larger than the one in the gun, so the change reads at fighting distance. */
const HELD_MAGAZINE = 1.3;
const m = new THREE.Matrix4();
const inverse = new THREE.Matrix4();
const one = new THREE.Vector3(1, 1, 1);
const scale = new THREE.Vector3();

/**
 * What a character's left hand carries: a shell, a ring of rounds or a spear on the way to the gun,
 * a live grenade, and during a magazine change the gun's own magazine, lifted out of the model.
 */
export class HandProps {
  private readonly items = new Map<Item, THREE.Object3D>();
  private shown: Item | null = null;
  private weapon: THREE.Object3D | null = null;
  private magazine: THREE.Object3D | null = null;
  private readonly seat = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  /** The magazine relative to the point the hand holds it by. */
  private readonly grip = new THREE.Matrix4();

  constructor(
    private readonly kit: Kit,
    private readonly hand: THREE.Object3D
  ) {}

  setWeapon(weapon: THREE.Object3D | null) {
    this.seatMagazine();
    this.weapon = weapon;
    this.magazine = weapon?.getObjectByName('magazine') ?? null;
    if (!this.magazine) return;
    this.seat.position.copy(this.magazine.position);
    this.seat.quaternion.copy(this.magazine.quaternion);
    const hold = this.magazine.getObjectByName('magHold');
    if (hold) {
      hold.updateMatrix();
      this.grip.copy(hold.matrix).invert();
    } else this.grip.identity();
  }

  /** Call with world matrices current. */
  update(item: Carried, magazine: MagazineState, grenade: number) {
    const want: Item | null = grenade > 0.02 ? 'grenade' : item === 'none' ? null : item;
    if (want !== this.shown) {
      if (this.shown) this.items.get(this.shown)!.visible = false;
      this.shown = want;
      if (want) this.show(want).visible = true;
    }
    if (want === 'grenade') this.items.get(want)!.scale.setScalar(grenade);
    const mag = this.magazine;
    if (!mag || !this.weapon) return;
    mag.visible = magazine !== 'away';
    if (magazine !== 'hand') {
      mag.position.copy(this.seat.position);
      mag.quaternion.copy(this.seat.quaternion);
      mag.scale.copy(one);
      return;
    }
    m.makeTranslation(SOCKET_L).premultiply(this.hand.matrixWorld).multiply(this.grip);
    m.premultiply(inverse.copy(mag.parent!.matrixWorld).invert());
    m.decompose(mag.position, mag.quaternion, scale);
    mag.scale.setScalar(HELD_MAGAZINE);
  }

  private show(item: Item) {
    let o = this.items.get(item);
    if (!o) {
      o = build(item, this.kit);
      this.items.set(item, o);
      this.hand.add(o);
    }
    return o;
  }

  private seatMagazine() {
    if (!this.magazine) return;
    this.magazine.visible = true;
    this.magazine.position.copy(this.seat.position);
    this.magazine.quaternion.copy(this.seat.quaternion);
    this.magazine.scale.copy(one);
  }

  dispose() {
    this.seatMagazine();
    for (const o of this.items.values()) o.removeFromParent();
    this.items.clear();
  }
}
