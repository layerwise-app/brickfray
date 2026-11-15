// ============================ map: Ink Metro ============================
// An underground station on two levels. Two side platforms face each other across a pair of
// tracks; galleries above them hold the ticket hall (turnstiles, machines, a booth on each side),
// and a footbridge crosses over the tracks between them. Stairs climb from each platform. Every
// so often a train roars through on one track or the other: it hurts, throws you clear, stops
// bullets while it passes, and you can ride on its roof or hook it and be dragged along.
// Train timing comes from the wall clock, so everyone in a match sees the same trains.
import * as THREE from 'three';
import { INK, makeInkMaterial } from '../../render/ink-renderer';
import type { Hazard, HazardHit, Level, LevelBuilder } from '../level';

const vecs = (points: readonly (readonly [number, number, number])[]): THREE.Vector3[] =>
  points.map(([x, y, z]) => new THREE.Vector3(x, y, z));

/** Train tuning. */
const TRAIN = {
  len: 30,
  width: 3,
  height: 3.8,
  /** Underside of the car above the rails. */
  y0: 0.3,
  speed: 26,
  /** The run starts and ends this far from the middle (well inside the tunnels). */
  range: 105,
  /** Seconds between trains on one track. */
  period: 34,
  /** Seconds the signals flash before a train arrives. */
  warn: 3.5,
  damage: 45,
} as const;

export function buildMetro(B: LevelBuilder): Level {
  const { L, box, slab, wallX, wallZ, stairs, rail, cyl, sphere, ring, spawn, sniper, pickup, collider, scene, inkMesh, breakable } = B;
  const { BLUE: BL, RED: RD, BLACK: BK, ORANGE: OR, GREEN: GR, PINK: PK } = INK;
  L.key = 'metro';
  L.playerStart.set(0, 1.2, 12);
  const PX = 60;
  const PZ = 34;
  L.bounds = { minX: -PX, maxX: PX, minZ: -PZ, maxZ: PZ };
  const NG = { noNav: true, noGrapple: true };
  const PL = 1.2; // platform top
  const GY = 7; // gallery floor
  const CEIL = 16;
  L.ceiling = CEIL;

  // ---------------- the shell: track bed, platforms, walls, tunnels, ceiling ----------------
  // the track bed is not a place to walk to, so the doodles keep off it
  box(0, -1, 0, 230, 1, 12, { noNav: true, ink: BK });
  box(0, -1, 20, 2 * PX, 1 + PL, 28);
  box(0, -1, -20, 2 * PX, 1 + PL, 28);
  for (const side of [-1, 1]) {
    // platform edge: a lip and a warning stripe
    box(0, PL, side * 6.8, 2 * PX, 0.02, 0.4, { noCollide: true, ink: OR });
    for (let x = -PX; x < PX; x += 1.2) box(x + 0.3, PL, side * 7.2, 0.4, 0.02, 0.2, { noCollide: true, ink: BK });
    // end walls with the tunnel mouth, back walls
    wallZ(-PZ - 1, PZ + 1, side * (PX + 0.5), 0, CEIL, 1, [[-6, 6, 0, 5.5]]);
    wallX(-PX - 1, PX + 1, side * (PZ + 0.5), 0, CEIL, 1);
    // tunnels: walls and a roof running far back, a cap nobody walks past
    box(side * 85.5, 0, -6.5, 49, 5.5, 1, { ink: BK });
    box(side * 85.5, 0, 6.5, 49, 5.5, 1, { ink: BK });
    box(side * 85.5, 5.5, 0, 49, 1, 14, { ink: BK });
    collider(side * 66.5, 0, 0, 1, 6, 12, NG);
    // tunnel arch
    for (const z of [-6, 6]) box(side * 59.8, 0, z, 0.4, 5.5, 0.4, { noCollide: true, ink: OR });
    box(side * 59.8, 5.5, 0, 0.4, 0.4, 12.4, { noCollide: true, ink: OR });
  }
  collider(0, CEIL, 0, 2 * PX + 40, 4, 2 * PZ + 40, NG);
  // rails and sleepers
  for (const tz of [-3, 3]) {
    for (const dz of [-0.72, 0.72]) box(0, 0, tz + dz, 220, 0.22, 0.14, { noCollide: true, ink: BK });
    for (let x = -108; x <= 108; x += 1.6) box(x, 0, tz, 0.35, 0.08, 2.4, { noCollide: true, ink: BL });
  }
  // ceiling beams and strip lights
  for (let x = -54; x <= 54; x += 12) {
    box(x, CEIL - 0.6, 0, 0.6, 0.6, 2 * PZ, { noCollide: true });
    for (const z of [-11, 11]) box(x + 6, CEIL - 1.2, z, 3, 0.2, 0.3, { noCollide: true, ink: OR });
  }

  // ---------------- galleries, footbridge, stairs ----------------
  for (const side of [-1, 1]) {
    const edge = side * 16;
    slab(-PX, Math.min(edge, side * PZ), PX, Math.max(edge, side * PZ), GY, 0.5);
    for (const [a, b] of [[-PX, -31.5], [-28.5, -5], [5, 28.5], [31.5, PX]]) rail(a, edge, b, edge, GY);
    // stairs up from the platform at x = +-30
    for (const x of [-30, 30]) {
      stairs(x, PL, side * 7.6, side > 0 ? '+z' : '-z', 20, 3, { rise: (GY - PL) / 20, run: 0.42, ink: GR });
      // escalator-style handrails
      for (const dx of [-1.6, 1.6]) {
        const g = new THREE.BoxGeometry(0.15, 0.15, 9.2);
        g.rotateX(-side * Math.atan2(GY - PL, 8.4));
        g.translate(x + dx, (PL + GY) / 2 + 1, side * 11.8);
        B.addGeo(g, BK);
      }
    }
    // columns: tall ones by the platform edge, short ones under the gallery edge
    for (const x of [-48, -36, -24, -12, 12, 24, 36, 48]) box(x, PL, side * 11, 1.2, CEIL - PL, 1.2);
    for (const x of [-54, -42, -18, -6, 6, 18, 42, 54]) box(x, PL, side * 17, 1, GY - 0.5 - PL, 1);
    // footbridge supports
    for (const x of [-4.4, 4.4]) box(x, PL, side * 9, 0.6, GY - 0.5 - PL, 0.6);
  }
  slab(-5, -16, 5, 16, GY, 0.5, { ink: OR });
  rail(-5, -16, -5, 16, GY);
  rail(5, -16, 5, 16, GY);

  // ---------------- doors: where the doodles come in ----------------
  const frame = { noCollide: true, ink: BK };
  const doorX = (x: number, y: number, z: number): void => {
    box(x - 1.3, y, z, 0.3, 3.2, 0.3, frame);
    box(x + 1.3, y, z, 0.3, 3.2, 0.3, frame);
    box(x, y + 3, z, 2.9, 0.3, 0.3, frame);
    box(x, y + 1.6, z, 2.3, 3, 0.05, { noCollide: true, ink: GR });
    spawn(x, y, z - Math.sign(z) * 1.6);
  };
  const doorZ = (x: number, y: number, z: number): void => {
    box(x, y, z - 1.3, 0.3, 3.2, 0.3, frame);
    box(x, y, z + 1.3, 0.3, 3.2, 0.3, frame);
    box(x, y + 3, z, 0.3, 0.3, 2.9, frame);
    box(x, y + 1.6, z, 0.05, 3, 2.3, { noCollide: true, ink: GR });
    spawn(x - Math.sign(x) * 1.6, y, z);
  };
  for (const side of [-1, 1]) {
    for (const x of [-40, 0, 40]) doorX(x, PL, side * (PZ - 0.1));
    for (const x of [-26, 26]) doorX(x, GY, side * (PZ - 0.1));
    doorZ(side * (PX - 0.1), PL, side * 12);
    doorZ(side * (PX - 0.1), GY, side * 25);
  }

  // ---------------- the platforms: benches, vending machines, bins, luggage ----------------
  for (const side of [-1, 1]) {
    for (const x of [-46, -14, 14, 46]) {
      box(x, PL + 0.45, side * 21, 3, 0.15, 0.8);
      box(x, PL, side * 21, 2.6, 0.45, 0.2, { noCollide: true, ink: BK });
      box(x, PL + 0.45, side * 21.5, 3, 0.8, 0.12, { noCollide: true });
    }
    for (const x of [-20, 20]) {
      box(x, PL, side * 32.6, 2.2, 3.4, 1.6, { ink: RD });
      box(x - 0.3, PL + 1.6, side * 31.75, 1.2, 1.4, 0.05, { noCollide: true, ink: BK });
    }
    // a route map on the back wall
    box(-8, PL + 1.5, side * 33.9, 6, 2.4, 0.1, { noCollide: true, ink: BL });
    for (const [ink, dy] of [[OR, 0.4], [GR, -0.1], [PK, -0.6]] as const) box(-8, PL + 2.7 + dy, side * 33.8, 5, 0.1, 0.05, { noCollide: true, ink });
  }
  const bin = (x: number, z: number): void => {
    breakable('barrel', x, PL, z, 1.1, 1.3, 1.1, (g) => {
      g.add(inkMesh(new THREE.CylinderGeometry(0.5, 0.45, 1.2, 10).translate(0, 0.6, 0), GR));
      g.add(inkMesh(new THREE.TorusGeometry(0.5, 0.05, 4, 14).rotateX(Math.PI / 2).translate(0, 1.2, 0), BK));
    }, { hp: 30, ink: GR });
  };
  const suitcase = (x: number, z: number): void => {
    breakable('crate', x, PL, z, 1.6, 1.2, 0.8, (g) => {
      g.add(inkMesh(new THREE.BoxGeometry(1.6, 1.2, 0.8).translate(0, 0.6, 0), PK));
      g.add(inkMesh(new THREE.BoxGeometry(0.6, 0.2, 0.1).translate(0, 1.3, 0), BK));
    }, { hp: 30, ink: PK });
  };
  for (const [x, z] of [[-42, 9.5], [18, 9.5], [-18, -9.5], [42, -9.5], [-30, 26], [30, -26], [8, 30], [-8, -30]]) bin(x, z);
  for (const [x, z] of [[-8, 13], [40, -13], [-50, -24], [52, 24], [-34, -20], [34, 20]]) suitcase(x, z);

  // ---------------- the ticket hall up on the galleries ----------------
  for (const side of [-1, 1]) {
    const z = side * 24;
    for (let x = -12; x <= 12.01; x += 1.6) {
      box(x, GY, z, 0.5, 1.1, 2, { ink: BL });
      box(x + 0.8, GY + 0.8, z, 1, 0.08, 0.08, { noCollide: true, ink: RD });
    }
    for (const x of [-16, 16]) box(x, GY, side * 32.6, 2, 2.6, 1.4, { ink: GR });
    // ticket booth, its roof a perch
    const bx = -side * 46;
    const x1 = bx - 4;
    const x2 = bx + 4;
    const z1 = z - 3;
    const z2 = z + 3;
    const o = { ink: PK };
    wallX(x1, x2, z1, GY, 3.4, 0.3, [[bx - 2.5, bx + 2.5, 1, 2.6]], o);
    wallX(x1, x2, z2, GY, 3.4, 0.3, [[bx - 2.5, bx + 2.5, 1, 2.6]], o);
    wallZ(z1, z2, x1, GY, 3.4, 0.3, [[z - 1, z + 1, 0, 2.6]], o);
    wallZ(z1, z2, x2, GY, 3.4, 0.3, [[z - 1, z + 1, 0, 2.6]], o);
    slab(x1 - 0.3, z1 - 0.3, x2 + 0.3, z2 + 0.3, GY + 3.8, 0.4, o);
    sniper(bx, GY + 3.8, z);
    pickup(bx, GY, z);
  }

  // ---------------- signs, a clock, rings over the tracks ----------------
  for (const side of [-1, 1]) {
    for (const x of [-30, 30]) {
      box(x, 9.4, side * 11.7, 9, 1.8, 0.2, { noCollide: true, ink: BL });
      box(x - 1, 10.3, side * 11.55, 6, 0.12, 0.05, { noCollide: true, ink: BK });
      box(x - 1.5, 9.9, side * 11.55, 5, 0.12, 0.05, { noCollide: true, ink: BK });
      sphere(x + 3.3, 10.3, side * 11.55, 0.5, { ink: side > 0 ? OR : GR });
      for (const dx of [-3.5, 3.5]) box(x + dx, 11.2, side * 11.7, 0.08, CEIL - 11.2, 0.08, { noCollide: true, ink: BK });
    }
  }
  cyl(0, 11, 0, 1.2, 0.2, { noCollide: true, ink: BK, seg: 16 });
  box(0, 11.6, 0, 0.08, 0.7, 0.24, { noCollide: true, ink: RD });
  box(0, CEIL - 3.8, 0, 0.08, 3.8, 0.08, { noCollide: true, ink: BK });
  for (const x of [-42, -18, 18, 42]) ring(x, 12.5, 0, 'y');

  // ---------------- trains ----------------
  const train = (z: number, dir: 1 | -1, offset: number): void => {
    const { len, width, height, y0, speed, range, period, warn } = TRAIN;
    const body = inkMesh(new THREE.BoxGeometry(len, height, width), BL);
    // windows and doors stand proud of the sides so their outlines read
    const glass = makeInkMaterial({ ink: BK, fill: true });
    for (let i = -3; i <= 3; i++) body.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, width + 0.3).translate(i * 4, 0.6, 0), glass));
    for (const x of [-10, 2, 14]) body.add(inkMesh(new THREE.BoxGeometry(1.4, height - 0.6, width + 0.2).translate(x - 4, -0.2, 0), GR));
    body.add(inkMesh(new THREE.BoxGeometry(len + 0.1, 0.3, width + 0.3).translate(0, -1.2, 0), RD));
    body.add(inkMesh(new THREE.BoxGeometry(len - 1, 0.3, width - 0.6).translate(0, height / 2 + 0.15, 0), BK));
    body.add(inkMesh(new THREE.BoxGeometry(0.4, height - 0.8, width - 0.4).translate(dir * (len / 2 + 0.2), -0.2, 0), OR));
    for (const dz of [-0.9, 0.9]) {
      body.add(inkMesh(new THREE.SphereGeometry(0.3, 8, 6).translate(dir * (len / 2 + 0.45), -1, dz), OR));
    }
    scene.add(body);
    L.meshes.push(body);
    L.grappleMovers.push({ mesh: body, radius: 2.4 });
    // its collider runs the whole track (so it is hashed everywhere it can be) and is resized every frame
    const col = collider(0, -60, z, 2 * 80, height, width, { noNav: true });
    // red signals over both tunnel mouths of this track
    const lights = [-1, 1].map((sx) => {
      const m = inkMesh(new THREE.SphereGeometry(0.45, 8, 6), RD);
      m.position.set(sx * 59.4, 6.3, z);
      scene.add(m);
      L.meshes.push(m);
      return m;
    });
    const travel = (2 * range) / speed;
    let active = false;
    let cx = 0;
    L.animated.push({
      mesh: body,
      update: () => {
        const ph = (((Date.now() / 1000 + offset) % period) + period) % period;
        active = ph < travel;
        cx = dir * (-range + speed * ph);
        const flash = (active || ph > period - warn) && Math.sin(Date.now() / 90) > 0;
        for (const m of lights) m.visible = flash;
        body.visible = active;
        const minX = Math.max(-80, cx - len / 2);
        const maxX = Math.min(80, cx + len / 2);
        if (active && minX < maxX) {
          body.position.set(cx, y0 + height / 2, z);
          col.min.x = minX;
          col.max.x = maxX;
          col.min.y = y0;
          col.max.y = y0 + height;
        } else {
          body.position.set(0, -200, z);
          col.min.x = -80;
          col.max.x = 80;
          col.min.y = -60;
          col.max.y = -60 + height;
        }
      },
    });
    const hazard: Hazard = {
      touch(b, dt): HazardHit | null {
        if (!active) return null;
        const p = b.pos;
        const hw = b.halfW;
        if (p.x + hw < cx - len / 2 - 0.2 || p.x - hw > cx + len / 2 + 0.2) return null;
        if (p.z + hw < z - width / 2 - 0.2 || p.z - hw > z + width / 2 + 0.2) return null;
        const top = y0 + height;
        if (p.y >= top - 0.35) {
          // riding on the roof; it slides out from under you at the tunnel mouth
          if (b.onGround && p.y < top + 0.4 && Math.abs(p.x) < PX - 4) p.x += dir * speed * dt;
          return null;
        }
        if (p.y + b.height < y0) return null;
        // caught by the train: thrown clear to the nearer side
        const side = p.z >= z ? 1 : -1;
        p.z = z + side * (width / 2 + hw + 0.25);
        return { damage: TRAIN.damage, from: new THREE.Vector3(cx, p.y + 1, z), push: new THREE.Vector3(dir * 16, 7, side * 9) };
      },
    };
    L.hazards.push(hazard);
  };
  train(-3, 1, 0);
  train(3, -1, TRAIN.period / 2);

  // ---------------- perches, pickups, match spawns ----------------
  sniper(0, GY, 0);
  sniper(55, GY, 20);
  sniper(-55, GY, -20);
  spawn(-50, GY, 20);
  spawn(50, GY, -20);
  const pickupSpots = [
    [0, GY, 8], [0, GY, -8], [-20, PL, 8], [20, PL, -8], [-50, PL, -14], [50, PL, 14],
    [-36, GY, 28], [36, GY, -28], [0, GY, 30], [0, GY, -30], [-30, PL, 22], [30, PL, -22],
  ];
  for (const [x, y, z] of pickupSpots) pickup(x, y, z);
  L.arenaSpawns.push(
    ...vecs([
      [0, PL, 12], [0, PL, -12], [-52, PL, 10], [52, PL, -10], [-52, PL, -28], [52, PL, 28], [-26, PL, 28], [26, PL, -28],
      [0, GY, 0], [-40, GY, 22], [40, GY, -22], [-24, GY, -28], [24, GY, 28], [-46, GY + 3.8, 24], [46, GY + 3.8, -24],
    ]),
  );
  return B.finish();
}
