import type { BotKind, CharacterId } from '../characters/types';
import { CHARACTER_IDS } from '../characters/roster';
import { BotDirector } from './bots';
import { MATCH, PLAYER } from './constants';
import { HostSim } from './host';
import type { MapLayout } from '../world/types';
import type { Difficulty, MatchSettings, MatchState, PlayerState } from './types';

const WARMUP = 4;
const WAVE_BREAK = 7;
const RESULTS = 12;
interface Ramp {
  /** [wave 1, added per wave, cap] */
  skill: [number, number, number];
  damage: [number, number, number];
  /** [base, added per wave] */
  count: [number, number];
  /** [wave 1, cap] snapbots on the field at once. */
  alive: [number, number];
  /** Share of max health restored between waves. */
  heal: number;
}

const RAMP: Record<Difficulty, Ramp> = {
  easy: { skill: [0.05, 0.05, 0.6], damage: [0.2, 0.025, 0.45], count: [2, 1.2], alive: [2, 6], heal: 1 },
  normal: { skill: [0.18, 0.07, 0.9], damage: [0.3, 0.04, 0.65], count: [3, 1.6], alive: [3, 8], heal: 1 },
  hard: { skill: [0.4, 0.07, 1], damage: [0.45, 0.05, 0.9], count: [4, 2.2], alive: [4, 10], heal: 0.5 }
};

/** How hard a solo wave is: bot aim, bot damage to the player, wave size and how many fight at once. */
export function waveTuning(difficulty: Difficulty, wave: number) {
  const r = RAMP[difficulty];
  const step = wave - 1;
  return {
    skill: Math.min(r.skill[2], r.skill[0] + r.skill[1] * step),
    damage: Math.min(r.damage[2], r.damage[0] + r.damage[1] * step),
    count: Math.floor(r.count[0] + r.count[1] * wave),
    alive: Math.min(r.alive[1], r.alive[0] + step),
    spawnEvery: Math.max(0.5, 1.4 - 0.08 * step),
    heal: r.heal
  };
}

const BOT_NAMES = ['Bolt', 'Pixel', 'Widget', 'Sprocket', 'Gizmo', 'Ratchet', 'Clicky', 'Dynamo', 'Fuse', 'Cog'];
const SNAPBOT_NAMES: Record<BotKind, string> = { grunt: 'Snapbot', rusher: 'Zipbot', sniper: 'Scopebot', boss: 'Megabot' };

/** Mode rules around the host simulation: warmup, scoring, respawns, waves and the end of a match. */
export class Match {
  readonly sim: HostSim;
  readonly bots: BotDirector;
  state: MatchState = { phase: 'warmup', phaseEnds: 0, teamScore: [0, 0], wave: 0, winner: null };
  private waveQueue: BotKind[] = [];
  private waveSpawnTimer = 0;
  private wave = waveTuning('normal', 1);

  constructor(layout: MapLayout, readonly settings: MatchSettings, seed?: number) {
    this.sim = new HostSim(layout, settings, seed);
    this.bots = new BotDirector(this.sim);
    this.sim.onKill = (victim, killer) => this.onKill(victim, killer);
  }

  get time() {
    return this.sim.time;
  }

  start() {
    this.state = { phase: 'warmup', phaseEnds: this.time + WARMUP, teamScore: [0, 0], wave: 0, winner: null };
    this.sim.damageEnabled = false;
    if (this.settings.mode !== 'solo') {
      for (let i = 0; i < this.settings.bots; i++) this.addBot();
    }
    for (const p of this.sim.players.values()) this.sim.spawn(p);
  }

  addHuman(name: string, character: CharacterId): PlayerState {
    const p = this.sim.addPlayer(name, character, null, this.teamFor());
    if (this.settings.mode !== 'solo' && this.humans().length + this.botCount() > MATCH.maxPlayers) this.dropBot();
    if (this.state.phase === 'warmup' || this.state.phase === 'playing') this.sim.spawn(p);
    return p;
  }

  remove(id: number) {
    this.bots.remove(id);
    this.sim.removePlayer(id);
  }

  private humans() {
    return [...this.sim.players.values()].filter((p) => !p.bot);
  }

  private botCount() {
    return [...this.sim.players.values()].filter((p) => p.bot).length;
  }

  private teamFor(): 0 | 1 | -1 {
    if (this.settings.mode !== 'tdm') return -1;
    let a = 0;
    let b = 0;
    for (const p of this.sim.players.values()) {
      if (p.team === 0) a++;
      else if (p.team === 1) b++;
    }
    return a <= b ? 0 : 1;
  }

  private addBot(kind: BotKind = 'grunt') {
    const solo = this.settings.mode === 'solo';
    const index = this.sim.players.size;
    const name = solo ? SNAPBOT_NAMES[kind] : BOT_NAMES[index % BOT_NAMES.length]!;
    const look: CharacterId | BotKind = solo ? kind : CHARACTER_IDS[index % CHARACTER_IDS.length]!;
    const bot = this.sim.addPlayer(name, look, kind, this.teamFor());
    this.bots.add(bot);
    return bot;
  }

  private dropBot() {
    const bot = [...this.sim.players.values()].reverse().find((p) => p.bot);
    if (bot) this.remove(bot.id);
  }

  private onKill(victim: PlayerState, killer: PlayerState | null) {
    if (this.settings.mode === 'tdm' && killer && killer.team !== -1) this.state.teamScore[killer.team]++;
    if (this.settings.mode === 'solo') {
      if (victim.bot) {
        victim.respawnAt = this.time + 1.5;
      } else {
        this.end(null);
      }
      return;
    }
    victim.respawnAt = this.time + PLAYER.respawnDelay;
    const limit = this.settings.mode === 'ffa' ? MATCH.ffaKills : MATCH.tdmKills;
    if (this.settings.mode === 'ffa' && killer && killer.kills >= limit) this.end(killer.id);
    if (this.settings.mode === 'tdm') {
      const [a, b] = this.state.teamScore;
      if (a >= limit) this.end(0);
      else if (b >= limit) this.end(1);
    }
  }

  private end(winner: number | null) {
    if (this.state.phase === 'ended') return;
    this.state.phase = 'ended';
    this.state.phaseEnds = this.time + RESULTS;
    this.state.winner = winner;
    this.sim.damageEnabled = false;
  }

  private leader(): number | null {
    if (this.settings.mode === 'tdm') {
      const [a, b] = this.state.teamScore;
      return a === b ? null : a > b ? 0 : 1;
    }
    let best: PlayerState | null = null;
    for (const p of this.sim.players.values()) if (!best || p.kills > best.kills) best = p;
    return best?.id ?? null;
  }

  private startWave() {
    const wave = ++this.state.wave;
    this.sim.events.push({ type: 'wave', wave });
    this.wave = waveTuning(this.settings.difficulty, wave);
    this.bots.skill = this.wave.skill;
    this.sim.botDamage = this.wave.damage;
    // Rushers join from wave 2 and snipers from wave 3, each taking a growing share; every fifth wave adds bosses.
    const rushers = wave >= 2 ? Math.min(4, wave) : 0;
    const snipers = wave >= 3 ? Math.min(2, wave - 2) : 0;
    const queue: BotKind[] = [];
    for (let i = 0; i < this.wave.count; i++) {
      const r = (i * 7 + wave * 3) % 10;
      queue.push(r < rushers ? 'rusher' : r >= 10 - snipers ? 'sniper' : 'grunt');
    }
    if (wave % 5 === 0) for (let i = 0; i < wave / 5; i++) queue.push('boss');
    this.waveQueue = queue;
    this.waveSpawnTimer = 0;
  }

  /** Advance one host tick. */
  tick(dt: number) {
    const s = this.state;
    this.bots.tick();
    this.sim.tick(dt);
    if (s.phase === 'warmup' && this.time >= s.phaseEnds) {
      s.phase = 'playing';
      s.phaseEnds = this.settings.mode === 'solo' ? 0 : this.time + this.settings.minutes * 60;
      this.sim.damageEnabled = true;
      if (this.settings.mode === 'solo') this.startWave();
    }
    if (s.phase === 'playing') {
      if (s.phaseEnds && this.time >= s.phaseEnds) this.end(this.leader());
      if (this.settings.mode !== 'solo') {
        for (const p of this.sim.players.values()) if (!p.alive && this.time >= p.respawnAt) this.sim.spawn(p);
      } else {
        this.tickWaves(dt);
      }
    }
    if (s.phase === 'intermission' && this.time >= s.phaseEnds) {
      s.phase = 'playing';
      s.phaseEnds = 0;
      this.startWave();
    }
  }

  private tickWaves(dt: number) {
    for (const p of [...this.sim.players.values()]) if (p.bot && !p.alive && this.time >= p.respawnAt) this.remove(p.id);
    const alive = [...this.sim.players.values()].filter((p) => p.bot && p.alive).length;
    this.waveSpawnTimer -= dt;
    if (this.waveQueue.length && alive < this.wave.alive && this.waveSpawnTimer <= 0) {
      this.waveSpawnTimer = this.wave.spawnEvery;
      const bot = this.addBot(this.waveQueue.shift()!);
      this.sim.spawn(bot);
    }
    if (!this.waveQueue.length && alive === 0 && this.botCount() === 0) {
      this.state.phase = 'intermission';
      this.state.phaseEnds = this.time + WAVE_BREAK;
      for (const p of this.sim.players.values()) {
        p.health = Math.min(p.maxHealth, p.health + p.maxHealth * this.wave.heal);
        p.arms.grenades = Math.min(4, p.arms.grenades + 1);
      }
    }
  }

  get resultsOver() {
    return this.state.phase === 'ended' && this.time >= this.state.phaseEnds;
  }
}
