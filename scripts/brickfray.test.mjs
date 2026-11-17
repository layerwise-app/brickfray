import test from "node:test";
import assert from "node:assert/strict";
import { buildArena, rayBox, chooseSpawn } from "../src/brickfray/world.ts";
import {
  Simulation,
  moveBody,
  bulletDirections,
} from "../src/brickfray/simulation.ts";
import { createBody } from "../src/brickfray/types.ts";
import { WEAPONS, RULES, damageAt } from "../src/brickfray/config.ts";
const empty = () => ({
  id: "plaza",
  bricks: [],
  solids: [],
  spawns: [
    [-15, 0, 0],
    [15, 0, 0],
    [0, 0, 20],
  ],
  ground: "#fff",
  size: 32,
});
function duel() {
  const sim = new Simulation(empty());
  sim.mode = "ffa";
  const a = sim.add("a", "Shooter"),
    b = sim.add("b", "Target");
  a.pos = [0, 0, 15];
  b.pos = [0, 0, 0];
  a.protection = b.protection = 0;
  return { sim, a, b };
}
const shot = (s, b, id, pitch = -0.03) =>
  s.fire(b, { id, time: s.time, weapon: b.weapon, yaw: 0, pitch, aim: true });
const advance = (sim, n) => {
  for (let i = 0; i < n; i++) sim.tick(new Map());
};
const command = (seq, extra = {}) => ({
  seq,
  x: 0,
  z: 1,
  yaw: 0,
  pitch: 0,
  jump: false,
  crouch: false,
  sprint: false,
  aim: false,
  ...extra,
});
test("all arenas have at least 16 collision-free spawns and bounded geometry", () => {
  for (const id of ["plaza", "fortress", "docks"]) {
    const a = buildArena(id);
    assert.ok(a.spawns.length >= 16, id);
    for (const p of a.spawns)
      assert.ok(
        !a.solids.some(
          (s) =>
            p[0] + 0.32 > s.min[0] &&
            p[0] - 0.32 < s.max[0] &&
            p[2] + 0.32 > s.min[2] &&
            p[2] - 0.32 < s.max[2] &&
            s.min[1] < 1.85 &&
            s.max[1] > 0,
        ),
        `${id} blocked spawn ${p}`,
      );
    assert.ok(a.bricks.length < 500);
  }
});
test("Clicker body TTK uses five 22-damage rounds at 660 RPM", () => {
  const { sim, a, b } = duel();
  for (let i = 0; i < 5; i++) {
    assert.equal(shot(sim, a, i + 1), true);
    if (i < 4) {
      assert.ok(b.hp > 0);
      advance(sim, 6);
    }
  }
  assert.equal(b.hp, 0);
  assert.equal(a.kills, 1);
  assert.ok(sim.time >= 0.36 && sim.time <= 0.45);
  assert.equal(a.mags[0], 25);
});
test("headshots shorten TTK, spawn protection blocks damage", () => {
  const { sim, a, b } = duel();
  for (let i = 0; i < 3; i++) {
    shot(sim, a, i + 1, 0);
    advance(sim, 6);
  }
  assert.equal(b.hp, 0);
  assert.equal(a.kills, 1);
  sim.respawn(b);
  b.pos = [0, 0, 0];
  advance(sim, 6);
  shot(sim, a, 9);
  assert.equal(b.hp, 100);
});
test("fixed shotgun spread and falloff stay deterministic", () => {
  const s = { id: 1, time: 0, weapon: 1, yaw: 0, pitch: 0, aim: false };
  assert.deepEqual(bulletDirections(s), bulletDirections(s));
  assert.equal(bulletDirections(s).length, 8);
  assert.equal(damageAt(0, 15, false), 22);
  assert.equal(damageAt(0, 40, false), 16);
  assert.equal(damageAt(1, 25, false), 3);
});
test("wall occlusion, fire-rate and magazine validation", () => {
  const { sim, a, b } = duel();
  sim.arena.solids.push({
    min: [-2, 0, 6],
    max: [2, 3, 7],
    color: "#fff",
    material: "plate",
  });
  shot(sim, a, 1);
  assert.equal(b.hp, 100);
  assert.equal(shot(sim, a, 2), false);
  advance(sim, 6);
  a.mags[0] = 0;
  assert.equal(shot(sim, a, 3), false);
  assert.equal(sim.violations.length, 2);
});
test("every weapon reloads; shotgun shell reload can be interrupted", () => {
  for (let w = 0; w < 4; w++) {
    const { sim, a } = duel();
    a.weapon = w;
    a.mags[w] = 0;
    sim.reload(a);
    assert.equal(a.reload, WEAPONS[w].empty);
    advance(sim, Math.ceil(WEAPONS[w].empty * 60) + 1);
    assert.equal(a.mags[w], w === 1 ? 1 : WEAPONS[w].mag);
    if (w === 1) {
      assert.ok(a.reload > 0);
      assert.equal(shot(sim, a, 1), true);
      assert.equal(a.reload, 0);
    }
  }
});
test("sprint release has 120ms gate; crouch while sprinting starts slide", () => {
  const a = createBody("a", "A", [0, 0, 15]);
  const map = empty();
  moveBody(a, command(1, { sprint: true }), map);
  assert.equal(a.sprint, true);
  moveBody(a, command(2, { crouch: true }), map);
  assert.ok(a.slide > 0);
  assert.equal(a.sprintLock, 0.12);
  for (let i = 0; i < 8; i++) moveBody(a, command(i + 3), map);
  assert.equal(a.sprintLock, 0);
});
test("movement prediction and authoritative replay agree for jumps and stairs", () => {
  const map = empty();
  map.solids.push({
    min: [-3, 0, 5],
    max: [3, 0.35, 7],
    color: "#fff",
    material: "plate",
  });
  const a = createBody("a", "A", [0, 0, 10]),
    b = structuredClone(a);
  const commands = Array.from({ length: 180 }, (_, i) =>
    command(i + 1, { jump: i === 80, crouch: i > 130 }),
  );
  commands.forEach((c) => moveBody(a, c, map));
  commands.forEach((c) => moveBody(b, c, map));
  assert.deepEqual(a.pos, b.pos);
  assert.ok(a.pos[1] >= 0);
});
test("hammer backstrike, cooldown and reload cancellation", () => {
  const { sim, a, b } = duel();
  a.pos = [0, 0, 1.3];
  a.mags[0] = 1;
  sim.reload(a);
  sim.melee(a);
  assert.equal(b.hp, 0);
  assert.equal(a.reload, 0);
  assert.equal(a.melee, 0.8);
  sim.melee(a);
  assert.equal(a.kills, 1);
});
test("grenade cooking auto-throws at 2.5s and cannot give extra grenades", () => {
  const { sim, a } = duel();
  sim.cook(a);
  sim.cook(a);
  assert.equal(a.grenades, 1);
  advance(sim, 151);
  assert.equal(a.cook, -1);
  assert.equal(sim.grenades.length, 1);
  assert.ok(sim.grenades[0].fuse <= 0.5);
  advance(sim, 31);
  assert.equal(sim.grenades.length, 0);
  assert.ok(sim.events.some((e) => e.type === "explosion"));
});
test("authority rewinds a moving target, but never beyond 200ms", () => {
  const { sim, a, b } = duel();
  advance(sim, 12);
  b.pos = [5, 0, 0];
  assert.equal(
    sim.fire(a, {
      id: 1,
      time: sim.time - 0.1,
      weapon: 0,
      yaw: 0,
      pitch: -0.03,
      aim: true,
    }),
    true,
  );
  assert.ok(b.hp < 100);
  advance(sim, 18);
  assert.equal(
    sim.fire(a, {
      id: 2,
      time: sim.time - 1,
      weapon: 0,
      yaw: 0,
      pitch: 0,
      aim: true,
    }),
    false,
  );
});
test("team damage and win limits", () => {
  const { sim, a, b } = duel();
  sim.mode = "tdm";
  b.team = a.team;
  shot(sim, a, 1);
  assert.equal(b.hp, 100);
  b.team = 1;
  a.kills = 49;
  sim.teamScores = [49, 0];
  sim.hurt(b, 100, a.id, a.pos);
  assert.equal(sim.ended, true);
  assert.equal(sim.teamScores[0], 50);
});
test("ray slab handles parallel rays; death-aware spawn scoring", () => {
  assert.equal(rayBox([2, 1, 3], [0, 0, -1], [-1, 0, -1], [1, 2, 1]), null);
  const a = createBody("a", "A", [0, 0, 0]);
  a.lastDeath = [-15, 0, 0];
  assert.notDeepEqual(chooseSpawn(empty(), a, []), a.lastDeath);
});

const { packBody, unpackBody, validPacket } =
  await import("../src/brickfray/protocol.ts");
test("quantized snapshot preserves combat state and sub-centimetre positions", () => {
  const a = createBody("a", "A", [1.234, 2.567, -8.912]);
  Object.assign(a, {
    crouch: true,
    aim: true,
    weapon: 3,
    shotAck: 57,
    ack: 800,
    slide: 0.25,
    sprintLock: 0.12,
    cook: 1.75,
  });
  a.mags = [12, 3, 4, 7];
  const row = packBody(a),
    b = unpackBody(row, createBody("a", "A", [0, 0, 0]));
  assert.equal(row.length, 33);
  assert.ok(Math.abs(b.pos[0] - a.pos[0]) <= 0.005);
  assert.deepEqual(b.mags, a.mags);
  assert.equal(b.shotAck, 57);
  assert.equal(b.cook, 1.75);
  assert.equal(b.crouch, true);
});
test("untrusted command shape, invalid floats and oversized payloads are rejected", () => {
  assert.equal(validPacket({ k: "input", commands: [command(1)] }), true);
  assert.equal(
    validPacket({ k: "input", commands: [command(1, { x: Infinity })] }),
    false,
  );
  assert.equal(
    validPacket({ k: "input", commands: Array(13).fill(command(1)) }),
    false,
  );
  assert.equal(
    validPacket({
      k: "shot",
      shot: { id: 1, time: 1, weapon: 99, yaw: 0, pitch: 0 },
    }),
    false,
  );
  assert.equal(validPacket({ k: "chat", text: "x".repeat(161) }), false);
});
test("reconnecting preserves position and score while resetting command and shot sequences", () => {
  const { sim, a } = duel();
  shot(sim, a, 50);
  a.ack = 600;
  a.kills = 9;
  const pos = [...a.pos];
  sim.reconnect(a.id);
  assert.equal(a.ack, 0);
  assert.equal(a.shotAck, 0);
  assert.equal(a.kills, 9);
  assert.deepEqual(a.pos, pos);
  advance(sim, 6);
  assert.equal(shot(sim, a, 1), true);
});
test("camera projection and authoritative ray point in the same direction", async () => {
  const T = await import("three");
  const { aimDir } = await import("../src/brickfray/world.ts");
  for (const [yaw, pitch] of [
    [0, 0.4],
    [1, -0.7],
    [-2, 0.2],
  ]) {
    const camera = new T.PerspectiveCamera();
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    const v = camera.getWorldDirection(new T.Vector3());
    const ray = aimDir(yaw, pitch);
    assert.ok(v.distanceTo(new T.Vector3(...ray)) < 1e-7);
  }
});

test("predicted melee animates without changing health, score or ending a match", () => {
  const { sim, a, b } = duel();
  a.pos = [0, 0, 1.5];
  sim.melee(a, true);
  assert.equal(a.action, "melee");
  assert.equal(a.melee, 0.8);
  assert.equal(b.hp, 100);
  assert.equal(a.kills, 0);
  assert.equal(sim.ended, false);
});

test("remote grenades animate and deduplicate without applying client damage", () => {
  const { sim, a } = duel();
  sim.cook(a);
  a.cook = 1.5;
  sim.throw(a);
  const event = sim.events.find((e) => e.type === "grenade");
  assert.ok(event.object);
  assert.equal(event.value, 1.5);
  const client = new Simulation(empty());
  const target = client.add("target", "Target");
  target.protection = 0;
  client.receiveGrenade(event, 0.15);
  client.receiveGrenade(event, 0.15);
  assert.equal(client.grenades.length, 1);
  assert.notDeepEqual(client.grenades[0].p, event.pos);
  for (let i = 0; i < 200; i++) client.advanceGrenades(RULES.tick, false);
  assert.equal(client.grenades.length, 0);
  assert.equal(target.hp, 100);
  assert.equal(client.events.length, 0);
});

test("waves introduce three bot roles and a boss every fifth wave", () => {
  const sim = new Simulation(empty());
  sim.add("human", "Player");
  for (let wave = 1; wave <= 10; wave++) {
    for (const b of sim.players.values()) if (b.bot) b.hp = 0;
    sim.waveRest = 0;
    sim.waves();
    const bots = [...sim.players.values()].filter((b) => b.bot);
    assert.equal(sim.wave, wave);
    assert.equal(
      bots.filter((b) => b.bot === "boss").length,
      wave % 5 === 0 ? 1 : 0,
    );
    assert.ok(bots.some((b) => b.bot === "rusher"));
    if (wave >= 3) assert.ok(bots.some((b) => b.bot === "sniper"));
  }
});

test("valid queued shots use shot timestamps while sustained AR cadence stays at 660 RPM", () => {
  const { sim, a } = duel();
  sim.time = 0.3;
  for (const [index, time] of [0, 0.1, 0.19].entries())
    assert.equal(
      sim.fire(a, {
        id: index + 1,
        time,
        weapon: 0,
        yaw: 0,
        pitch: -0.03,
        aim: true,
      }),
      true,
    );
  assert.equal(
    sim.fire(a, { id: 4, time: 0.195, weapon: 0, yaw: 0, pitch: 0, aim: true }),
    false,
  );

  const firing = duel();
  let rounds = 0;
  for (let tick = 0; tick < 60; tick++) {
    if (firing.sim.time + 0.003 >= firing.a.nextShot) {
      assert.equal(shot(firing.sim, firing.a, ++rounds), true);
    }
    firing.sim.tick(new Map());
  }
  assert.equal(rounds, 11);
});
