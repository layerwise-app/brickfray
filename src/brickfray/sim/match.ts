import type { BotKind, CharacterId } from '../characters/types';
import { CHARACTER_IDS } from '../characters/roster';
import { fillMagazines } from './arms';
import { BotDirector } from './bots';
import { MATCH, PLAYER, REGEN } from './constants';
import { HostSim } from './host';
import type { MapLayout } from '../world/types';
import { Streaks } from './streaks';
import type { GameEvent, HostPlayer, KillCause, MatchSettings, MatchState } from './types';
import { drawOffer, idleCards, takeUpgrade, type UpgradeId } from './upgrades';
import { WAVE_BREAK, waveRoster, waveTuning } from './waves';

const WARMUP = 4;
/** Seconds the upgrade cards wait before taking the first card for a player who doesn't choose. */
export const PICK_TIME = 30;
const RESULTS = 12;
const BOT_NAMES = ['Bolt', 'Pixel', 'Widget', 'Sprocket', 'Gizmo', 'Ratchet', 'Clicky', 'Dynamo', 'Fuse', 'Cog'];
const SNAPBOT_NAMES: Record<BotKind, string> = { grunt: 'Snapbot', rusher: 'Zipbot', sniper: 'Scopebot', boss: 'Megabot' };

/** Mode rules around the host simulation: warmup, scoring, respawns, waves and the end of a match. */
export class Match {
  readonly sim: HostSim;
  readonly bots: BotDirector;
  /** Kill streaks (rooms: the bounty on each player) and multi-kill chains. */
  readonly streaks: Streaks;
  state: MatchState = { phase: 'warmup', phaseEnds: 0, teamScore: [0, 0], wave: 0, winner: null, waveLeft: 0, theme: null, cause: null };
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
    this.streaks = new Streaks(settings.mode !== 'solo');
    this.sim.onKill = (victim, killer, weapon, kill) => this.onKill(victim, killer, weapon, kill);
  }

  get time() {
    return this.sim.time;
  }

  start() {
    this.state = { phase: 'warmup', phaseEnds: this.time + WARMUP, teamScore: [0, 0], wave: 0, winner: null, waveLeft: 0, theme: null, cause: null };
    this.offers.clear();
    this.sim.damageEnabled = false;
    this.fill(false);
    for (const p of this.sim.players.values()) this.sim.spawn(p);
  }

  addHuman(name: string, character: CharacterId): HostPlayer {
    // The bot leaves first, so the newcomer takes its side in a team match.
    if (this.settings.mode !== 'solo' && this.humans().length + this.botCount() >= this.seats()) this.dropBot();
    const p = this.sim.addPlayer(name, character, null, this.teamFor());
    if (this.state.phase === 'warmup' || this.state.phase === 'playing') this.sim.spawn(p);
    return p;
  }

  remove(id: number) {
    const human = this.sim.players.get(id)?.bot === null;
    this.drop(id);
    if (human) this.fill(this.state.phase === 'warmup' || this.state.phase === 'playing');
  }

  private drop(id: number) {
    this.offers.delete(id);
    this.bots.remove(id);
    this.streaks.remove(id);
    this.sim.removePlayer(id);
  }

  private seats() {
    return Math.min(this.settings.seats, MATCH.maxPlayers);
  }

  /** Bots take the seats no human holds. */
  private fill(spawn: boolean) {
    if (this.settings.mode === 'solo') return;
    while (this.sim.players.size < this.seats()) {
      const bot = this.addBot();
      if (spawn) this.sim.spawn(bot);
    }
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
    if (bot) this.drop(bot.id);
  }

  private onKill(victim: HostPlayer, killer: HostPlayer | null, weapon: KillCause, kill: Extract<GameEvent, { type: 'kill' }>) {
    const { bounty, chain } = this.streaks.kill(this.time, victim, killer);
    if (killer && bounty) {
      killer.score += bounty;
      kill.bounty = bounty;
    }
    if (killer && chain >= 2) this.sim.events.push({ type: 'multikill', player: killer.id, count: chain });
    if (this.settings.mode === 'tdm' && killer && killer.team !== -1) this.state.teamScore[killer.team]++;
    if (this.settings.mode === 'solo') {
      if (victim.bot) {
        victim.respawnAt = this.time + 1.5;
      } else {
        this.state.cause = { killer: killer?.bot ?? null, weapon };
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
    this.wave = waveTuning(this.settings.difficulty, wave);
    this.sim.events.push({ type: 'wave', wave, theme: this.wave.theme });
    this.bots.skill = this.wave.skill;
    this.bots.lag = this.wave.lag;
    this.sim.botDamage = this.wave.damage;
    this.waveQueue = waveRoster(this.settings.difficulty, wave);
    this.waveSpawnTimer = 0;
    this.state.theme = this.wave.theme;
    this.state.waveLeft = this.waveQueue.length;
    // A held regeneration (a part heal between waves) comes back once the wave is under way, after its usual wait.
    if (this.sim.regenAfter === Infinity) this.sim.regenAfter = this.time + REGEN.delay;
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
    if (this.wave.heal < 1) this.sim.regenAfter = Infinity;
    for (const p of this.sim.players.values()) {
      if (p.bot || !p.alive) continue;
      p.health = Math.min(p.maxHealth, p.health + p.maxHealth * this.wave.heal);
      fillMagazines(p.arms);
      p.arms.grenades = p.arms.grenadeMax;
      p.arms.grenadeTimer = 0;
      const options = drawOffer(p.upgrades, this.seed + p.id * 7919, s.wave, 3, idleCards(p));
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
      if (bot.bot === 'boss') bot.maxHealth = this.wave.bossHealth;
      this.sim.spawn(bot);
    }
    this.state.waveLeft = this.waveQueue.length + [...this.sim.players.values()].filter((p) => p.bot && p.alive).length;
    if (!this.waveQueue.length && alive === 0 && this.botCount() === 0) this.clearWave();
  }

  get resultsOver() {
    return this.state.phase === 'ended' && this.time >= this.state.phaseEnds;
  }
}
