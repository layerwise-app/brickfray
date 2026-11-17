import * as T from "three";
import type { MapId } from "./config";
import type { Body, V3 } from "./types";
export interface Brick {
  p: V3;
  s: V3;
  color: string;
  studs: boolean;
}
export interface Solid {
  min: V3;
  max: V3;
  color: string;
  material: "plate" | "tile" | "metal";
}
export interface Arena {
  id: MapId;
  bricks: Brick[];
  solids: Solid[];
  spawns: V3[];
  ground: string;
  size: number;
  water?: boolean;
}
export function buildArena(id: MapId): Arena {
  const a: Arena = {
    id,
    bricks: [],
    solids: [],
    spawns: [],
    ground:
      id === "fortress" ? "#94a386" : id === "docks" ? "#a4b9b8" : "#d9d0b8",
    size: 32,
  };
  const brick = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    solid = true,
    studs = true,
    material: Solid["material"] = "plate",
  ) => {
    a.bricks.push({ p: [x, y + h / 2, z], s: [w, h, d], color, studs });
    if (solid)
      a.solids.push({
        min: [x - w / 2, y, z - d / 2],
        max: [x + w / 2, y + h, z + d / 2],
        color,
        material,
      });
  };
  const stairs = (
    x: number,
    z: number,
    count: number,
    dir = 1,
    color = "#b9bfbb",
  ) => {
    for (let i = 0; i < count; i++)
      brick(
        x,
        i * 0.35,
        z + dir * i * 0.65,
        2.8,
        0.35,
        0.67,
        color,
        true,
        false,
        "tile",
      );
  };
  const wall = (
    x: number,
    z: number,
    w: number,
    d: number,
    h = 1.05,
    color = "#f0c868",
  ) => brick(x, 0, z, w, h, d, color);
  // Collision uses broad architecture boxes, never the decorative brick courses.
  for (const x of [-32, 32]) brick(x, 0, 0, 1, 12, 65, "#607f88", true, false);
  for (const z of [-32, 32]) brick(0, 0, z, 65, 12, 1, "#607f88", true, false);
  if (id === "plaza") {
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) {
        const x = -25 + i * 10,
          z = side * 28,
          h = 6 + (i % 3) * 2,
          col = [
            "#ec9e68",
            "#78b8ba",
            "#e9c866",
            "#9bafd0",
            "#d47863",
            "#a0b889",
          ][i];
        brick(x, 0, z, 8.8, h, 6, col);
        brick(x, h, z, 9.3, 0.4, 6.5, "#f6e9c9");
        for (let floor = 1; floor < h - 1; floor += 2.5)
          for (let k = -1; k <= 1; k++) {
            brick(
              x + k * 2.4,
              floor,
              z - side * 3.04,
              1.25,
              1.6,
              0.14,
              "#344b64",
              false,
              false,
            );
            brick(
              x + k * 2.4,
              floor - 0.16,
              z - side * 3.2,
              1.55,
              0.18,
              0.38,
              "#f6e9c9",
              false,
              false,
            );
          }
      }
    }
    // Three open north/south routes separated by low cover and the climbable tower.
    brick(0, 0, 0, 5, 4, 5, "#e8b854");
    brick(0, 4, 0, 5.5, 0.4, 5.5, "#f3e7c9");
    for (const x of [-2.5, 2.5]) wall(x, 0, 0.5, 5.5, 5, "#f3e7c9");
    stairs(4, -5.5, 13, 1, "#dfb66c");
    brick(2.8, 4, 2.4, 3, 0.4, 1.4, "#f3e7c9");
    for (const x of [-13, 13])
      for (const z of [-15, 0, 15]) {
        wall(x, z, 5, 1, 1.05, "#c47b60");
        brick(x, 1.05, z, 5.2, 0.18, 1.2, "#f5e5c5");
      }
    for (const [x, z] of [
      [-6, -10],
      [8, 12],
    ]) {
      brick(x, 0.35, z, 2.8, 1, 4.6, "#55aab9");
      brick(x, 1.35, z + 0.2, 2.3, 0.75, 2.2, "#f5c95a");
      brick(x, 1.45, z - 1, 2, 0.5, 0.12, "#263f55", false, false);
      for (const dx of [-1.4, 1.4])
        for (const dz of [-1.4, 1.4])
          brick(x + dx, 0, z + dz, 0.35, 0.7, 0.8, "#344457", false, false);
    }
    for (const x of [-22, 22])
      for (const z of [-15, 15]) {
        brick(x, 0, z, 2.5, 0.7, 2.5, "#e2d7bd");
        brick(x, 0.7, z, 0.65, 3, 0.65, "#967252");
        brick(x, 3, z, 3.8, 2, 3.8, "#70a77b");
        brick(x, 5, z, 2.7, 1.3, 2.7, "#8cba84");
      }
  } else if (id === "fortress") {
    for (const x of [-23, 23]) {
      brick(x, 0, 0, 4, 4, 48, "#9daeb6");
      for (let z = -24; z <= 24; z += 3) brick(x, 4, z, 4, 0.8, 1.5, "#c3c8b7");
      stairs(x - 4, -19, 12, 1);
      brick(x - 2, 4, -11, 4, 0.3, 3, "#b6bcae");
    }
    for (const z of [-15, 15]) {
      brick(-12, 0, z, 15, 3, 3, "#adb9b9");
      brick(12, 0, z, 15, 3, 3, "#adb9b9");
      brick(0, 3, z, 10, 1.2, 3, "#c5c8b6");
      brick(-4, 0, z, 1.5, 3, 3, "#adb9b9");
      brick(4, 0, z, 1.5, 3, 3, "#adb9b9");
    }
    brick(0, 0.02, 0, 35, 0.08, 5, "#6bacb3", false, false);
    brick(0, 0.15, 0, 5, 0.35, 8, "#c9ab79");
    for (const x of [-2.5, 2.5]) brick(x, 0.5, 0, 0.4, 0.7, 8, "#dabd89");
    for (const x of [-13, 13])
      for (const z of [-5, 6]) {
        wall(x, z, 4, 2, 1.05, "#c6bd9d");
        brick(x, 1.05, z, 4.3, 0.2, 2.3, "#e0d0aa");
      }
    for (const x of [-23, 23])
      for (const z of [-23, 23]) {
        brick(x, 4, z, 6, 3, 6, "#8b9eab");
        brick(x, 7, z, 6.6, 0.6, 6.6, "#c6c5ac");
      }
  } else {
    a.water = true;
    for (const x of [-14, 0, 14])
      for (const z of [-14, 3]) {
        const col = x === 0 ? "#d6a353" : x < 0 ? "#598fa5" : "#c8705a";
        brick(x, 0, z, 6, 3, 10, col, true, true, "metal");
        for (let i = -2; i <= 2; i++)
          brick(
            x + i * 1.1,
            0.3,
            z - 5.06,
            0.12,
            2.5,
            0.12,
            "#e4cbb0",
            false,
            false,
          );
      }
    brick(-21, 0, 16, 1, 6, 12, "#b8c3b9");
    brick(-12, 0, 22, 19, 6, 1, "#b8c3b9");
    brick(-12, 6, 16, 20, 0.5, 13, "#687f88");
    brick(-2, 0, 18, 1, 6, 8, "#b8c3b9");
    wall(-12, 14, 4, 2, 1.05);
    stairs(5, -19, 9, 1, "#d3b47b");
    brick(2.5, 3, -14, 5, 0.3, 2, "#d3b47b");
    for (const x of [20, 26]) brick(x, 0, 21, 0.9, 12, 0.9, "#e0b74f");
    brick(23, 12, 14, 8, 0.8, 18, "#e0b74f");
    brick(23, 8, 8, 0.15, 4, 0.15, "#445260", false, false);
    brick(23, 7, 8, 1, 0.8, 1, "#e0b74f");
    brick(24, 0.02, -17, 10, 0.1, 18, "#659da8", false, false);
    brick(24, 0.3, -18, 5.8, 1.3, 11, "#e1ce9e");
    brick(24, 1.6, -16, 4, 2.4, 4, "#b5d3cc");
    for (const z of [-5, 11]) wall(10, z, 3, 2, 1.05, "#a38b67");
  }
  // 20 reachable spawn candidates, covering each lane and both ends.
  for (const z of [-22, -9, 9, 22])
    for (const x of [-19, -9, 0, 9, 19]) {
      const p: V3 = [x, 0, z];
      if (
        !a.solids.some(
          (b) =>
            x > b.min[0] - 0.5 &&
            x < b.max[0] + 0.5 &&
            z > b.min[2] - 0.5 &&
            z < b.max[2] + 0.5 &&
            b.min[1] < 1.8,
        )
      )
        a.spawns.push(p);
    }
  for (const z of [-23, 23, -18, 18, -7, 7])
    for (const x of [-27, -18, -9, 0, 9, 18, 27]) {
      if (a.spawns.length >= 28) break;
      if (a.spawns.some((p) => Math.hypot(p[0] - x, p[2] - z) < 3)) continue;
      if (
        a.solids.some(
          (s) =>
            x + 0.4 > s.min[0] &&
            x - 0.4 < s.max[0] &&
            z + 0.4 > s.min[2] &&
            z - 0.4 < s.max[2] &&
            s.min[1] < 1.85 &&
            s.max[1] > 0,
        )
      )
        continue;
      a.spawns.push([x, 0, z]);
    }
  return a;
}
export function rayBox(
  origin: V3,
  dir: V3,
  min: V3,
  max: V3,
  maxDist = 200,
): number | null {
  let lo = 0,
    hi = maxDist;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-8) {
      if (origin[i] < min[i] || origin[i] > max[i]) return null;
    } else {
      let a = (min[i] - origin[i]) / dir[i],
        b = (max[i] - origin[i]) / dir[i];
      if (a > b) [a, b] = [b, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
      if (hi < lo) return null;
    }
  }
  return lo;
}
export function traceWorld(arena: Arena, origin: V3, dir: V3, max = 160) {
  let dist = max,
    solid: Solid | null = null;
  for (const b of arena.solids) {
    const t = rayBox(origin, dir, b.min, b.max, dist);
    if (t !== null && t < dist) {
      dist = t;
      solid = b;
    }
  }
  if (dir[1] < 0 && origin[1] / -dir[1] < dist) {
    dist = origin[1] / -dir[1];
    solid = {
      min: [-32, -1, -32],
      max: [32, 0, 32],
      color: arena.ground,
      material: "plate",
    };
  }
  const point = origin.map((v, i) => v + dir[i] * dist) as V3;
  let normal: V3 = [0, 1, 0];
  if (solid) {
    let best = Infinity;
    for (let i = 0; i < 3; i++)
      for (const side of [0, 1]) {
        const d = Math.abs(point[i] - (side ? solid.max : solid.min)[i]);
        if (d < best) {
          best = d;
          normal = [0, 0, 0];
          normal[i] = side ? 1 : -1;
        }
      }
  }
  return { dist, point, normal, solid };
}
export function aimDir(yaw: number, pitch: number): V3 {
  return [
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ];
}
export function eye(b: Body): V3 {
  return [
    b.pos[0],
    b.pos[1] + (b.crouch ? 1.05 : 1.65) * (b.bot === "boss" ? 1.8 : 1),
    b.pos[2],
  ];
}
export function chooseSpawn(a: Arena, body: Body, players: Body[]): V3 {
  let best = a.spawns[0],
    score = -Infinity;
  for (const p of a.spawns) {
    let s = Math.min(
      20,
      Math.hypot(p[0] - body.lastDeath[0], p[2] - body.lastDeath[2]),
    );
    for (const other of players) {
      if (other.id === body.id || other.hp <= 0) continue;
      const d = Math.hypot(p[0] - other.pos[0], p[2] - other.pos[2]);
      s += Math.min(d, 20);
      const from = eye(other),
        to = new T.Vector3(
          p[0] - from[0],
          p[1] + 1.4 - from[1],
          p[2] - from[2],
        );
      const len = to.length();
      to.normalize();
      if (traceWorld(a, from, to.toArray() as V3, len).dist >= len - 0.1)
        s -= 35;
      s -= Math.max(0, 8 - d) * 8;
    }
    if (s > score) {
      score = s;
      best = p;
    }
  }
  return [...best];
}
