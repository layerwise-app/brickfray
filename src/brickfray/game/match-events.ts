import * as THREE from 'three';
import type { ShatterPiece } from '../characters/types';
import { PLASTIC } from '../engine/palette';
import type { GameEvent, ShotTrace } from '../sim/types';
import { WEAPONS } from '../weapons/defs';
import type { FeedEntry, ScoreRow } from './hud';
import type { MatchView } from './match-view';

const FEED_LIFE = 6;
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
  private clock = 0;
  private hudTimer = 0;

  constructor(private readonly mv: MatchView) {}

  adopt(from: MatchEvents) {
    this.feed = from.feed;
    this.chat = from.chat;
    this.bannerUntil = from.bannerUntil;
    this.clock = from.clock;
  }

  private name(id: number) {
    return this.mv.session.roster.get(id)?.name ?? '?';
  }

  private team(id: number) {
    return this.mv.session.roster.get(id)?.team ?? -1;
  }

  /** Remote players' shots: tracer from their gun, impacts, sound with distance and a whiz if it passed close. */
  traces(list: readonly ShotTrace[]) {
    const mv = this.mv;
    const me = mv.session.you;
    const cam = mv.fp.camera.position;
    for (const t of list) {
      if (t.shooter === me) continue;
      const remote = mv.remotes.map.get(t.shooter);
      const from = remote ? mv.remotes.muzzleOf(remote, new THREE.Vector3()) : new THREE.Vector3(...t.origin);
      const pellet = t.ends.length > 1;
      let whiz = false;
      for (const e of t.ends) {
        const end = new THREE.Vector3(...e.point);
        mv.effects.tracers.add(from, end, { streak: t.weapon === 'sniper' ? 12 : pellet ? 2 : 4.5, width: t.weapon === 'sniper' ? 0.05 : 0.03, color: t.weapon === 'sniper' ? '#bfe9ff' : '#ffc46b' });
        if (e.hitPlayer) {
          if (e.hitPlayer !== me) mv.effects.bodyHit(end, end.clone().sub(from).normalize(), '#f2f2ee', false);
        } else if (e.surface !== 'none') {
          mv.effects.impact(end, new THREE.Vector3(...e.normal), e.surface);
        }
        // Closest approach of the bullet path to the listener.
        const seg = end.clone().sub(from);
        const len = seg.length();
        const along = THREE.MathUtils.clamp(cam.clone().sub(from).dot(seg) / Math.max(1e-4, len * len), 0, 1);
        if (e.hitPlayer !== me && from.clone().addScaledVector(seg, along).distanceTo(cam) < 1.6 && along > 0.05 && along < 0.98) whiz = true;
      }
      const distance = from.distanceTo(cam);
      mv.play(distance > 30 ? `fireFar:${t.weapon}` : `fire:${t.weapon}`, from, 1, distance > 30 ? 4 : 6);
      if (whiz) mv.play('whiz', null, 0.8, 6);
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
            if (e.attacker !== me) mv.play('hurt', null, 0.8, 8);
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
            mv.play('shatter', victim.position, 1, 7);
          }
          if (e.victim === me) {
            mv.deathCam = { at: mv.fp.camera.position.clone(), killer: e.killer, t: 0 };
            mv.play('death', null, 1, 9);
            mv.hud.set({ death: { killer: e.killer === me ? '' : this.name(e.killer), weapon: e.weapon, respawnAt: mv.session.hostNow() + 3 } });
          }
          if (e.killer === me && e.victim !== me) {
            mv.hud.pulse({ type: 'hit', kind: 'kill', amount: 0, at: null, headshot: e.headshot });
            mv.play('killConfirm', null, 1, 9);
            if (e.headshot) mv.play('headshotMarker', null, 1, 9);
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
            self: e.killer === e.victim
          });
          this.pushFeed();
          break;
        }
        case 'explosion': {
          const p = new THREE.Vector3(...e.position);
          mv.effects.explosion(p, [PLASTIC.red, PLASTIC.yellow, PLASTIC.darkGray, PLASTIC.orange, PLASTIC.white]);
          mv.play('explosion', p, 1, 9);
          const d = p.distanceTo(mv.fp.camera.position);
          if (d < 18) mv.fp.addShake(Math.max(0, 1 - d / 18) * 1.1);
          break;
        }
        case 'spawn':
          if (e.player === me) {
            mv.hud.set({ death: null });
            mv.play('respawn', null, 0.7, 6);
          }
          break;
        case 'melee':
          if (e.player !== me) {
            const r = mv.remotes.map.get(e.player);
            mv.play(e.hit ? 'malletHit' : 'malletMiss', r?.position ?? null, 1, 6);
          } else if (e.hit) mv.play('malletHit', null, 1, 8);
          break;
        case 'chat':
          this.chat.push({ key: feedKey++, name: this.name(e.player), text: e.text, team: this.team(e.player), at: this.clock });
          if (this.chat.length > 6) this.chat.shift();
          mv.hud.set({ chat: this.chat.map(({ at: _, ...c }) => c) });
          break;
        case 'wave':
          mv.hud.set({ banner: { key: feedKey++, text: 'wave', sub: String(e.wave) }, wave: e.wave });
          this.bannerUntil = this.clock + 3;
          mv.play('waveStart', null, 1, 8);
          break;
        case 'join':
        case 'leave':
          break;
      }
    }
  }

  private pushFeed() {
    this.mv.hud.set({ feed: this.feed.slice(-5).map(({ at: _, ...f }) => f) });
  }

  /** Per-frame HUD upkeep, throttled to ~15 Hz for React. */
  frame(dt: number) {
    const mv = this.mv;
    this.clock += dt;
    const before = this.feed.length;
    this.feed = this.feed.filter((f) => this.clock - f.at < FEED_LIFE);
    if (this.feed.length !== before) this.pushFeed();
    if (this.chat.length && this.clock - this.chat[0]!.at > 10) {
      this.chat.shift();
      mv.hud.set({ chat: this.chat.map(({ at: _, ...c }) => c) });
    }
    if (mv.hud.state.banner && this.clock > this.bannerUntil) mv.hud.set({ banner: null });
    this.hudTimer -= dt;
    if (this.hudTimer > 0) return;
    this.hudTimer = 1 / 15;
    const p = mv.me;
    const board = mv.session.board;
    const now = mv.session.hostNow();
    const match = board?.match;
    const phase = match?.phase ?? 'warmup';
    const info = mv.renderer.renderer.info.render;
    mv.hud.set({
      phase,
      phaseLeft: match?.phaseEnds ? Math.max(0, match.phaseEnds - now) : 0,
      health: Math.ceil(p.health),
      maxHealth: p.maxHealth,
      alive: p.alive,
      weapon: p.arms.next ?? p.arms.weapon,
      ammo: p.arms.ammo[p.arms.next ?? p.arms.weapon],
      reload: p.arms.reload > 0 ? 1 - p.arms.reload / Math.max(1e-3, p.arms.reloadTotal) : -1,
      grenades: p.arms.grenades,
      scoped: mv.scoped,
      aiming: p.arms.ads > 0.6,
      teamScore: match ? [match.teamScore[0], match.teamScore[1]] : [0, 0],
      myTeam: mv.myTeam,
      wave: match?.wave ?? 0,
      winner: match?.winner ?? null,
      rows: this.rows(),
      ping: Math.round(mv.session.rtt * 1000),
      fps: mv.renderer.timer.fps,
      frameMs: mv.renderer.timer.ms,
      stats: { calls: info.calls, triangles: info.triangles }
    });
    mv.hud.pulse({ type: 'spread', px: this.spreadPx() });
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

  private rows(): ScoreRow[] {
    const mv = this.mv;
    const stats = new Map(mv.session.board?.rows.map((r) => [r.id, r]) ?? []);
    return [...mv.session.roster.values()]
      .map((e) => {
        const s = stats.get(e.id);
        return { id: e.id, name: e.name, character: e.character, team: e.team, kills: s?.kills ?? 0, deaths: s?.deaths ?? 0, assists: s?.assists ?? 0, score: s?.score ?? 0, ping: s?.ping ?? 0, me: e.id === mv.session.you, bot: !!e.bot };
      })
      .sort((a, b) => b.score - a.score || b.kills - a.kills);
  }
}
