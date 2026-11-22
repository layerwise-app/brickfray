import { GRACE } from './bot-fight';
import type { BotProfile } from './bot-profile';
import type { Spot } from './bot-roam';
import { PLAYER } from './constants';
import type { HostSim } from './host';
import type { PlayerState } from './types';

/** What a bot knows of its enemies: who it fights, how long it has seen or lost them, its aim error, and who hurt it. */
export interface SenseState {
  target: number;
  seenFor: number;
  lostFor: number;
  lastSeen: Spot | null;
  errYaw: number;
  errPitch: number;
  /** Seconds to the next look round. */
  think: number;
  /** Damage each enemy has done it this life as last counted, and the host time each last hurt it. */
  dealt: Map<number, number>;
  hurtAt: Map<number, number>;
}

/** A bot trading shots with an enemy that hurt it this recently (s) finishes that fight before turning to a new attacker. */
const TRADING = 1.5;

/** Bot senses: sight (range, a narrower cone behind, a clear line), being hit, and settling on a target. */
export class BotSense {
  constructor(
    private readonly host: HostSim,
    private readonly random: () => number,
    private readonly saw: (at: Spot) => void
  ) {}

  /** Chest height of `target` as it stood `lag` seconds ago. */
  aimPoint(target: PlayerState, lag = 0): [number, number, number] {
    const at = lag > 0 ? this.host.poseAt(target, this.host.time - lag) : null;
    const m = at ?? target.move;
    const head = m.y + (PLAYER.eye + (PLAYER.crouchEye - PLAYER.eye) * m.crouch) * target.scale;
    return [m.x, head - 0.35 * target.scale, m.z];
  }

  perceive(bot: PlayerState, b: SenseState, eye: [number, number, number], prof: BotProfile, skill: number) {
    const host = this.host;
    let best: PlayerState | null = null;
    let bestScore = Infinity;
    for (const p of host.players.values()) {
      if (!p.alive || !host.hostile(bot, p)) continue;
      const aim = this.aimPoint(p);
      const d = Math.hypot(aim[0] - eye[0], aim[2] - eye[2]);
      if (d > prof.range) continue;
      // A narrower awareness cone behind the bot unless the target is close or shooting.
      const facing = Math.cos(wrap(Math.atan2(-(aim[0] - eye[0]), -(aim[2] - eye[2])) - bot.yaw));
      if (facing < -0.2 && d > 6 && p.arms.sinceShot > 0.5) continue;
      if (!host.world.clearLine(eye[0], eye[1], eye[2], aim[0], aim[1], aim[2])) continue;
      const score = d - (p.id === b.target ? 6 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      if (best.id !== b.target) this.lockOn(b, best.id, prof, skill);
      b.lostFor = 0;
      b.lastSeen = [best.move.x, best.move.y, best.move.z];
      this.saw(b.lastSeen);
    } else if (b.target) {
      b.lostFor += 0.2;
      if (b.lostFor > 4) this.forget(b);
    }
  }

  /** Hits from an enemy it isn't fighting turn it toward them: it knows where the shots came from. */
  feelHits(bot: PlayerState, b: SenseState, prof: BotProfile, skill: number) {
    let from = 0;
    for (const [id, dealt] of bot.damagers) {
      if (dealt <= (b.dealt.get(id) ?? 0)) continue;
      b.dealt.set(id, dealt);
      b.hurtAt.set(id, this.host.time);
      from = id;
    }
    if (!from || from === b.target) return;
    const attacker = this.host.players.get(from);
    if (!attacker?.alive || !this.host.hostile(bot, attacker)) return;
    if (b.target && b.lostFor === 0 && this.host.time - (b.hurtAt.get(b.target) ?? -99) < TRADING) return;
    this.lockOn(b, from, prof, skill);
    b.lostFor = 0.2;
    b.lastSeen = [attacker.move.x, attacker.move.y, attacker.move.z];
    b.think = 0;
  }

  forget(b: SenseState) {
    b.target = 0;
    b.seenFor = 0;
    b.lostFor = 99;
    b.lastSeen = null;
  }

  /** Fix on an enemy: a bot already in a fight swings onto the next one faster than it notices a first. */
  private lockOn(b: SenseState, id: number, prof: BotProfile, skill: number) {
    const inFight = b.target !== 0 && b.lostFor <= GRACE;
    b.target = id;
    b.seenFor = inFight ? Math.min(b.seenFor, prof.reaction * 0.5) : 0;
    const miss = (1 - skill) * 0.25 + 0.03;
    b.errYaw = (this.random() - 0.5) * miss * 2;
    b.errPitch = (this.random() - 0.5) * miss;
  }
}

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
