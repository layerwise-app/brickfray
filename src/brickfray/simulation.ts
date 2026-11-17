import {
  RULES,
  WEAPONS,
  PELLETS,
  damageAt,
  type Mode,
  type WeaponId,
} from "./config";
import {
  aimDir,
  chooseSpawn,
  eye,
  rayBox,
  traceWorld,
  type Arena,
} from "./world";
import {
  createBody,
  type Body,
  type Command,
  type GameEvent,
  type Shot,
  type V3,
} from "./types";
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const distance = (a: V3, b: V3) => Math.hypot(...a.map((v, i) => v - b[i]));
export function moveBody(b: Body, c: Command, arena: Arena, dt = RULES.tick) {
  if (b.hp <= 0) return;
  const wasSprint = b.sprint,
    wasCrouch = b.crouch;
  b.yaw = c.yaw;
  b.pitch = clamp(c.pitch, -1.5, 1.5);
  b.aim = c.aim;
  b.crouch = c.crouch;
  if (
    !c.crouch &&
    wasCrouch &&
    arena.solids.some(
      (s) =>
        b.pos[0] > 0.0 + s.min[0] - 0.32 &&
        b.pos[0] < s.max[0] + 0.32 &&
        b.pos[2] > s.min[2] - 0.32 &&
        b.pos[2] < s.max[2] + 0.32 &&
        s.min[1] < b.pos[1] + 1.85 &&
        s.max[1] > b.pos[1] + 1.32,
    )
  )
    b.crouch = true;
  b.sprint = c.sprint && !b.crouch && !b.aim && c.z > 0 && b.reload <= 0;
  if (wasSprint && !b.sprint) b.sprintLock = RULES.sprintOut;
  else b.sprintLock = Math.max(0, b.sprintLock - dt);
  if (wasSprint && c.crouch && !wasCrouch && b.grounded) {
    b.slide = 0.55;
    b.vel[0] *= 1.3;
    b.vel[2] *= 1.3;
  }
  const speed = (b.sprint ? 7.5 : b.crouch ? 2.4 : 4.8) * (b.aim ? 0.6 : 1);
  const len = Math.max(1, Math.hypot(c.x, c.z));
  const vx = ((Math.cos(c.yaw) * c.x - Math.sin(c.yaw) * c.z) / len) * speed,
    vz = ((-Math.sin(c.yaw) * c.x - Math.cos(c.yaw) * c.z) / len) * speed;
  if (b.slide > 0) {
    b.slide -= dt;
    b.vel[0] *= Math.exp(-dt * 2);
    b.vel[2] *= Math.exp(-dt * 2);
  } else {
    const blend = 1 - Math.exp(-dt * (b.grounded ? 22 : 6));
    b.vel[0] += (vx - b.vel[0]) * blend;
    b.vel[2] += (vz - b.vel[2]) * blend;
  }
  if (c.jump && b.grounded) {
    b.vel[1] = 7;
    b.grounded = false;
    b.slide = 0;
  }
  b.vel[1] -= 21 * dt;
  const h = b.crouch ? 1.32 : 1.85,
    r = 0.32;
  for (const axis of [0, 2]) {
    b.pos[axis] += b.vel[axis] * dt;
    for (const s of arena.solids) {
      if (
        b.pos[0] + r <= s.min[0] ||
        b.pos[0] - r >= s.max[0] ||
        b.pos[2] + r <= s.min[2] ||
        b.pos[2] - r >= s.max[2] ||
        b.pos[1] + h <= s.min[1] + 0.001 ||
        b.pos[1] >= s.max[1] - 0.001
      )
        continue;
      const step = s.max[1] - b.pos[1];
      if (
        b.grounded &&
        step > 0 &&
        step <= 0.42 &&
        !arena.solids.some(
          (o) =>
            o !== s &&
            b.pos[0] + r > o.min[0] &&
            b.pos[0] - r < o.max[0] &&
            b.pos[2] + r > o.min[2] &&
            b.pos[2] - r < o.max[2] &&
            s.max[1] + h > o.min[1] &&
            s.max[1] < o.max[1],
        )
      ) {
        b.pos[1] = s.max[1];
        continue;
      }
      b.pos[axis] = b.vel[axis] > 0 ? s.min[axis] - r : s.max[axis] + r;
      b.vel[axis] = 0;
    }
  }
  const previousY = b.pos[1];
  b.pos[1] += b.vel[1] * dt;
  b.grounded = false;
  for (const s of arena.solids) {
    if (
      b.pos[0] + r <= s.min[0] ||
      b.pos[0] - r >= s.max[0] ||
      b.pos[2] + r <= s.min[2] ||
      b.pos[2] - r >= s.max[2]
    )
      continue;
    if (b.vel[1] <= 0 && previousY >= s.max[1] - 0.02 && b.pos[1] < s.max[1]) {
      b.pos[1] = s.max[1];
      b.vel[1] = 0;
      b.grounded = true;
    } else if (
      b.vel[1] > 0 &&
      previousY + h <= s.min[1] + 0.02 &&
      b.pos[1] + h > s.min[1]
    ) {
      b.pos[1] = s.min[1] - h;
      b.vel[1] = 0;
    }
  }
  if (b.pos[1] <= 0) {
    b.pos[1] = 0;
    b.vel[1] = 0;
    b.grounded = true;
  }
  b.pos[0] = clamp(b.pos[0], -30.9, 30.9);
  b.pos[2] = clamp(b.pos[2], -30.9, 30.9);
  b.ack = c.seq;
}
export function bulletDirections(s: Shot, index = 0): V3[] {
  const w = WEAPONS[s.weapon];
  return Array.from({ length: w.pellets }, (_, i) => {
    const p =
      w.pellets > 1
        ? PELLETS[i]
        : [
            index === 0 ? 0 : Math.sin(index * 2.399),
            index === 0 ? 0 : Math.cos(index * 2.399),
          ];
    const spread = w.spread * (s.aim ? (s.weapon === 2 ? 0.015 : 0.18) : 1);
    return aimDir(s.yaw + p[0] * spread, s.pitch + p[1] * spread);
  });
}
export function rayPlayer(b: Body, origin: V3, dir: V3, max: number) {
  const s = b.bot === "boss" ? 1.8 : 1,
    h = (b.crouch ? 1.32 : 1.85) * s,
    headSize = 0.5 * s;
  const [x, y, z] = b.pos;
  const head = rayBox(
    origin,
    dir,
    [x - 0.3 * s, y + h - headSize, z - 0.29 * s],
    [x + 0.3 * s, y + h, z + 0.29 * s],
    max,
  );
  const torso = rayBox(
    origin,
    dir,
    [x - 0.38 * s, y, z - 0.27 * s],
    [x + 0.38 * s, y + h - headSize, z + 0.27 * s],
    max,
  );
  if (head === null && torso === null) return null;
  return head !== null && (torso === null || head <= torso)
    ? { dist: head, head: true }
    : { dist: torso!, head: false };
}
interface Grenade {
  id: string;
  by: string;
  p: V3;
  v: V3;
  fuse: number;
  bounce: number;
}
export class Simulation {
  players = new Map<string, Body>();
  time = 0;
  remaining = 600;
  mode: Mode = "solo";
  wave = 0;
  waveRest = 2;
  ended = false;
  teamScores = [0, 0];
  events: GameEvent[] = [];
  grenades: Grenade[] = [];
  violations: { id: string; reason: string; time: number }[] = [];
  history: { time: number; players: Map<string, Body> }[] = [];
  private seenShots = new Map<string, number>();
  private reloadNode = new Map<string, number>();
  constructor(public arena: Arena) {}
  reconnect(id: string) {
    const b = this.players.get(id);
    if (b) {
      b.ack = 0;
      b.shotAck = 0;
    }
    this.seenShots.delete(id);
  }
  reject(id: string, reason: string) {
    this.violations.push({ id, reason, time: this.time });
    if (this.violations.length > 100) this.violations.shift();
    console.warn("[Brickfray authority]", id.slice(0, 8), reason);
  }
  add(id: string, name: string, color = 0) {
    const b = createBody(
      id,
      name,
      this.arena.spawns[this.players.size % this.arena.spawns.length],
      color,
    );
    b.team = this.players.size % 2;
    this.players.set(id, b);
    return b;
  }
  respawn(b: Body) {
    const score = {
      kills: b.kills,
      deaths: b.deaths,
      assists: b.assists,
      team: b.team,
      color: b.color,
      accessory: b.accessory,
      ack: b.ack,
      lastDeath: b.lastDeath,
    };
    Object.assign(
      b,
      createBody(
        b.id,
        b.name,
        chooseSpawn(this.arena, b, [...this.players.values()]),
        b.color,
      ),
      score,
    );
  }
  reload(b: Body) {
    const w = WEAPONS[b.weapon];
    if (b.hp <= 0 || b.reload > 0 || b.mags[b.weapon] >= w.mag || b.cook >= 0)
      return;
    b.reloadEmpty = b.mags[b.weapon] === 0;
    b.reload = b.reloadEmpty ? w.empty : w.tactical;
    b.action = "reload";
    b.actionTime = b.reload;
    this.reloadNode.set(b.id, 0);
    this.events.push({ type: "reload", by: b.id, pos: eye(b), value: 0 });
  }
  switch(b: Body, weapon: WeaponId) {
    if (!WEAPONS[weapon] || b.cook >= 0 || b.weapon === weapon) return;
    b.weapon = weapon;
    b.reload = 0;
    b.nextShot = Math.max(b.nextShot, this.time + WEAPONS[weapon].draw);
    b.shotIndex = 0;
    b.action = "switch";
    b.actionTime = WEAPONS[weapon].draw;
  }
  cook(b: Body) {
    if (b.hp > 0 && b.grenades > 0 && b.cook < 0) {
      b.cook = 0;
      b.grenades--;
      b.reload = 0;
    }
  }
  throw(b: Body, low = false) {
    if (b.cook < 0) return;
    const dir = aimDir(b.yaw, b.pitch),
      p = eye(b),
      speed = low ? 5 : 13;
    this.spawnGrenade(b, p, [
      dir[0] * speed,
      dir[1] * speed + (low ? 1 : 3),
      dir[2] * speed,
    ]);
    b.cook = -1;
    b.action = "grenade";
    b.actionTime = 0.5;
  }
  private spawnGrenade(b: Body, p: V3, v: V3) {
    const id = `${b.id}:${b.deaths}:${b.grenades}`;
    const fuse = RULES.grenadeFuse - b.cook;
    this.grenades.push({ id, by: b.id, p: [...p], v, fuse, bounce: 0 });
    this.events.push({
      type: "grenade",
      by: b.id,
      pos: [...p],
      dir: [...v],
      value: fuse,
      object: id,
      time: this.time,
    });
  }
  receiveGrenade(e: GameEvent, elapsed: number) {
    if (!e.object || !e.dir || this.grenades.some((g) => g.id === e.object))
      return;
    const g: Grenade = {
      id: e.object,
      by: e.by,
      p: [...e.pos],
      v: [...e.dir],
      fuse: e.value ?? 3,
      bounce: 0,
    };
    // Bring a delayed throw to its current visual position without applying damage.
    for (
      let left = Math.min(0.5, Math.max(0, elapsed));
      left > 0;
      left -= RULES.tick
    )
      this.moveGrenade(g, Math.min(RULES.tick, left));
    if (g.fuse > 0) this.grenades.push(g);
  }
  private moveGrenade(g: Grenade, dt: number) {
    g.fuse -= dt;
    g.v[1] -= 16 * dt;
    const speed = Math.hypot(...g.v),
      len = speed * dt;
    const dir = g.v.map((n) => n / Math.max(0.001, speed)) as V3;
    const hit = traceWorld(this.arena, g.p, dir, len);
    if (hit.solid && hit.dist < len) {
      g.p = hit.point.map((n, k) => n + hit.normal[k] * 0.08) as V3;
      const dot = g.v.reduce((s, v, k) => s + v * hit.normal[k], 0);
      g.v = g.v.map((n, k) => (n - 2 * dot * hit.normal[k]) * 0.58) as V3;
      return g.bounce++ < 8;
    }
    g.p = g.p.map((n, k) => n + g.v[k] * dt) as V3;
    return false;
  }
  advanceGrenades(dt: number, authority = true) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      if (this.moveGrenade(g, dt) && authority)
        this.events.push({ type: "bounce", by: g.by, pos: g.p });
      if (g.fuse > 0) continue;
      if (authority) {
        this.events.push({
          type: "explosion",
          by: g.by,
          pos: g.p,
          object: g.id,
        });
        for (const b of this.players.values()) {
          const e = eye(b),
            dist = distance(g.p, e);
          if (dist > 5) continue;
          const d = e.map((n, k) => (n - g.p[k]) / Math.max(dist, 0.001)) as V3;
          if (traceWorld(this.arena, g.p, d, dist).dist < dist - 0.25) continue;
          this.hurt(b, 100 * (1 - dist / 5), g.by, g.p, false, "grenade");
        }
      }
      this.grenades.splice(i, 1);
    }
  }
  melee(b: Body, prediction = false) {
    if (b.hp <= 0 || b.melee > 0) return;
    b.melee = RULES.meleeCooldown;
    b.reload = 0;
    b.action = "melee";
    b.actionTime = 0.4;
    const from = eye(b),
      dir = aimDir(b.yaw, 0);
    this.events.push({ type: "melee", by: b.id, pos: from });
    if (prediction) return;
    for (const target of this.players.values()) {
      if (
        target === b ||
        target.hp <= 0 ||
        (this.mode === "tdm" && target.team === b.team)
      )
        continue;
      const dx = target.pos[0] - b.pos[0],
        dz = target.pos[2] - b.pos[2],
        dist = Math.hypot(dx, dz);
      if (
        dist > 2 ||
        Math.abs(target.pos[1] - b.pos[1]) > 1.5 ||
        (dx * dir[0] + dz * dir[2]) / Math.max(0.01, dist) < 0.45
      )
        continue;
      const td = aimDir(target.yaw, 0),
        back = (dx * td[0] + dz * td[2]) / Math.max(dist, 0.01) > 0.55;
      const d = aimDir(Math.atan2(-dx, -dz), 0);
      if (traceWorld(this.arena, from, d, dist).dist < dist - 0.35) continue;
      this.hurt(target, back ? 100 : 55, b.id, from, false, "melee");
    }
  }
  fire(b: Body, s: Shot, hostTime = this.time) {
    const deny = (reason: string) => {
      this.reject(b.id, reason);
      this.events.push({
        type: "hit",
        by: b.id,
        pos: eye(b),
        shot: s.id,
        accepted: false,
      });
      return false;
    };
    if (
      !Number.isFinite(s.id) ||
      !Number.isFinite(s.time) ||
      !Number.isFinite(s.yaw) ||
      !Number.isFinite(s.pitch) ||
      !WEAPONS[s.weapon]
    )
      return deny("malformed shot");
    if (s.id <= (this.seenShots.get(b.id) ?? -1)) return false;
    this.seenShots.set(b.id, s.id);
    b.shotAck = s.id;
    if (
      b.hp <= 0 ||
      this.ended ||
      s.weapon !== b.weapon ||
      b.sprint ||
      b.sprintLock > 0 ||
      b.cook >= 0 ||
      b.melee > 0.45
    )
      return deny("invalid firing state");
    if (s.time > hostTime + 0.08 || s.time < hostTime - 0.35)
      return deny("shot outside time window");
    // Validate the firing clock, not packet arrival: jitter may deliver two
    // correctly spaced shots during the same host tick.
    if (s.time + 0.003 < b.nextShot || b.mags[b.weapon] <= 0)
      return deny("fire rate or magazine");
    if (b.reload > 0) {
      if (b.weapon !== 1) return deny("reload in progress");
      b.reload = 0;
    }
    const w = WEAPONS[b.weapon];
    const continuing = s.time - b.lastShot <= 0.28;
    if (!continuing) b.shotIndex = 0;
    b.mags[b.weapon]--;
    b.nextShot =
      (w.kind === "auto" && continuing ? b.nextShot : s.time) + 60 / w.rpm;
    b.lastShot = s.time;
    b.action = "shot";
    b.actionTime = 0.2;
    const from = eye(b),
      rewind = clamp(s.time - 0.1, this.time - RULES.rewind / 1000, this.time);
    let targets = this.history[0]?.players || this.players;
    for (const frame of this.history) {
      if (frame.time <= rewind) targets = frame.players;
      else break;
    }
    const damage = new Map<
      string,
      { amount: number; head: boolean; pos: V3 }
    >();
    for (const dir of bulletDirections(s, b.shotIndex)) {
      const wall = traceWorld(this.arena, from, dir);
      let nearest = wall.dist,
        victim: Body | undefined,
        head = false;
      for (const t of targets.values()) {
        if (
          t.id === b.id ||
          t.hp <= 0 ||
          (this.mode === "tdm" && t.team === b.team)
        )
          continue;
        const hit = rayPlayer(t, from, dir, nearest);
        if (hit && hit.dist < nearest) {
          victim = this.players.get(t.id);
          nearest = hit.dist;
          head = hit.head;
        }
      }
      const pos = from.map((v, i) => v + dir[i] * nearest) as V3;
      this.events.push({
        type: "shot",
        by: b.id,
        pos,
        dir,
        weapon: b.weapon,
        shot: s.id,
      });
      if (victim) {
        const prev = damage.get(victim.id);
        damage.set(victim.id, {
          amount: (prev?.amount || 0) + damageAt(b.weapon, nearest, head),
          head: head || !!prev?.head,
          pos,
        });
      }
    }
    b.shotIndex++;
    for (const [id, d] of damage) {
      const target = this.players.get(id)!;
      this.hurt(target, d.amount, b.id, from, d.head, "gun", s.id);
    }
    this.events.push({
      type: "hit",
      by: b.id,
      pos: from,
      shot: s.id,
      accepted: true,
      amount: damage.size,
    });
    return true;
  }
  hurt(
    b: Body,
    amount: number,
    by: string,
    from: V3,
    head = false,
    source = "gun",
    shot?: number,
  ) {
    if (b.hp <= 0 || b.protection > 0) return;
    if (
      this.mode === "tdm" &&
      this.players.get(by)?.team === b.team &&
      by !== b.id
    )
      return;
    b.hp = Math.max(0, b.hp - amount);
    b.damageBy[by] = this.time;
    b.action = "hit";
    b.actionTime = 0.12;
    const dir = b.pos.map((v, i) => v - from[i]) as V3;
    const len = Math.max(0.01, Math.hypot(...dir));
    b.vel[0] += (dir[0] / len) * 0.4;
    b.vel[2] += (dir[2] / len) * 0.4;
    this.events.push({
      type: "hit",
      by,
      target: b.id,
      pos: from,
      amount,
      head,
      shot,
      source,
    });
    if (b.hp <= 0) {
      b.deaths++;
      b.dead = RULES.respawn;
      b.lastDeath = [...b.pos];
      if (b.cook >= 0) {
        this.spawnGrenade(b, eye(b), [0, 0, 0]);
        b.cook = -1;
      }
      const killer = this.players.get(by);
      if (killer && killer !== b) {
        killer.kills++;
        this.teamScores[killer.team]++;
      }
      for (const [id, time] of Object.entries(b.damageBy)) {
        if (id !== by && this.time - time < 5) {
          const p = this.players.get(id);
          if (p) p.assists++;
        }
      }
      this.events.push({
        type: "death",
        by,
        target: b.id,
        pos: [...b.pos],
        dir: dir.map((v) => v / len) as V3,
        weapon: killer?.weapon,
        head,
        source,
      });
      if (
        (this.mode === "ffa" && (killer?.kills || 0) >= 30) ||
        (this.mode === "tdm" && this.teamScores.some((s) => s >= 50))
      )
        this.ended = true;
    }
  }
  tick(inputs: Map<string, Command>, dt = RULES.tick) {
    if (this.ended) return;
    this.time += dt;
    if (this.mode !== "solo") {
      this.remaining -= dt;
      if (this.remaining <= 0) this.ended = true;
    }
    for (const b of this.players.values()) {
      if (b.hp <= 0) {
        if (b.bot) continue;
        b.dead = Math.max(0, b.dead - dt);
        if (b.dead === 0 && this.mode !== "solo") this.respawn(b);
        continue;
      }
      const c = inputs.get(b.id);
      if (c) moveBody(b, c, this.arena, dt);
      b.protection = Math.max(0, b.protection - dt);
      b.melee = Math.max(0, b.melee - dt);
      b.actionTime = Math.max(0, b.actionTime - dt);
      if (b.actionTime === 0) b.action = "idle";
      if (b.cook >= 0) {
        b.cook += dt;
        if (b.cook >= RULES.maxCook) this.throw(b, false);
      }
      if (b.reload > 0) {
        const w = WEAPONS[b.weapon],
          total = b.reloadEmpty ? w.empty : w.tactical;
        const before = 1 - b.reload / total;
        b.reload = Math.max(0, b.reload - dt);
        const progress = 1 - b.reload / total;
        for (const [i, at] of [0.18, 0.63, 0.86].entries()) {
          if (before < at && progress >= at && (i < 2 || b.reloadEmpty)) {
            this.events.push({
              type: "reload",
              by: b.id,
              pos: eye(b),
              value: i + 1,
            });
          }
        }
        if (b.reload === 0) {
          if (b.weapon === 1) {
            b.mags[1]++;
            if (b.mags[1] < w.mag) this.reload(b);
          } else b.mags[b.weapon] = w.mag;
        }
      }
    }
    this.advanceGrenades(dt);
    this.history.push({
      time: this.time,
      players: new Map(
        [...this.players].map(([id, b]) => [id, { ...b, pos: [...b.pos] }]),
      ),
    });
    while (this.history.length > 15) this.history.shift();
  }
  bots(dt: number) {
    const inputs = new Map<string, Command>();
    const humans = [...this.players.values()].filter((b) => !b.bot && b.hp > 0);
    for (const b of this.players.values()) {
      if (!b.bot || b.hp <= 0 || !humans.length) continue;
      const target = humans.reduce((a, c) =>
          distance(a.pos, b.pos) < distance(c.pos, b.pos) ? a : c,
        ),
        from = eye(b),
        to = eye(target),
        dx = to[0] - from[0],
        dy = to[1] - from[1],
        dz = to[2] - from[2],
        dist = Math.hypot(dx, dz);
      const yaw = Math.atan2(-dx, -dz),
        pitch = Math.atan2(dy, dist);
      const visible =
        traceWorld(this.arena, from, aimDir(yaw, pitch), dist).dist >=
        dist - 0.5;
      inputs.set(b.id, {
        seq: b.ack + 1,
        x: !visible
          ? Math.sin(this.time + b.color) > 0.0
            ? 1
            : -1
          : Math.sin(this.time + b.color) * 0.4,
        z: dist > (b.bot === "sniper" ? 18 : 6) ? 1 : 0,
        yaw,
        pitch,
        jump: !visible && Math.sin(this.time * 2) > 0.98,
        crouch: false,
        sprint: b.bot === "rusher",
        aim: b.bot === "sniper",
      });
      if (b.mags[b.weapon] === 0) this.reload(b);
      if (
        visible &&
        this.time > b.nextShot &&
        b.reload === 0 &&
        b.protection === 0
      ) {
        if (b.bot === "rusher" && dist < 2) this.melee(b);
        else {
          b.sprint = false;
          b.sprintLock = 0;
          this.fire(b, {
            id: Math.round(this.time * 10000),
            time: this.time,
            weapon: b.weapon,
            yaw: yaw + Math.sin(this.time * 5 + b.color) * 0.035,
            pitch,
            aim: true,
          });
          b.nextShot =
            this.time +
            (b.bot === "boss" ? 0.22 : b.bot === "sniper" ? 2.2 : 0.65);
        }
      }
    }
    return inputs;
  }
  waves() {
    const alive = [...this.players.values()].filter((b) => b.bot && b.hp > 0);
    if (alive.length) return;
    this.waveRest -= RULES.tick;
    if (this.waveRest > 0) return;
    for (const [id, b] of this.players) if (b.bot) this.players.delete(id);
    this.wave++;
    this.waveRest = 5;
    const count = Math.min(14, 2 + this.wave * 2);
    for (let i = 0; i < count; i++) {
      const b = this.add(`bot-${this.wave}-${i}`, "Snapbot", i % 10);
      b.bot =
        this.wave % 5 === 0 && i === 0
          ? "boss"
          : i % 3 === 1
            ? "rusher"
            : this.wave >= 3 && i % 3 === 2
              ? "sniper"
              : "grunt";
      b.weapon = b.bot === "sniper" ? 2 : 0;
      b.hp = b.bot === "boss" ? 600 : 100;
      b.pos = chooseSpawn(this.arena, b, [...this.players.values()]);
      b.accessory = b.bot === "sniper" ? 2 : b.bot === "rusher" ? 1 : 0;
    }
  }
}
