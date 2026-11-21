import type { BotKind, CharacterId } from '../characters/types';
import { CHARACTER_IDS } from '../characters/roster';
import { fillMagazines } from './arms';
import { BotDirector } from './bots';
import { MATCH, PLAYER } from './constants';
import { HostSim } from './host';
import type { MapLayout } from '../world/types';
import type { Difficulty, HostPlayer, MatchSettings, MatchState } from './types';
import { drawOffer, takeUpgrade, type UpgradeId } from './upgrades';

const WARMUP = 4;
/** Seconds from the upgrade pick (or a wave with nothing left to pick) to the next wave. */
const WAVE_BREAK = 5;
/** Seconds the upgrade cards wait before taking the first card for a player who doesn't choose. */
export const PICK_TIME = 30;
const RESULTS = 12;
interface Ramp {
  /** [wave 1, added per wave, cap] */
  skill: [number, number, number];
  damage: [number, number, number];
  /** [base, added per wave] */
  count: [number, number];
  /** [wave 1, added per wave, cap] snapbots on the field at once. */
  alive: [number, number, number];
  /** Share of max health restored between waves. */
  heal: number;
}

// Wave 1 is as it always was; the climb after it is gentler so the upgrades taken between waves can keep up.
const RAMP: Record<Difficulty, Ramp> = {
  easy: { skill: [0.05, 0.04, 0.6], damage: [0.2, 0.02, 0.45], count: [2, 1.2], alive: [2, 0.5, 6], heal: 1 },
  normal: { skill: [0.18, 0.05, 0.9], damage: [0.3, 0.03, 0.65], count: [3, 1.6], alive: [3, 0.6, 8], heal: 1 },
  hard: { skill: [0.4, 0.06, 1], damage: [0.45, 0.04, 0.9], count: [4, 2.2], alive: [4, 0.7, 10], heal: 0.5 }
};

/** From this wave on, aim and damage keep climbing past their caps, so even a fully upgraded run comes to an end. */
const LATE = 10;

/** How hard a solo wave is: bot aim, bot damage to the player, wave size and how many fight at once. */
export function waveTuning(difficulty: Difficulty, wave: number) {
  const r = RAMP[difficulty];
  const step = wave - 1;
  const late = Math.max(0, wave - LATE);
  return {
    skill: Math.min(1, Math.min(r.skill[2], r.skill[0] + r.skill[1] * step) + 0.02 * late),
    damage: Math.min(r.damage[2], r.damage[0] + r.damage[1] * step) * (1 + 0.05 * late),
    count: Math.floor(r.count[0] + r.count[1] * wave),
    alive: Math.min(r.alive[2], r.alive[0] + Math.floor(r.alive[1] * step)),
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
  /** Solo: the cards each player still has to pick from. */
  private offers = new Map<number, UpgradeId[]>();
  private readonly seed: number;

  constructor(layout: MapLayout, readonly settings: MatchSettings, seed = Math.floor(Math.random() * 4294967296)) {
    this.seed = seed >>> 0;
    this.sim = new HostSim(layout, settings, seed);
    this.bots = new BotDirector(this.sim);
    this.sim.onKill = (victim, killer) => this.onKill(victim, killer);
  }

  get time() {
    return this.sim.time;
  }

  start() {
    this.state = { phase: 'warmup', phaseEnds: this.time + WARMUP, teamScore: [0, 0], wave: 0, winner: null };
    this.offers.clear();
    this.sim.damageEnabled = false;
    if (this.settings.mode !== 'solo') {
      for (let i = 0; i < this.settings.bots; i++) this.addBot();
    }
    for (const p of this.sim.players.values()) this.sim.spawn(p);
  }

  addHuman(name: string, character: CharacterId): HostPlayer {
    const p = this.sim.addPlayer(name, character, null, this.teamFor());
    if (this.settings.mode !== 'solo' && this.humans().length + this.botCount() > MATCH.maxPlayers) this.dropBot();
    if (this.state.phase === 'warmup' || this.state.phase === 'playing') this.sim.spawn(p);
    return p;
  }

  remove(id: number) {
    this.offers.delete(id);
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

  private onKill(victim: HostPlayer, killer: HostPlayer | null) {
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
    let best: HostPlayer | null = null;
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
      if (this.offers.size) {
        for (const [id, options] of [...this.offers]) this.pickUpgrade(id, options[0]!, true);
      } else {
        s.phase = 'playing';
        s.phaseEnds = 0;
        this.startWave();
      }
    }
  }

  /** The player takes one of the cards they were dealt; the next wave comes once everyone has. */
  pickUpgrade(playerId: number, id: UpgradeId, auto = false): boolean {
    const options = this.offers.get(playerId);
    const player = this.sim.players.get(playerId);
    if (!options || !player || !options.includes(id)) return false;
    this.offers.delete(playerId);
    takeUpgrade(player, id);
    this.sim.events.push({ type: 'upgrade', player: playerId, id, level: player.upgrades[id], auto });
    if (!this.offers.size && this.state.phase === 'intermission') this.state.phaseEnds = this.time + WAVE_BREAK;
    return true;
  }

  /** Between waves: refill health (by difficulty), every magazine and the grenades, then deal each player three upgrade cards. */
  private clearWave() {
    const s = this.state;
    s.phase = 'intermission';
    for (const p of this.sim.players.values()) {
      if (p.bot || !p.alive) continue;
      p.health = Math.min(p.maxHealth, p.health + p.maxHealth * this.wave.heal);
      fillMagazines(p.arms);
      p.arms.grenades = p.arms.grenadeMax;
      p.arms.grenadeTimer = 0;
      const options = drawOffer(p.upgrades, this.seed + p.id * 7919, s.wave);
      if (!options.length) continue;
      this.offers.set(p.id, options);
      this.sim.events.push({ type: 'upgradeOffer', player: p.id, wave: s.wave, options, levels: { ...p.upgrades } });
    }
    s.phaseEnds = this.time + (this.offers.size ? PICK_TIME : WAVE_BREAK);
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
    if (!this.waveQueue.length && alive === 0 && this.botCount() === 0) this.clearWave();
  }

  get resultsOver() {
    return this.state.phase === 'ended' && this.time >= this.state.phaseEnds;
  }
}
