import { WEAPONS } from '../weapons/defs';
import { copyArms, createArms, stepArms, type ArmsHooks } from '../sim/arms';
import { LOADOUTS } from '../weapons/loadouts';
import type { CollisionWorld } from '../sim/collision';
import { TICK } from '../sim/constants';
import { cmdToMove } from '../sim/host';
import { copyMoveState, createMoveState, stepMove } from '../sim/movement';
import type { Command, PlayerState } from '../sim/types';
import type { SelfState } from '../net/codec';

/**
 * The local player runs ahead of the host: every command is simulated
 * immediately, kept until acknowledged, and replayed on top of each
 * authoritative snapshot. Small corrections are blended out visually.
 */
export class Predictor {
  readonly player: PlayerState;
  private pending: Command[] = [];
  /** Visual offset left by a correction; decays to zero. */
  readonly smoothing = { x: 0, y: 0, z: 0 };
  corrections = 0;

  constructor(
    private readonly world: CollisionWorld,
    id: number,
    character: PlayerState['character']
  ) {
    this.player = {
      id,
      name: '',
      character,
      bot: null,
      team: -1,
      move: createMoveState(),
      yaw: 0,
      pitch: 0,
      arms: createArms(LOADOUTS[character]),
      health: 100,
      maxHealth: 100,
      alive: false,
      respawnAt: 0,
      protectedUntil: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      ping: 0,
      damagers: new Map(),
      lastSeq: 0,
      life: 0,
      scale: 1
    };
  }

  /** Run one new command with effects, and remember it for replays. */
  apply(cmd: Command, hooks: ArmsHooks) {
    this.pending.push(cmd);
    if (this.pending.length > 180) this.pending.shift();
    this.simulate(cmd, hooks);
  }

  private simulate(cmd: Command, hooks: ArmsHooks | null) {
    const p = this.player;
    if (!p.alive) return;
    p.yaw = cmd.yaw;
    p.pitch = cmd.pitch;
    stepMove(this.world, p.move, cmdToMove(cmd), TICK, WEAPONS[p.arms.weapon].moveScale);
    stepArms(p, cmd, TICK, hooks);
  }

  /** Commands not yet acknowledged, oldest first (sent redundantly each packet). */
  unacked(max: number) {
    return this.pending.slice(-max);
  }

  reconcile(ack: number, self: SelfState) {
    const p = this.player;
    const wasAlive = p.alive;
    this.pending = this.pending.filter((c) => c.seq > ack);
    p.health = self.health;
    if (!self.alive) {
      p.alive = false;
      return;
    }
    const before = { x: p.move.x, y: p.move.y, z: p.move.z };
    copyMoveState(self.move, p.move);
    // Effects already played; keep the locally predicted fire counter so remote-style triggers don't double up.
    const shots = p.arms.shots;
    copyArms(self.arms, p.arms);
    p.arms.shots = shots;
    p.alive = true;
    for (const cmd of this.pending) this.simulate(cmd, null);
    if (!wasAlive) {
      this.smoothing.x = this.smoothing.y = this.smoothing.z = 0;
      return;
    }
    const ex = before.x - p.move.x;
    const ey = before.y - p.move.y;
    const ez = before.z - p.move.z;
    const error = Math.hypot(ex, ey, ez);
    if (error > 0.002) this.corrections++;
    if (error < 1.5) {
      this.smoothing.x += ex;
      this.smoothing.y += ey;
      this.smoothing.z += ez;
    } else {
      this.smoothing.x = this.smoothing.y = this.smoothing.z = 0;
    }
  }

  decaySmoothing(dt: number) {
    const k = Math.exp(-dt * 14);
    this.smoothing.x *= k;
    this.smoothing.y *= k;
    this.smoothing.z *= k;
  }

  /** Respawn or first spawn: take the host's state as is. */
  reset(self: SelfState) {
    copyMoveState(self.move, this.player.move);
    this.player.arms = copyArms(self.arms, createArms());
    this.player.alive = self.alive;
    this.player.health = self.health;
    this.player.life = self.life;
    this.pending = [];
  }
}
