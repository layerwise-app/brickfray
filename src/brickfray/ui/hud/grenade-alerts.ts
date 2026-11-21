import * as THREE from 'three';
import { fuseBlink } from '../../fx/grenade-fx';
import type { LiveGrenade } from '../../game/grenade-view';
import type { ClearLine } from '../../game/name-tags';
import { GRENADE } from '../../weapons/defs';

const ENEMY = '#ff3b30';
/** Our own grenade can hurt us too, but it is no surprise: amber, and a gentler pulse. */
const OWN = '#ffc23d';
/** Warnings start a little beyond the blast radius: the grenade may still roll closer, or the player step toward it. */
const REACH = GRENADE.radius + 0.8;
/** Our own grenade is not worth a warning until it has left the hand and could have come back. */
const OWN_QUIET = 0.45;
const SIGHT_RECHECK_MS = 100;
/** The blast is measured from the player's middle (and checked to the head) like the host does. */
const BODY = 0.9;
const HEAD = 1.6;
/**
 * The ring the warnings sit on, as a share of the screen's short side; toward the lower right, where the held gun fills
 * the screen, it pulls in so a warning sits between the crosshair and the gun rather than on the gun.
 */
const RING = 0.25;
const RING_NEAR = 0.17;
const GUN_SIDE = (140 * Math.PI) / 180;
const ICON = 66;

function icon(color: string, pointer: 'out' | 'down') {
  const ink = 'rgba(24,6,3,.92)';
  const wedge = pointer === 'out' ? 'M-7,-20L0,-29.5L7,-20Z' : 'M-7,20L0,29.5L7,20Z';
  return (
    `<svg width="${ICON}" height="${ICON}" viewBox="-30 -30 60 60" style="display:block;overflow:visible">` +
    `<circle data-glow r="25" fill="${color}" opacity="0"/>` +
    `<g data-wedge><path d="${wedge}" fill="${color}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/></g>` +
    `<circle r="18" fill="rgba(26,10,6,.82)" stroke="${ink}" stroke-width="6"/>` +
    `<circle r="18" fill="none" stroke="${color}" stroke-width="2.6" opacity=".35"/>` +
    `<circle data-fuse r="18" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100 100" transform="rotate(-90)"/>` +
    `<g stroke="${ink}" stroke-width="1.1" stroke-linejoin="round">` +
    `<circle cy="3.2" r="8.2" fill="#fff"/>` +
    `<rect x="-8.2" y="2.1" width="16.4" height="2.6" fill="${color}" stroke="none"/>` +
    `<rect x="-3.6" y="-8.4" width="7.2" height="4.6" rx="1.2" fill="#fff"/>` +
    `<path d="M3.4,-7.2C8.2,-7 9.6,-4 8.8,0.6" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/>` +
    `</g>` +
    `<circle data-spark cy="-11.8" r="2.8" fill="${color}" stroke="${ink}" stroke-width="1"/>` +
    `</svg>`
  );
}

interface Parts {
  el: HTMLDivElement;
  glow: SVGElement;
  wedge: SVGElement;
  fuse: SVGElement;
  spark: SVGElement;
}

/** One warning on the ring this frame; `mark` is where the marker over its grenade stands, when on screen. */
interface RingItem {
  alert: Alert;
  angle: number;
  scale: number;
  alpha: number;
  on: number;
  g: LiveGrenade;
  mark: { x: number; y: number } | null;
}

interface Alert {
  look: string;
  ring: Parts | null;
  mark: Parts | null;
  sight: { at: number; clear: boolean } | null;
}

/** Ring radius (pixels) for a warning in screen direction `angle` (clockwise from up). */
function ringRadius(angle: number, short: number) {
  const off = Math.abs(Math.atan2(Math.sin(angle - GUN_SIDE), Math.cos(angle - GUN_SIDE)));
  const t = THREE.MathUtils.clamp((off - (32 * Math.PI) / 180) / ((30 * Math.PI) / 180), 0, 1);
  return short * (RING_NEAR + (RING - RING_NEAR) * t * t * (3 - 2 * t));
}

const v = new THREE.Vector3();
const forward = new THREE.Vector3();

/**
 * Grenade warnings: for every live grenade that could hurt the player (in blast range, nothing solid in between, not a
 * teammate's), an icon on a ring around the crosshair points toward it, and a marker stands over it when it is on
 * screen. Both carry the fuse as a shrinking arc and pulse with the grenade's bulb, growing as the burst nears; they
 * go the frame the grenade bursts.
 */
export class GrenadeAlerts {
  private alerts = new Map<number, Alert>();

  constructor(
    private readonly container: HTMLElement,
    private readonly clearLine?: ClearLine
  ) {}

  update(
    camera: THREE.Camera,
    grenades: readonly LiveGrenade[],
    self: { alive: boolean; x: number; y: number; z: number } | null,
    teamOf: (id: number) => number,
    myTeam: number,
    width: number,
    height: number
  ) {
    const seen = new Set<number>();
    const ring: RingItem[] = [];
    const short = Math.min(width, height);
    const now = performance.now();
    if (self?.alive) {
      camera.getWorldDirection(forward);
      const fl = Math.hypot(forward.x, forward.z) || 1;
      const fx = forward.x / fl;
      const fz = forward.z / fl;
      for (const g of grenades) {
        if (g.own ? g.age < OWN_QUIET : myTeam !== -1 && teamOf(g.thrower) === myTeam) continue;
        const d = Math.hypot(g.now.x - self.x, g.now.y - (self.y + BODY), g.now.z - self.z);
        if (d > REACH) continue;
        const alert = this.alert(g.id, g.own ? 'own' : 'enemy');
        if (!this.inSight(alert, g, self, now)) continue;
        seen.add(g.id);
        const { on, urgency } = fuseBlink(g.left);
        const alpha = d <= GRENADE.radius ? 1 : 0.6 * (1 - (d - GRENADE.radius) / (REACH - GRENADE.radius)) + 0.2;
        const scale = (0.92 + 0.32 * urgency) * (1 + (g.own ? 0.06 : 0.14) * on);
        const dx = g.drawn.x - camera.position.x;
        const dz = g.drawn.z - camera.position.z;
        const along = dx * fx + dz * fz;
        const side = dx * -fz + dz * fx;
        // Off screen it points the way to turn (right underfoot: the bottom); on screen, at the grenade itself.
        let angle = Math.hypot(along, side) < 0.35 ? Math.PI : Math.atan2(side, along);
        v.set(g.drawn.x, g.drawn.y + 0.12, g.drawn.z).project(camera);
        const x = (v.x * 0.5 + 0.5) * width;
        const y = (-v.y * 0.5 + 0.5) * height;
        const inside = v.z < 1 ? Math.min(x, width - x, y, height - y) : -Infinity;
        if (inside > 0) {
          const toward = Math.atan2(x - width / 2, height / 2 - y);
          const k = THREE.MathUtils.smoothstep(inside, 0, 0.12 * short);
          angle += Math.atan2(Math.sin(toward - angle), Math.cos(toward - angle)) * k;
        }
        const item: RingItem = { alert, angle, scale, alpha, on, g, mark: null };
        ring.push(item);
        if (inside > -20) {
          const mark = (alert.mark ??= this.parts(alert.look, 'down'));
          const s = scale * 0.8;
          const half = (ICON / 2) * s;
          this.paint(mark, g, on, alpha);
          const mx = THREE.MathUtils.clamp(x, half, width - half);
          const my = THREE.MathUtils.clamp(y - 31 * s, half, height - half);
          item.mark = { x: mx, y: my };
          mark.el.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)})`;
        } else this.drop(alert, 'mark');
      }
    }
    spread(ring, short);
    for (const r of ring) {
      const parts = (r.alert.ring ??= this.parts(r.alert.look, 'out'));
      const radius = ringRadius(r.angle, short);
      const x = width / 2 + Math.sin(r.angle) * radius;
      const y = height / 2 - Math.cos(r.angle) * radius;
      // Where the marker over the grenade already sits next to the ring, the ring icon gives way to it.
      const near = r.mark ? THREE.MathUtils.smoothstep(Math.hypot(r.mark.x - x, r.mark.y - y), ICON * 1.1, ICON * 2) : 1;
      this.paint(parts, r.g, r.on, r.alpha * near);
      parts.wedge.setAttribute('transform', `rotate(${((r.angle * 180) / Math.PI).toFixed(1)})`);
      parts.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${r.scale.toFixed(3)})`;
    }
    for (const [id, alert] of this.alerts) {
      if (seen.has(id)) continue;
      this.drop(alert, 'ring');
      this.drop(alert, 'mark');
      if (!grenades.some((g) => g.id === id)) this.alerts.delete(id);
    }
  }

  clear() {
    for (const alert of this.alerts.values()) {
      this.drop(alert, 'ring');
      this.drop(alert, 'mark');
    }
    this.alerts.clear();
  }

  private alert(id: number, look: string) {
    let a = this.alerts.get(id);
    if (!a) {
      a = { look, ring: null, mark: null, sight: null };
      this.alerts.set(id, a);
    }
    return a;
  }

  /** Like the host's blast test: a clear line from just above the grenade to the player's middle or head. */
  private inSight(alert: Alert, g: LiveGrenade, self: { x: number; y: number; z: number }, now: number) {
    if (!this.clearLine) return true;
    if (!alert.sight || now - alert.sight.at > SIGHT_RECHECK_MS) {
      const gx = g.now.x;
      const gy = g.now.y + 0.15;
      const gz = g.now.z;
      const clear = this.clearLine(gx, gy, gz, self.x, self.y + BODY, self.z) || this.clearLine(gx, gy, gz, self.x, self.y + HEAD, self.z);
      alert.sight = { at: now, clear };
    }
    return alert.sight.clear;
  }

  private parts(look: string, pointer: 'out' | 'down'): Parts {
    const el = document.createElement('div');
    el.className = 'absolute left-0 top-0';
    el.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,.55))';
    el.innerHTML = icon(look === 'own' ? OWN : ENEMY, pointer);
    this.container.appendChild(el);
    const q = (name: string) => el.querySelector(`[data-${name}]`) as SVGElement;
    return { el, glow: q('glow'), wedge: q('wedge'), fuse: q('fuse'), spark: q('spark') };
  }

  private paint(p: Parts, g: LiveGrenade, on: number, alpha: number) {
    p.el.style.opacity = alpha.toFixed(2);
    p.fuse.setAttribute('stroke-dasharray', `${(THREE.MathUtils.clamp(g.left / GRENADE.fuse, 0, 1) * 100).toFixed(1)} 100`);
    p.glow.setAttribute('opacity', (on * (g.own ? 0.22 : 0.4)).toFixed(2));
    p.spark.setAttribute('fill', on > 0.2 ? '#fff6e0' : g.own ? OWN : ENEMY);
  }

  private drop(alert: Alert, which: 'ring' | 'mark') {
    alert[which]?.el.remove();
    alert[which] = null;
  }
}

/** Warnings closer on the ring than an icon's width are pushed apart, so two grenades side by side show as two. */
function spread(items: { angle: number; scale: number }[], short: number) {
  if (items.length < 2) return;
  const gap = (ICON * 0.95) / (short * RING);
  for (let pass = 0; pass < 4; pass++) {
    items.sort((a, b) => a.angle - b.angle);
    for (let i = 0; i < items.length; i++) {
      const a = items[i]!;
      const b = items[(i + 1) % items.length]!;
      let diff = b.angle - a.angle;
      if (i === items.length - 1) diff += Math.PI * 2;
      const need = gap * Math.max(a.scale, b.scale);
      if (diff >= need) continue;
      const push = (need - diff) / 2;
      a.angle -= push;
      b.angle += push;
    }
  }
}
