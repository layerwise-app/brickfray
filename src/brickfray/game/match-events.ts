import * as THREE from 'three';
import type { ShatterPiece } from '../characters/types';
import { PLASTIC } from '../engine/palette';
import type { GameEvent, ShotTrace } from '../sim/types';
import { magSize } from '../sim/arms';
import { waveTuning } from '../sim/waves';
import { WEAPONS } from '../weapons/defs';
import type { FeedEntry, ScoreRow } from './hud';
import type { MatchView } from './match-view';

const FEED_LIFE = 6;
/** Seconds the local player's multi-kill callout stays up (a newer chain replaces it). */
const MULTIKILL_LIFE = 2.6;
const NO_BOSSES: { id: number; health: number; max: number }[] = [];
let feedKey = 1;

/** Headshot kills send the head (and hat) spinning up and away from the shot. */
function popHead(pieces: ShatterPiece[], impulse: THREE.Vector3) {
  const away = impulse.clone().setY(0).normalize();
  for (const p of pieces) {
    if (!p.head) continue;
    p.velocity.addScaledVector(away, 2.5).setY(p.velocity.y + 4.5);
    p.angularVelocity.multiplyScalar(1.8);
  }
}

/** Turns host events and remote shots into effects, sounds and HUD state. */
export class MatchEvents {
  private feed: (FeedEntry & { at: number })[] = [];
  private chat: { key: number; name: string; text: string; team: number; at: number }[] = [];
  private bannerUntil = 0;
  private multikillUntil = 0;
  private clock = 0;
  private hudTimer = 0;
  /** The local player's own record of the match for the HUD: headshot kills, shots fired and landed, seconds played. */
  private mine = { headshots: 0, shots: 0, hit: 0, time: 0 };

  constructor(private readonly mv: MatchView) {}

  adopt(from: MatchEvents) {
    this.feed = from.feed;
    this.chat = from.chat;
    this.bannerUntil = from.bannerUntil;
    this.multikillUntil = from.multikillUntil;
    this.clock = from.clock;
    this.offerUntil = from.offerUntil;
    this.mine = from.mine;
  }

  private name(id: number) {
    return this.mv.session.roster.get(id)?.name ?? '?';
  }

  private team(id: number) {
    return this.mv.session.roster.get(id)?.team ?? -1;
  }

  /** Remote players' shots: tracer from their gun, impacts and their sound near the listener, the shot with distance, a whiz if it passed close. */
  traces(list: readonly ShotTrace[]) {
    const mv = this.mv;
    const me = mv.session.you;
    const cam = mv.fp.camera.position;
    for (const t of list) {
      if (t.shooter === me) {
        this.mine.shots++;
        if (t.ends.some((e) => e.hitPlayer && e.hitPlayer !== me)) this.mine.hit++;
        continue;
      }
      const remote = mv.remotes.map.get(t.shooter);
      const from = remote ? mv.remotes.muzzleOf(remote, new THREE.Vector3()) : new THREE.Vector3(...t.origin);
      const pellet = t.ends.length > 1;
      mv.sound.bullets.volley();
      for (const e of t.ends) {
        const end = new THREE.Vector3(...e.point);
        mv.effects.tracers.add(from, end, { weapon: t.weapon, streak: t.weapon === 'sniper' ? 12 : pellet ? 2 : 4.5, width: t.weapon === 'sniper' ? 0.05 : 0.03, color: t.weapon === 'sniper' ? '#bfe9ff' : '#ffc46b' });
        if (e.hitPlayer) {
          if (e.hitPlayer !== me) {
            mv.effects.bodyHit(end, end.clone().sub(from).normalize(), '#f2f2ee', false);
            mv.sound.bullets.strike('body', end, end.distanceTo(from), t.weapon, pellet);
          }
        } else if (e.surface !== 'none') {
          mv.effects.impact(end, new THREE.Vector3(...e.normal), e.surface);
          mv.sound.bullets.strike(e.surface, end, end.distanceTo(from), t.weapon, pellet);
        }
      }
      const distance = from.distanceTo(cam);
      mv.play(`fire:${t.weapon}`, from, 1, distance > 30 ? 4 : 6, mv.sound.occlusion(t.shooter, from));
      mv.sound.bullets.flyby(from, t.ends.filter((e) => e.hitPlayer !== me).map((e) => ({ x: e.point[0], y: e.point[1], z: e.point[2] })), t.weapon);
    }
  }

  handle(events: readonly GameEvent[]) {
    const mv = this.mv;
    const me = mv.session.you;
    for (const e of events) {
      switch (e.type) {
        case 'damage': {
          if (e.victim === me) {
            const m = mv.me.move;
            // Yaw that would face the attacker, relative to ours; the HUD wants clockwise-from-top.
            const toward = Math.atan2(-(e.from[0] - m.x), -(e.from[2] - m.z));
            const rel = Math.atan2(Math.sin(toward - mv.fp.yaw), Math.cos(toward - mv.fp.yaw));
            mv.hud.pulse({ type: 'hurt', angle: -rel, amount: e.amount });
            mv.fp.hurt(e.amount, -Math.sin(rel));
            mv.view.act({ type: 'hurt', strength: Math.min(1, e.amount / 50) });
            if (e.attacker !== me) mv.sound.hurt();
          } else {
            mv.remotes.hurt(e.victim, e.from);
            if (e.attacker === me && !e.fatal) {
              const r = mv.remotes.map.get(e.victim);
              mv.hud.pulse({ type: 'hit', kind: e.kind, amount: e.amount, at: r ? [r.position.x, r.position.y + 1.8, r.position.z] : null });
              mv.play(e.kind === 'head' ? 'headshotMarker' : 'hitmarker', null, 0.9, 8);
            }
          }
          break;
        }
        case 'kill': {
          const victim = mv.remotes.map.get(e.victim);
          if (victim) {
            const impulse = victim.position.clone().sub(mv.fp.camera.position).setY(0).normalize().multiplyScalar(e.weapon === 'grenade' ? 7 : 3.5);
            if (e.killer !== me) {
              const killer = mv.remotes.map.get(e.killer);
              if (killer) impulse.copy(victim.position.clone().sub(killer.position).setY(0).normalize().multiplyScalar(3.5));
            }
            impulse.y = 2;
            const pieces = victim.rig.shatter(impulse);
            if (e.headshot) popHead(pieces, impulse);
            mv.effects.shatter(pieces);
            mv.play('shatter', victim.position, 1, 7, mv.sound.occlusion(e.victim, victim.position, 1));
          }
          if (e.victim === me) {
            mv.deathCam = { at: mv.fp.camera.position.clone(), killer: e.killer, t: 0 };
            mv.play('death', null, 1, 9);
            mv.hud.set({
              death: { killer: e.killer === me ? '' : this.name(e.killer), weapon: e.weapon, respawnAt: e.respawnAt },
              respawnLeft: e.respawnAt !== null ? Math.max(0, e.respawnAt - mv.session.hostNow()) : -1
            });
          }
          if (e.killer === me && e.victim !== me) {
            if (e.headshot) this.mine.headshots++;
            mv.hud.pulse({ type: 'hit', kind: 'kill', amount: 0, at: null, headshot: e.headshot });
            mv.sound.kill(e.headshot);
          }
          this.feed.push({
            key: feedKey++,
            at: this.clock,
            killer: this.name(e.killer),
            killerTeam: this.team(e.killer),
            victim: this.name(e.victim),
            victimTeam: this.team(e.victim),
            weapon: e.weapon,
            headshot: e.headshot,
            mine: e.killer === me,
            victimIsMe: e.victim === me,
            self: e.killer === e.victim,
            bounty: e.bounty,
            chain: 0
          });
          this.pushFeed();
          break;
        }
        case 'explosion': {
          const p = new THREE.Vector3(...e.position);
          mv.effects.explosion(p, [PLASTIC.red, PLASTIC.yellow, PLASTIC.darkGray, PLASTIC.orange, PLASTIC.white]);
          mv.play('explosion', p, 1, 9, mv.sound.occlusion(null, p, 0.3));
          const d = p.distanceTo(mv.fp.camera.position);
          if (d < 18) mv.fp.addShake(Math.max(0, 1 - d / 18) * 1.1);
          break;
        }
        case 'spawn':
          if (e.player === me) {
            mv.hud.set({ death: null });
            mv.sound.cues.respawn();
          }
          break;
        case 'melee':
          mv.sound.melee(mv.session.roster.get(e.player)?.character, e.hit, mv.remotes.map.get(e.player)?.position ?? null, e.player === me, e.wall);
          break;
        case 'chat':
          this.chat.push({ key: feedKey++, name: this.name(e.player), text: e.text, team: this.team(e.player), at: this.clock });
          if (this.chat.length > 6) this.chat.shift();
          mv.hud.set({ chat: this.chat.map(({ at: _, ...c }) => c) });
          break;
        case 'wave':
          mv.hud.set({ banner: { key: feedKey++, text: 'wave', sub: String(e.wave) }, wave: e.wave });
          this.bannerUntil = this.clock + 3;
          mv.sound.cues.wave(e.theme);
          break;
        case 'upgradeOffer':
          if (e.player === me) this.dealt(e);
          break;
        case 'upgrade':
          if (e.player === me) this.upgraded(e);
          break;
        case 'multikill': {
          // The host sends it right after the kill that made the chain, so that kill is the feed's newest entry.
          const last = this.feed.at(-1);
          if (last && last.killer === this.name(e.player)) last.chain = e.count;
          this.pushFeed();
          if (e.player === me) {
            mv.hud.set({ multikill: { key: feedKey++, count: e.count } });
            this.multikillUntil = this.clock + MULTIKILL_LIFE;
            mv.audio.announce(e.count);
          }
          break;
        }
        case 'join':
        case 'leave':
          break;
      }
    }
  }

  private offerUntil = 0;
  /** Solo: the upgrade cards after a cleared wave. */
  private dealt(e: Extract<GameEvent, { type: 'upgradeOffer' }>) {
    this.mv.hud.set({ offer: { key: feedKey++, wave: e.wave, options: e.options, levels: e.levels, picked: null } });
    this.mv.sound.cues.offer();
  }

  /** The pick landed: the cards hold the choice a moment, then leave. An idle player's card is picked with the same click. */
  private upgraded(e: Extract<GameEvent, { type: 'upgrade' }>) {
    const hud = this.mv.hud;
    const offer = hud.state.offer;
    hud.set({ offer: offer && { ...offer, picked: e.id }, upgrades: { ...hud.state.upgrades, [e.id]: e.level }, upgradesTaken: [...hud.state.upgradesTaken, e.id] });
    this.offerUntil = this.clock + 0.9;
    this.mv.sound.cues.upgradeTaken();
  }

  private pushFeed() {
    this.mv.hud.set({ feed: this.feed.slice(-5).map(({ at: _, ...f }) => f) });
  }

  /** Per-frame HUD upkeep, throttled to ~15 Hz for React. */
  frame(dt: number) {
    const mv = this.mv;
    this.clock += dt;
    const phaseNow = mv.hud.state.phase;
    if (phaseNow === 'playing' || phaseNow === 'intermission') this.mine.time += dt;
    const before = this.feed.length;
    this.feed = this.feed.filter((f) => this.clock - f.at < FEED_LIFE);
    if (this.feed.length !== before) this.pushFeed();
    if (this.chat.length && this.clock - this.chat[0]!.at > 10) {
      this.chat.shift();
      mv.hud.set({ chat: this.chat.map(({ at: _, ...c }) => c) });
    }
    if (mv.hud.state.banner && this.clock > this.bannerUntil) mv.hud.set({ banner: null });
    if (mv.hud.state.multikill && this.clock > this.multikillUntil) mv.hud.set({ multikill: null });
    if (mv.hud.state.offer?.picked && this.clock > this.offerUntil) mv.hud.set({ offer: null });
    this.finalSeconds();
    this.hudTimer -= dt;
    if (this.hudTimer > 0) return;
    this.hudTimer = 1 / 15;
    const p = mv.me;
    const board = mv.session.board;
    const now = mv.session.hostNow();
    const match = board?.match;
    const phase = match?.phase ?? 'warmup';
    const mode = mv.settings.mode;
    const won = match?.winner === (mode === 'tdm' ? mv.myTeam : mv.session.you);
    const outcome = phase !== 'ended' ? null : mode === 'solo' ? 'over' : won ? 'won' : 'lost';
    mv.sound.cues.setPhase(phase, match?.phaseEnds ? Math.max(0, match.phaseEnds - now) : 0, { solo: mode === 'solo', timed: mode !== 'solo', outcome });
    mv.sound.cues.grenades(p.arms.grenades, p.alive);
    const info = mv.renderer.renderer.info.render;
    const self = mv.session.snapshots.at(-1)?.self;
    const weapon = p.arms.next ?? p.arms.weapon;
    mv.hud.set({
      phase,
      phaseLeft: match?.phaseEnds ? Math.max(0, match.phaseEnds - now) : 0,
      health: Math.ceil(p.health),
      maxHealth: self?.maxHealth ?? p.maxHealth,
      armor: self?.armor ?? 0,
      alive: p.alive,
      weapon: p.arms.next ?? p.arms.weapon,
      ammo: p.arms.ammo[weapon],
      mag: magSize(p.arms, weapon),
      reload: p.arms.reload > 0 ? 1 - p.arms.reload / Math.max(1e-3, p.arms.reloadTotal) : -1,
      grenades: p.arms.grenades,
      grenadeMax: p.arms.grenadeMax,
      grenadeTimer: p.arms.grenadeTimer,
      grenadeRefill: p.arms.grenadeRefill,
      respawnLeft: mv.hud.state.death?.respawnAt != null ? Math.max(0, mv.hud.state.death.respawnAt - now) : -1,
      scoped: mv.scoped,
      aiming: p.arms.ads > 0.6,
      teamScore: match ? [match.teamScore[0], match.teamScore[1]] : [0, 0],
      myTeam: mv.myTeam,
      wave: match?.wave ?? 0,
      waveLeft: match?.waveLeft ?? 0,
      waveTheme: match?.theme ?? null,
      soloCause: match?.cause ?? null,
      headshots: this.mine.headshots,
      shots: this.mine.shots,
      shotsHit: this.mine.hit,
      playTime: this.mine.time,
      bosses: this.bosses(),
      winner: match?.winner ?? null,
      rows: this.rows(),
      ping: Math.round(mv.session.rtt * 1000),
      fps: mv.renderer.timer.fps,
      frameMs: mv.renderer.timer.ms,
      stats: { calls: info.calls, triangles: info.triangles }
    });
    mv.hud.pulse({ type: 'spread', px: this.spreadPx() });
  }

  private counted = 0;
  /** Timed modes: a countdown tick each second over the last ten, the last three rising like the warmup's. */
  private finalSeconds() {
    const match = this.mv.session.board?.match;
    if (this.mv.settings.mode === 'solo' || match?.phase !== 'playing' || !match.phaseEnds) return;
    const second = Math.ceil(match.phaseEnds - this.mv.session.hostNow());
    if (second === this.counted || second < 1 || second > 10) return;
    this.counted = second;
    const last = Math.max(0, 3 - second);
    this.mv.audio.play('countdown', { priority: 9, volume: second <= 3 ? 1 : 0.6, rate: 2 ** (last / 12), variant: last });
  }

  private spreadPx() {
    const p = this.mv.me;
    const def = WEAPONS[p.arms.weapon];
    let spread = def.spread + (def.adsSpread - def.spread) * p.arms.ads;
    const speed = Math.hypot(p.move.vx, p.move.vz);
    spread *= 1 + (speed / 7.2) * 0.9 * (1 - p.arms.ads * 0.8);
    if (!p.move.grounded) spread *= 1.8;
    const fov = THREE.MathUtils.degToRad(this.mv.fp.currentFov);
    const width = this.mv.renderer.canvas.clientWidth;
    return (Math.tan(spread) / Math.tan(fov / 2)) * (width / 2) + Math.max(0, 0.15 - p.arms.sinceShot) * 40;
  }

  /** Solo: the Megabots alive now, with their health from the last snapshot. */
  private bosses() {
    const mv = this.mv;
    const snapshot = mv.session.snapshots.at(-1);
    if (mv.settings.mode !== 'solo' || !snapshot) return NO_BOSSES;
    const max = waveTuning(mv.settings.difficulty, Math.max(1, mv.session.board?.match.wave ?? 1)).bossHealth;
    const list = snapshot.players.filter((p) => p.alive && mv.session.roster.get(p.id)?.bot === 'boss').map((p) => ({ id: p.id, health: p.health, max }));
    const last = this.mv.hud.state.bosses;
    // The same numbers keep the same array, so the HUD does not redraw at 15 Hz for nothing.
    return list.length === last.length && list.every((b, i) => b.id === last[i]!.id && b.health === last[i]!.health) ? last : list.length ? list : NO_BOSSES;
  }

  private rows(): ScoreRow[] {
    const mv = this.mv;
    const stats = new Map(mv.session.board?.rows.map((r) => [r.id, r]) ?? []);
    return [...mv.session.roster.values()]
      .map((e) => {
        const s = stats.get(e.id);
        return { id: e.id, name: e.name, character: e.character, team: e.team, kills: s?.kills ?? 0, deaths: s?.deaths ?? 0, assists: s?.assists ?? 0, score: s?.score ?? 0, ping: s?.ping ?? 0, me: e.id === mv.session.you, bot: !!e.bot, bounty: s?.bounty ?? 0 };
      })
      .sort((a, b) => b.score - a.score || b.kills - a.kills);
  }
}
