/**
 * The solo wave director: builds each wave's spawn queue from the roster and a modifier, feeds
 * enemies in out of sight of the player, runs intermissions and checkpoints, and scores kills.
 */
import * as THREE from 'three';
import { INTERMISSION, KATANA_CHARGE_KILLS, MODIFIERS, ROSTER } from '../config';
import type { EnemyKind, TranslationKey } from '../config';
import { t } from '../core/i18n';
import { choose, clamp } from '../core/math';
import { BOSSES } from '../entities/enemies';
import type { EnemyManager } from '../entities/enemies';
import type { FocusMode } from './focus';
import type { Pickups } from './pickups';
import type { Session } from './state';

type KillHandler = NonNullable<EnemyManager['onKill']>;

const QUIPS: readonly TranslationKey[] = ['waveQuip0', 'waveQuip1', 'waveQuip2', 'waveQuip3', 'waveQuip4'];

const bossFor = (n: number): EnemyKind => BOSSES[(Math.floor(n / 5) - 1) % BOSSES.length];

function enemyName(key: EnemyKind): string {
  const names: Readonly<Record<string, string>> = { boss: t('bossDoodler'), eraser: t('bossEraser'), inkblot: t('bossInkblot') };
  return names[key] || key.toUpperCase();
}

export class WaveDirector {
  /**
   * Also takes over the enemy manager's kill and boss callbacks: kills score (solo and online),
   * charge the katana and drop pickups.
   */
  constructor(
    private readonly s: Session,
    private readonly pickups: Pickups,
    private readonly focus: FocusMode,
  ) {
    const { enemies } = s.ctx;
    enemies.onKill = this.onKill;
    enemies.onBoss = (e) => {
      if (!e.alive) {
        s.ctx.hud.setBoss(null, null);
        s.game.boss = null;
      } else {
        s.game.boss = e;
        s.ctx.hud.setBoss(e.T.name, e.hp / e.maxHp);
      }
    };
  }

  /** One controls tip per early wave. */
  private tips(): string[] {
    const { hud } = this.s.ctx;
    return [
      t('tip1', { key: hud.key('grapple') }),
      t('tip2', { key: hud.key('block') }),
      t('tip3'),
      t('tip4', { key: hud.key('grenade') }),
      t('tip5', { key: hud.key('jump') }),
    ];
  }

  start(n: number): void {
    const { game, prefs } = this.s;
    const { enemies, hud, audio, player, level } = this.s.ctx;
    game.wave = n;
    game.queue = [];
    game.spawnT = 2;
    game.intermission = 0;
    game.boss = null;
    hud.setBoss(null, null);
    const boss = n > 0 && n % 5 === 0;
    const allowed = boss || n < 4 ? 1 : n < 6 ? 3 : MODIFIERS.length;
    const mod = MODIFIERS[Math.floor(Math.random() * allowed)];
    const modName = mod.label ? t(mod.label) : '';
    enemies.mods.speed = mod.speed;
    enemies.mods.damage = mod.damage;
    enemies.mods.damage *= 1.2;
    hud.setModifier(modName);
    const swarm = mod.key === 'swarm';
    // the crowd on screen and the wave size both keep growing with the wave number
    game.maxAlive = Math.min(4 + Math.floor(n * 0.9) + (swarm ? 3 : 0), (swarm ? 22 : 18) + Math.floor(n / 3));
    let count = Math.round(Math.min(5 + n * 2.0, 32 + n) * (swarm ? 1.35 : 1));
    if (boss) {
      count = 7 + n;
      game.maxAlive += 2 + Math.floor(n / 5);
      game.queue.push(bossFor(n));
    }
    const pool = ROSTER.filter((r) => n >= r.from).map((r) => ({ type: r.type, weight: r.weight * Math.min(1, 0.3 + 0.25 * (n - r.from)) }));
    const total = pool.reduce((a, r) => a + r.weight, 0);
    for (let i = 0; i < count; i++) {
      let r = Math.random() * total;
      let type = pool[0].type;
      for (const c of pool) {
        r -= c.weight;
        if (r <= 0) {
          type = c.type;
          break;
        }
      }
      game.queue.push(type);
    }
    if (boss) {
      hud.message(t('waveStarted', { wave: n }), t('bossApproaching', { boss: enemyName(bossFor(n)) }), 3);
      audio.bossRoar(player.center);
    } else {
      hud.message(t('waveStarted', { wave: n }), n === 1 ? t('waveIntro') : modName || t(choose(QUIPS)), 2.6);
    }
    audio.wave();
    const tips = this.tips();
    if (n <= tips.length) hud.tip(tips[n - 1], 7);
    player.grenades = Math.min(player.maxGrenades, player.grenades + 1);
    for (let i = 0; i < 7; i++) this.pickups.spawn(i < 5 ? 'ammo' : 'health', choose(level.pickups));
    if (n >= 5 && n % 5 === 0 && n > prefs.checkpoint) {
      prefs.setCheckpoint(n);
      hud.kill(t('checkpoint', { wave: n }), 0);
    }
  }

  /** Where the next enemy of this type appears: out of the player's sight, not too close, not too far. */
  pickSpawn(type: EnemyKind): THREE.Vector3 {
    const { level, player, world } = this.s.ctx;
    const spots = type === 'sniper' ? level.snipers : level.spawns;
    const pp = player.body.pos;
    if (type === 'flyer') {
      const a = Math.random() * Math.PI * 2;
      const r = 22 + Math.random() * 10;
      return new THREE.Vector3(
        clamp(pp.x + Math.cos(a) * r, level.bounds.minX + 4, level.bounds.maxX - 4),
        pp.y + 12 + Math.random() * 6,
        clamp(pp.z + Math.sin(a) * r, level.bounds.minZ + 4, level.bounds.maxZ - 4),
      );
    }
    if (BOSSES.some((b) => b === type)) {
      const fits = (sp: THREE.Vector3): boolean =>
        !world.overlapsAABB({ x: sp.x - 1.1, y: sp.y + 0.1, z: sp.z - 1.1 }, { x: sp.x + 1.1, y: sp.y + 5.2, z: sp.z + 1.1 });
      const open = spots.filter((sp) => fits(sp));
      const far = open.filter((sp) => sp.distanceTo(pp) > 20);
      if (far.length) return choose(far).clone();
      if (open.length) return choose(open).clone();
      for (let i = 0; i < 200; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 22 + Math.random() * 18;
        const c = new THREE.Vector3(clamp(pp.x + Math.cos(a) * r, -44, 44), 0, clamp(pp.z + Math.sin(a) * r, -44, 44));
        c.y = world.groundBelow(c.x, 30, c.z, 40);
        if (c.y > -3 && fits(c)) return c;
      }
      return level.playerStart.clone();
    }
    let cands = spots.filter((sp) => {
      const d = sp.distanceTo(pp);
      return d > 14 && d < 48;
    });
    if (cands.length < 2) cands = spots.filter((sp) => sp.distanceTo(pp) > 14);
    const hidden = cands.filter((sp) => !world.hasLineOfSight(player.eye, new THREE.Vector3(sp.x, sp.y + 1.2, sp.z)));
    return choose(hidden.length ? hidden : cands.length ? cands : spots).clone();
  }

  update(dt: number): void {
    const { game } = this.s;
    const { enemies, hud, audio, player } = this.s.ctx;
    if (game.intermission > 0) {
      game.intermission -= dt;
      hud.setTimer(t('nextWave', { seconds: Math.ceil(game.intermission) }));
      if (game.intermission <= 0) {
        hud.setTimer('');
        this.start(game.wave + 1);
      }
      return;
    }
    if (game.queue.length && enemies.alive < game.maxAlive) {
      game.spawnT -= dt;
      if (game.spawnT <= 0) {
        game.spawnT = Math.max(0.7, 2.9 - game.wave * 0.13);
        const type = game.queue.shift()!;
        const e = enemies.spawn(type, this.pickSpawn(type));
        if (e.T.boss) {
          const mul = 1 + 0.35 * Math.floor((game.wave - 5) / 15);
          e.hp = e.maxHp = Math.round(e.T.hp * mul);
        }
      }
    }
    if (!game.queue.length && enemies.alive === 0) {
      game.intermission = INTERMISSION;
      hud.message(t('waveCleared', { wave: game.wave }), t('catchBreath', { points: 200 * game.wave }), 2.5);
      game.addScore(200 * game.wave);
      audio.waveClear();
      player.hp = Math.min(player.maxHp, player.hp + 40);
    }
    hud.setWave(game.wave, enemies.alive + game.queue.length);
  }

  private readonly onKill: KillHandler = (e, info, over) => {
    const { game } = this.s;
    const { player, audio } = this.s.ctx;
    game.kills++;
    game.combo++;
    game.comboT = 3.5;
    let label: string = e.T.name;
    let pts: number = e.T.score;
    if (info.crit) {
      label = t('headshot');
      pts += 60;
    }
    if (info.source === 'katana') {
      label = over ? t('slicedApart') : t('slashed');
      pts += 50;
    }
    if (info.source === 'focus') {
      label = t('executed');
      pts += 150;
    }
    if (info.source === 'katana' || info.source === 'focus') {
      game.katanaStreak++;
      player.weapons[player.katanaIndex].addBlood(0.42);
      if (game.katanaStreak >= KATANA_CHARGE_KILLS) this.focus.enter();
    } else if (info.source !== 'blast') game.katanaStreak = 0;
    if (info.source === 'deflect') {
      label = t('returned');
      pts += 120;
    }
    if (info.source === 'fall') label = t('fellOut');
    else if (!player.body.onGround && info.source !== 'deflect') {
      label += t('airKill');
      pts += 40;
    }
    game.addScore(pts, label);
    audio.kill(!!info.crit || e.T.boss);
    const r = Math.random();
    if (r < 0.5) this.pickups.spawn('ammo', e.body.pos);
    else if (r < 0.62) this.pickups.spawn('health', e.body.pos);
  };
}
