// ============================ map: Desk Top ============================
// You are an eraser tall on a school desk, high above the classroom floor. There are no walls:
// step off the edge and the fall kills you (and doodles knocked off die too); the doodles
// climb up over the edges. A mug of coffee stands in the middle with a ruler propped against it, a pencil
// case is the one enclosed room, a pile of textbooks steps up to the highest perch, and two
// pencils laid end to end bridge the whole desk. A desk lamp arches over the north-west corner
// with rings and a swinging yo-yo to hook. The keyboard to the south is a field of low cover.
import * as THREE from 'three';
import { INK } from '../../render/ink-renderer';
import { rand } from '../../core/math';
import type { Level, LevelBuilder } from '../level';

const vecs = (points: readonly (readonly [number, number, number])[]): THREE.Vector3[] =>
  points.map(([x, y, z]) => new THREE.Vector3(x, y, z));

export function buildDesk(B: LevelBuilder): Level {
  const { L, box, slab, wallX, wallZ, stairs, cyl, sphere, ring, spawn, sniper, pickup, planes, addGeo, collider, scene, inkMesh, breakable } = B;
  const { BLUE: BL, RED: RD, BLACK: BK, ORANGE: OR, GREEN: GR, PINK: PK } = INK;
  L.key = 'desk';
  L.playerStart.set(0, 0, 20);
  // the desk is wider than it is deep; there is nothing at its edges, step off and you fall to the classroom floor
  const DX = 60;
  const DZ = 47;
  L.bounds = { minX: -DX, maxX: DX, minZ: -DZ, maxZ: DZ };
  L.fallKills = true;
  const FLOOR = -44;
  const NG = { noNav: true, noGrapple: true };
  const deco = { noCollide: true };

  // ---------------- the desk: a wooden top on four metal legs ----------------
  box(0, -1.6, 0, 2 * DX, 1.6, 2 * DZ, { ink: OR });
  // wood grain on top, a dark edge band all the way round
  for (let i = 0; i < 30; i++) {
    const z = rand(-DZ + 3, DZ - 3);
    const len = rand(10, 34);
    const x = rand(-DX + 3 + len / 2, DX - 3 - len / 2);
    box(x, 0, z, len, 0.02, 0.12, { ...deco, ink: BK });
  }
  box(0, -0.9, -DZ, 2 * DX + 0.1, 0.12, 0.1, { ...deco, ink: BK });
  box(0, -0.9, DZ, 2 * DX + 0.1, 0.12, 0.1, { ...deco, ink: BK });
  box(-DX, -0.9, 0, 0.1, 0.12, 2 * DZ + 0.1, { ...deco, ink: BK });
  box(DX, -0.9, 0, 0.1, 0.12, 2 * DZ + 0.1, { ...deco, ink: BK });
  // the apron under the top, a drawer at the front, legs down to the floor and a footrest bar
  box(0, -6, 0, 2 * DX - 8, 4.4, 2 * DZ - 8, { ...deco, ink: BL });
  box(0, -5.4, DZ - 4, 30, 3.2, 0.3, { ...deco, ink: BL });
  box(0, -4, DZ - 3.8, 5, 0.6, 0.4, { ...deco, ink: BK });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(sx * (DX - 5), FLOOR, sz * (DZ - 5), 2.4, -1.6 - FLOOR, 2.4, { ...deco, ink: BK });
    box(sx * (DX - 5), FLOOR + 8, 0, 1.2, 1.2, 2 * DZ - 10, { ...deco, ink: BK });
  }
  box(0, FLOOR + 8, -(DZ - 5), 2 * DX - 10, 1.2, 1.2, { ...deco, ink: BK });
  // invisible lid so nobody leaves through the sky
  collider(0, 46, 0, 2 * DX + 60, 6, 2 * DZ + 60, NG);
  // the doodles climb up over the edges of the desk
  for (const c of [-36, 0, 36]) {
    spawn(c, 0, -DZ + 2);
    spawn(c, 0, DZ - 2);
  }
  for (const c of [-24, 0, 24]) {
    spawn(-DX + 2, 0, c);
    spawn(DX - 2, 0, c);
  }
  // little doodled hands gripping the edge where they come up
  for (const c of [-36, 0, 36]) {
    for (const sz of [-1, 1]) for (const dx of [-0.9, 0.9]) sphere(c + dx, 0.05, sz * (DZ - 0.2), 0.35, { ink: BK });
  }

  // ---------------- the mug, and the ruler propped up against it ----------------
  {
    const mx = 0;
    const mz = -16;
    cyl(mx, 0, mz, 4.5, 10, { seg: 20 });
    addGeo(new THREE.TorusGeometry(4.35, 0.25, 6, 28).rotateX(Math.PI / 2).translate(mx, 10, mz), BL);
    addGeo(new THREE.CylinderGeometry(4.1, 4.1, 0.08, 24).translate(mx, 9.7, mz), BK);
    // steam
    for (let i = 0; i < 3; i++) {
      addGeo(new THREE.TorusGeometry(0.8 + i * 0.2, 0.08, 4, 12, Math.PI).translate(mx - 1 + i, 12 + i * 1.6, mz), BK);
    }
    addGeo(new THREE.TorusGeometry(2.2, 0.45, 8, 16).translate(mx + 5.4, 5, mz), BL);
    collider(mx + 5.8, 2.8, mz, 1.2, 4.4, 0.9, { noNav: true });
    // a heart doodled on the side
    sphere(mx - 0.6, 6, mz + 4.5, 0.6, { ink: RD });
    sphere(mx + 0.6, 6, mz + 4.5, 0.6, { ink: RD });
    // ruler wedge up to the rim (35 steps of 10 / 35 over 13.5)
    stairs(mx - 17, 0, mz, '+x', 35, 2.4, { rise: 10 / 35, run: 0.385, ink: OR });
    for (let i = 0; i < 14; i++) box(mx - 16.6 + i, 0.3 + i * 0.74, mz + 1.2, 0.06, 0.3, 0.05, { noCollide: true, ink: BK });
    ring(mx, 17, mz, 'y');
    sniper(mx, 10, mz);
    pickup(mx + 1.5, 10, mz + 1);
    spawn(mx - 12, 0, mz + 4);
  }

  // ---------------- the pencil case: the one room on the desk, with a zip along the lid ----------------
  {
    const x1 = -44;
    const x2 = -30;
    const z1 = -8;
    const z2 = 16;
    const H = 5.6;
    const o = { ink: GR };
    wallX(x1, x2, z1, 0, H, 0.4, [[-39, -35, 0, 3.2]], o);
    wallX(x1, x2, z2, 0, H, 0.4, [[-39, -35, 0, 3.2]], o);
    wallZ(z1, z2, x1, 0, H, 0.4, [[-2, 2, 1.5, 3.5], [8, 12, 1.5, 3.5]], o);
    wallZ(z1, z2, x2, 0, H, 0.4, [[0, 4, 0, 3.2], [-6, -3, 1.5, 3.5]], o);
    slab(x1, z1, x2, z2, H + 0.4, 0.4, o);
    // zip
    for (let z = z1 + 0.5; z < z2; z += 0.7) box(-37, H + 0.4, z, 0.5, 0.06, 0.25, { noCollide: true, ink: BK });
    box(-37, H + 0.4, z2 - 1.2, 0.6, 0.35, 1.2, { noCollide: true, ink: BK });
    // pencils lying inside, and a sharpener
    const pencil = (x: number, z1p: number, z2p: number): void => {
      const len = z2p - z1p;
      addGeo(new THREE.CylinderGeometry(0.55, 0.55, len, 6).rotateX(Math.PI / 2).translate(x, 0.55, (z1p + z2p) / 2), OR);
      addGeo(new THREE.ConeGeometry(0.55, 1.6, 6).rotateX(Math.PI / 2).translate(x, 0.55, z2p + 0.8), BK);
      collider(x, 0, (z1p + z2p) / 2 + 0.4, 1.1, 1.1, len + 1.6);
    };
    pencil(-42, -4, 8);
    pencil(-40.6, 0, 11);
    box(-32, 0, -5, 1.6, 1.4, 1.6, { ink: BL });
    // outside stairs up the east side to the lid
    stairs(-28.8, 0, 15, '-z', 21, 2, { rise: 6 / 21, run: 0.45, ink: GR });
    spawn(-37, 0, 12);
    sniper(-37, 6, -6);
    pickup(-37, 0, 4);
    pickup(-37, 6, 10);
  }

  // ---------------- the textbook pile: three books stepping up to the highest perch ----------------
  {
    box(35, 0, -5, 18, 3, 18, { ink: BL });
    box(36, 3, -8, 14, 3, 10, { ink: GR });
    box(35, 6, -10.25, 10, 3, 5.5, { ink: OR });
    // page edges
    for (const [x, y, z, w] of [[26, 1.5, -5, 17], [29, 4.5, -8, 9], [30, 7.5, -10.25, 4.5]] as const) {
      for (const dy of [-0.7, 0, 0.7]) box(x - 0.02, y + dy, z, 0.05, 0.05, w, { noCollide: true, ink: BK });
    }
    stairs(30, 0, 8.4, '-z', 11, 2.2, { rise: 3 / 11, run: 0.4, ink: PK });
    stairs(38, 3, 1.4, '-z', 11, 2.2, { rise: 3 / 11, run: 0.4, ink: PK });
    stairs(33, 6, -3.1, '-z', 11, 2.2, { rise: 3 / 11, run: 0.4, ink: PK });
    ring(35, 15, -10, 'y');
    // two books standing on end, cover beside the pile
    box(22, 0, 14, 1.2, 8, 6, { ink: PK });
    box(22, 0, -22, 1.2, 8, 6, { ink: RD });
    spawn(27.5, 3, -12);
    spawn(42, 0, 8);
    sniper(35, 9, -10);
    pickup(40, 3, 2);
    pickup(37, 9, -9);
  }

  // ---------------- the pencil bridge: two pencils end to end across the desk at y = 6 ----------------
  {
    const xa = -31;
    const xb = 28;
    const z = -5;
    const y = 6;
    for (const dz of [-0.7, 0.7]) {
      addGeo(new THREE.CylinderGeometry(0.7, 0.7, xb - xa, 6).rotateZ(Math.PI / 2).translate((xa + xb) / 2, y - 0.7, z + dz), OR);
      addGeo(new THREE.ConeGeometry(0.7, 2, 6).rotateZ(-Math.PI / 2).translate(xb + 1, y - 0.7, z + dz), BK);
      addGeo(new THREE.CylinderGeometry(0.72, 0.72, 1.4, 8).rotateZ(Math.PI / 2).translate(xa + 0.7, y - 0.7, z + dz), PK);
    }
    collider((-30 + 29) / 2, y - 0.6, z, 59, 0.6, 2.8);
    // held up by two pencils standing on end
    for (const x of [-12, 12]) {
      cyl(x, 0, z, 0.5, y - 1.4, { seg: 6, ink: OR, noNav: true });
      addGeo(new THREE.ConeGeometry(0.5, 1.2, 6).rotateX(Math.PI).translate(x, y - 0.8, z), BK);
    }
    sniper(0, y, z);
    pickup(-18, y, z);
    pickup(18, y, z);
  }

  // ---------------- the keyboard: rows of keys, low cover to weave between ----------------
  {
    box(0, 0, 34, 40, 0.5, 13, { ink: BK });
    const rows = [29.5, 32.5, 35.5];
    rows.forEach((z, r) => {
      for (let x = -18.4 + r * 0.8; x <= 18.4; x += 3.2) {
        box(x, 0.5, z, 2.2, 1.0, 2.2, { ink: BL });
        box(x - 0.3, 1.5, z - 0.3, 0.5, 0.02, 0.08, { noCollide: true, ink: BK });
      }
    });
    box(0, 0.5, 38.6, 14, 1.0, 2.2, { ink: BL });
    for (const x of [-15.6, -11.2, 11.2, 15.6]) box(x, 0.5, 38.6, 2.8, 1.0, 2.2, { ink: BL });
    pickup(0, 1.5, 38.6);
    spawn(-14, 0, 24);
  }

  // ---------------- the desk lamp: an arm over the north-west corner, rings and a yo-yo to swing from ----------------
  {
    cyl(-40, 0, -40, 3.5, 1, { seg: 18, ink: BK });
    box(-40, 1, -40, 0.9, 23, 0.9, { ink: BK });
    box(-28, 23.5, -40, 25, 0.9, 0.9, { ink: BK });
    addGeo(new THREE.ConeGeometry(3, 3.5, 14, 1, true).translate(-15, 21.8, -40), BK);
    collider(-15, 20, -40, 3.6, 3.6, 3.6, { noNav: true });
    sphere(-15, 19.8, -40, 1, { ink: OR });
    // the lamp's light on the desk
    addGeo(new THREE.TorusGeometry(5, 0.12, 4, 32).rotateX(Math.PI / 2).translate(-15, 0.03, -40), OR);
    ring(-33, 21.5, -40);
    ring(-24, 21.5, -40);
    // a yo-yo hung from the arm, swinging north and south; hook it and ride the swing
    const pivot = new THREE.Vector3(-22, 23.4, -40);
    const len = 11;
    const yoyo = inkMesh(new THREE.SphereGeometry(1.1, 12, 8).scale(0.6, 1, 1), PK);
    const string = inkMesh(new THREE.BoxGeometry(0.06, len, 0.06).translate(0, -len / 2, 0), BK);
    string.position.copy(pivot);
    scene.add(yoyo, string);
    L.meshes.push(yoyo, string);
    L.grappleMovers.push({ mesh: yoyo, radius: 1.6 });
    L.animated.push({
      mesh: yoyo,
      update: (t) => {
        const a = Math.sin(t * 1.1) * 0.75;
        string.rotation.x = a;
        yoyo.position.set(pivot.x, pivot.y - Math.cos(a) * len, pivot.z + Math.sin(a) * len);
        yoyo.rotation.x = a;
      },
    });
    spawn(-34, 0, -34);
  }

  // ---------------- the stapler (north-east) and the odds and ends of a desk ----------------
  {
    box(36, 0, -40, 14, 1.2, 4.5, { ink: BK });
    box(43, 1.2, -40, 2, 1.6, 4.5, { ink: BK });
    box(36.5, 2.8, -40, 13, 1.4, 4.2, { ink: RD });
    box(27, 0, -40, 4, 2.2, 4, { ink: OR });
    sniper(37, 4.2, -40);
    pickup(30, 0, -34);
  }
  // sticky notes flat on the desk, sticky pads, dice, a coin stack and glue sticks
  slab(-26, 20, -18, 28, 0.06, 0.06, { ink: OR });
  slab(10, -30, 17, -23, 0.06, 0.06, { ink: GR });
  slab(40, 26, 48, 34, 0.06, 0.06, { ink: PK });
  box(-16, 0, 6, 3, 1.4, 3, { ink: OR });
  box(16, 0, 8, 3, 1.4, 3, { ink: GR });
  box(-4, 0, 6, 1.8, 1.8, 1.8, { ink: RD });
  box(6, 0, 12, 1.8, 1.8, 1.8, { ink: RD });
  for (const [x, y, z] of [[-4, 1.8, 6], [6, 1.8, 12]]) {
    sphere(x - 0.4, y, z - 0.4, 0.15, { ink: BK });
    sphere(x + 0.4, y, z + 0.4, 0.15, { ink: BK });
    sphere(x, y, z, 0.15, { ink: BK });
  }
  cyl(-24, 0, -8, 1.3, 1.2, { seg: 16, ink: OR });
  cyl(50, 0, 40, 1.2, 6, { seg: 12, ink: GR });
  cyl(-50, 0, 40, 1.1, 5, { seg: 12, ink: BL });
  // a giant paper clip lying on the desk
  for (const [r, dx] of [[1.6, 0], [1.1, 0.5]] as const) {
    addGeo(new THREE.TorusGeometry(r, 0.12, 4, 16, Math.PI).rotateX(-Math.PI / 2).translate(-20 + dx, 0.12, 40), BK);
  }
  box(-14, 0.06, 41.6, 12, 0.12, 0.12, { noCollide: true, ink: BK });
  box(-14, 0.06, 38.4, 12, 0.12, 0.12, { noCollide: true, ink: BK });

  // breakables: erasers to hide behind until they crumble, ink bottles that shatter
  const eraser = (x: number, z: number): void => {
    breakable('crate', x, 0, z, 1.9, 1.1, 1.2, (g) => {
      g.add(inkMesh(new THREE.BoxGeometry(1.9, 1.1, 1.2).translate(0, 0.55, 0), PK));
      g.add(inkMesh(new THREE.BoxGeometry(0.9, 1.14, 1.24).translate(0.4, 0.55, 0), BL));
    }, { hp: 30, ink: PK });
  };
  const inkBottle = (x: number, z: number): void => {
    breakable('barrel', x, 0, z, 1.2, 1.5, 1.2, (g) => {
      g.add(inkMesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10).translate(0, 0.55, 0), BK));
      g.add(inkMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8).translate(0, 1.3, 0), BL));
    }, { hp: 30, ink: BL });
  };
  for (const [x, z] of [[-10, -2], [10, 4], [-20, 18], [26, 18], [-24, -24], [14, -28], [-8, 22], [44, -16]]) eraser(x, z);
  for (const [x, z] of [[-8, -30], [20, -32], [-48, 24], [48, 22], [-48, -10]]) inkBottle(x, z);
  for (const [x, z] of [[-10, 0], [10, 0], [-24, 30], [24, 30], [0, -30], [-44, -24], [46, 4]]) pickup(x, 0, z);

  // ---------------- the classroom far below: floor tiles, the chair, the next desks, a blackboard ----------------
  for (let k = -300; k <= 300; k += 25) {
    box(k, FLOOR, 0, 0.3, 0.05, 600, { ...deco, ink: BL });
    box(0, FLOOR, k, 600, 0.05, 0.3, { ...deco, ink: BL });
  }
  // the chair, pushed in at the front edge; its back comes up just short of the desk top
  const chair = (cx: number, cz: number, facing: number): void => {
    box(cx, FLOOR + 22, cz, 30, 1.6, 24, { ...deco, ink: BL });
    box(cx, FLOOR + 32, cz + facing * 13, 30, 10, 1.2, { ...deco, ink: BL });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) box(cx + sx * 13, FLOOR, cz + sz * 10, 1.2, 22, 1.2, { ...deco, ink: BK });
      box(cx + sx * 13, FLOOR + 22, cz + facing * 12, 1.2, 20, 1.2, { ...deco, ink: BK });
    }
  };
  chair(0, DZ + 8, 1);
  // more desks and chairs in the room, all the same
  const farDesk = (cx: number, cz: number): void => {
    box(cx, -1.6, cz, 2 * DX, 1.6, 2 * DZ, { ...deco, ink: OR });
    box(cx, -6, cz, 2 * DX - 8, 4.4, 2 * DZ - 8, { ...deco, ink: BL });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(cx + sx * (DX - 5), FLOOR, cz + sz * (DZ - 5), 2.4, -1.6 - FLOOR, 2.4, { ...deco, ink: BK });
    chair(cx, cz + DZ + 8, 1);
    // somebody's books and a pencil pot
    box(cx - 20, 0, cz - 10, 18, 3, 14, { ...deco, ink: GR });
    box(cx - 19, 3, cz - 11, 15, 2.5, 12, { ...deco, ink: RD });
    cyl(cx + 30, 0, cz - 20, 4, 10, { ...deco, seg: 14, ink: BL });
    for (const [dx, h, ink] of [[-1.5, 14, OR], [1.5, 12, PK], [0, 16, GR]] as const) {
      addGeo(new THREE.CylinderGeometry(0.6, 0.6, h, 6).translate(cx + 30 + dx, h / 2 + 2, cz - 20), ink);
    }
  };
  farDesk(-160, 0);
  farDesk(160, 0);
  farDesk(-160, 140);
  farDesk(0, 140);
  farDesk(160, 140);
  // the blackboard on the front wall, with a sum chalked on it
  box(0, FLOOR, -220, 600, 0.6, 2, { ...deco, ink: BK });
  box(0, -10, -220, 180, 70, 1, { ...deco, ink: GR });
  box(0, -12, -219, 186, 1.6, 4, { ...deco, ink: BK });
  for (const [x, y, w, h] of [[-50, 40, 20, 1.2], [-50, 40, 1.2, 20], [-15, 40, 18, 1.2], [20, 44, 18, 1.2], [20, 36, 18, 1.2], [60, 40, 1.2, 20]] as const) {
    box(x, y - h / 2, -219.2, w, h, 0.4, { ...deco, ink: BK });
  }
  // a window on the side wall, with the sun in it
  for (const [z, y, d, h] of [[0, 10, 160, 2], [0, 90, 160, 2], [-80, 50, 2, 82], [80, 50, 2, 82], [0, 50, 2, 82], [0, 50, 160, 1.4]] as const) {
    addGeo(new THREE.BoxGeometry(2, h, d).translate(-260, y, z), BL);
  }
  addGeo(new THREE.SphereGeometry(10, 12, 9).translate(-270, 70, 30), OR);
  planes(3, 26, 30, { rStep: 8, hStep: 5, scale: 1.4 });

  // ---------------- match spawns ----------------
  L.arenaSpawns.push(
    ...vecs([
      [0, 0, 20], [-37, 6, 10], [-37, 0, 0], [35, 9, -10], [40, 3, 0], [-40, 0, 40], [40, 0, 40], [-46, 0, -20],
      [46, 0, -26], [0, 1.5, 38.6], [-20, 0, -36], [16, 0, -40], [36, 4.2, -40], [0, 6, -5],
    ]),
  );
  return B.finish();
}
