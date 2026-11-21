import * as THREE from 'three';
import { TEAM_COLORS, type Remotes } from './remotes';

export type ClearLine = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => boolean;

/**
 * Enemies in plain sight at mid range keep a faint tag, so a small figure against a busy wall still reads; up close
 * the figure (and its rim light) is enough, so the tag only fades in from SPOT_FROM and out again by SIGHT_RANGE.
 */
const SPOT_FROM = 12;
const SPOT_FULL = 18;
const SIGHT_RANGE = 30;
const SIGHT_RECHECK_MS = 200;
/**
 * A downward chevron instead of a name (names on every enemy in a crowd would overlap into a smear), with a pale halo
 * and a dark edge so it holds against red awnings and brick as well as against sky.
 */
const SPOTTED =
  '<svg width="18" height="14" viewBox="0 0 18 14" style="display:block;margin-bottom:6px;overflow:visible"><path d="M2,2H16L9,12Z" fill="none" stroke="rgba(255,240,230,.85)" stroke-width="4.5" stroke-linejoin="round"/><path d="M2,2H16L9,12Z" fill="currentColor" stroke="rgba(30,0,0,.9)" stroke-width="2" stroke-linejoin="round"/></svg>';
const NAME_STYLE = { background: 'rgba(14,10,12,.66)', padding: '0 9px 2px', borderRadius: '10px', marginBottom: '4px' };
const CHEVRON = { w: 18, h: 20 };
/** A chevron is full size at SPOT_FROM and shrinks with distance like the figure under it, to 0.6 by 20 m. */
const chevronScale = (far: number) => THREE.MathUtils.clamp(SPOT_FROM / far, 0.6, 1);

interface Placed {
  tag: HTMLDivElement;
  x: number;
  y: number;
  scale: number;
  far: number;
}

/**
 * Labels above heads, as positioned DOM elements: teammates' names always, the name of the enemy under the crosshair,
 * and (when a line-of-sight test is given) a chevron over enemies in plain sight within SIGHT_RANGE; never through walls.
 */
export class NameTags {
  private tags = new Map<number, HTMLDivElement>();
  private sight = new Map<number, { at: number; clear: boolean }>();
  private v = new THREE.Vector3();

  constructor(
    private readonly container: HTMLElement,
    private readonly clearLine?: ClearLine
  ) {}

  update(camera: THREE.Camera, remotes: Remotes, aimed: number, myTeam: number, width: number, height: number) {
    const seen = new Set<number>();
    const chevrons: Placed[] = [];
    const now = performance.now();
    const eye = camera.position;
    for (const r of remotes.map.values()) {
      const teammate = myTeam !== -1 && r.entry.team === myTeam;
      const head = r.position.y + (r.entry.bot === 'boss' ? 3.1 : 2.1);
      const big = teammate || r.entry.id === aimed;
      const far = Math.hypot(r.position.x - eye.x, r.position.z - eye.z);
      const faint = THREE.MathUtils.smoothstep(far, SPOT_FROM, SPOT_FULL) * (1 - THREE.MathUtils.smoothstep(far, SIGHT_RANGE - 4, SIGHT_RANGE));
      if (!r.visible || (!big && (faint < 0.02 || !this.inSight(r.entry.id, eye, r.position.x, r.position.y + 1.5, r.position.z, now)))) continue;
      this.v.set(r.position.x, head, r.position.z).project(camera);
      if (this.v.z > 1) continue;
      seen.add(r.entry.id);
      let tag = this.tags.get(r.entry.id);
      if (!tag) {
        tag = document.createElement('div');
        tag.className = 'bf-display bf-hud-text absolute left-0 top-0 whitespace-nowrap text-xl leading-7';
        this.container.appendChild(tag);
        this.tags.set(r.entry.id, tag);
      }
      const mode = big ? r.entry.name : SPOTTED;
      if (tag.dataset.mode !== mode) {
        tag.dataset.mode = mode;
        if (big) tag.textContent = r.entry.name;
        else tag.innerHTML = SPOTTED;
        // A name sits on a dark pill so it reads on any wall; the chevron carries its own outline.
        for (const [k, v] of Object.entries(NAME_STYLE)) tag.style.setProperty(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), big ? v : '');
      }
      tag.style.color = teammate ? TEAM_COLORS[myTeam as 0 | 1] : big ? '#ff7a6a' : '#ff4a3a';
      tag.style.opacity = big ? '1' : (0.92 * faint).toFixed(2);
      const x = (this.v.x * 0.5 + 0.5) * width;
      const y = (-this.v.y * 0.5 + 0.5) * height;
      if (big) place(tag, x, y, 1);
      else chevrons.push({ tag, x, y, scale: chevronScale(far), far });
    }
    // Nearer enemies keep their spot; a farther chevron that would overlap one is lifted above it, so a row of
    // enemies reads as markers over each figure, never as one strip.
    chevrons.sort((a, b) => a.far - b.far);
    for (let i = 0; i < chevrons.length; i++) {
      const c = chevrons[i]!;
      for (let step = 0; step < 3; step++) {
        const hit = chevrons.slice(0, i).find((o) => Math.abs(o.x - c.x) < ((o.scale + c.scale) * CHEVRON.w) / 2 + 2 && Math.abs(o.y - c.y) < ((o.scale + c.scale) * CHEVRON.h) / 2);
        if (!hit) break;
        c.y = hit.y - ((hit.scale + c.scale) * CHEVRON.h) / 2 - 1;
      }
      place(c.tag, c.x, c.y, c.scale);
    }
    for (const [id, tag] of this.tags) {
      if (seen.has(id)) continue;
      tag.remove();
      this.tags.delete(id);
    }
  }

  private inSight(id: number, eye: THREE.Vector3, x: number, y: number, z: number, now: number) {
    if (!this.clearLine || eye.distanceToSquared(this.v.set(x, y, z)) > SIGHT_RANGE * SIGHT_RANGE) return false;
    let s = this.sight.get(id);
    if (!s || now - s.at > SIGHT_RECHECK_MS) {
      s = { at: now, clear: this.clearLine(eye.x, eye.y, eye.z, x, y, z) };
      this.sight.set(id, s);
    }
    return s.clear;
  }

  clear() {
    for (const tag of this.tags.values()) tag.remove();
    this.tags.clear();
    this.sight.clear();
  }
}

/** Anchors a tag's bottom centre at (x, y), scaled about that point. */
function place(tag: HTMLDivElement, x: number, y: number, scale: number) {
  tag.style.transformOrigin = '50% 100%';
  tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
}
