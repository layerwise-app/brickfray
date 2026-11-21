import * as THREE from 'three';
import { GrenadeAlerts } from '../ui/hud/grenade-alerts';
import type { GrenadeView } from './grenade-view';
import { TEAM_COLORS, type Remotes } from './remotes';

export type ClearLine = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => boolean;

/**
 * Enemies in plain sight at mid range get a marker, so a small figure against a busy wall still reads; up close the
 * figure (and its rim light) is enough, so the marker fades in over SPOT_IN and out again by SIGHT_RANGE.
 */
const SPOT_IN: [number, number] = [10.5, 13.5];
const SIGHT_RANGE = 30;
const SIGHT_RECHECK_MS = 200;
/** Teammates further than this show a team marker instead of their name, unless aimed at: names in a row would merge. */
const NAME_RANGE = 14;
/** A marker's anchor over the head's centre: just clear of the helmet, so it reads as belonging to the figure (standing or crouched); a name also clears the tallest crest. */
const OVER_HEAD = 0.2;
const NAME_OVER = 0.1;
/**
 * A downward chevron instead of a name over enemies, with a pale halo and a dark edge so it holds against red awnings
 * and brick as well as against sky; teammates far off get a diamond in their team colour.
 */
const CHEVRON_SVG =
  '<svg width="18" height="14" viewBox="0 0 18 14" style="display:block;margin-bottom:3px;overflow:visible"><path d="M2,2H16L9,12Z" fill="none" stroke="rgba(255,240,230,.9)" stroke-width="4.5" stroke-linejoin="round"/><path d="M2,2H16L9,12Z" fill="currentColor" stroke="rgba(30,0,0,.9)" stroke-width="2" stroke-linejoin="round"/></svg>';
const DIAMOND_SVG =
  '<svg width="18" height="14" viewBox="0 0 18 14" style="display:block;margin-bottom:3px;overflow:visible"><path d="M9,1L15,7L9,13L3,7Z" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="4" stroke-linejoin="round"/><path d="M9,1L15,7L9,13L3,7Z" fill="currentColor" stroke="rgba(0,10,40,.85)" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const MARK = { w: 18, h: 17 };
const PILL_H = 30;
/** A marker is full size at the near edge of its range and shrinks with distance like the figure under it, to 0.6 by 20 m. */
const markScale = (far: number) => THREE.MathUtils.clamp(12 / far, 0.6, 1);
/** Names shrink less: they must stay readable. */
const nameScale = (far: number) => THREE.MathUtils.clamp(9 / far, 0.78, 1);

interface Tag {
  mark: HTMLDivElement | null;
  name: HTMLDivElement | null;
  text: string;
  width: number;
}

interface Placed {
  el: HTMLDivElement;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  far: number;
  /** Lower goes first and keeps its place. */
  rank: number;
  /** The figure's own marker, which a name stands on. */
  on?: Placed;
}

/**
 * Labels above heads, as positioned DOM elements: teammates' names near and team markers far, the name of whoever is
 * under the crosshair, and (when a line-of-sight test is given) a chevron over enemies in plain sight within
 * SIGHT_RANGE; never through walls. Markers that would overlap are stacked, nearer below; names sit above their
 * figure's marker, so a name never covers another figure's marker, and stack the same way.
 */
export class NameTags {
  private tags = new Map<number, Tag>();
  private sight = new Map<number, { at: number; clear: boolean }>();
  private v = new THREE.Vector3();
  private readonly alerts: GrenadeAlerts;
  private grenades: GrenadeView | undefined;

  constructor(
    private readonly container: HTMLElement,
    private readonly clearLine?: ClearLine
  ) {
    this.alerts = new GrenadeAlerts(container, clearLine);
  }

  update(camera: THREE.Camera, remotes: Remotes, aimed: number, myTeam: number, width: number, height: number) {
    const seen = new Set<number>();
    const marks: Placed[] = [];
    const names: Placed[] = [];
    const now = performance.now();
    const eye = camera.position;
    for (const r of remotes.map.values()) {
      if (!r.visible) continue;
      const teammate = myTeam !== -1 && r.entry.team === myTeam;
      const isAimed = r.entry.id === aimed;
      const far = Math.hypot(r.position.x - eye.x, r.position.z - eye.z);
      const spot = teammate ? 1 : THREE.MathUtils.smoothstep(far, SPOT_IN[0], SPOT_IN[1]) * (1 - THREE.MathUtils.smoothstep(far, SIGHT_RANGE - 4, SIGHT_RANGE));
      const marked = teammate ? far > NAME_RANGE : spot > 0.02 && this.inSight(r.entry.id, eye, r.position.x, r.position.y + 1.5, r.position.z, now);
      const named = isAimed || (teammate && !marked);
      if (!marked && !named) continue;
      const over = r.rig.headPosition(this.v).y + OVER_HEAD * (r.entry.bot === 'boss' ? 1.6 : 1);
      this.v.set(r.position.x, over, r.position.z).project(camera);
      if (this.v.z > 1) continue;
      seen.add(r.entry.id);
      const tag = this.tag(r.entry.id);
      const x = (this.v.x * 0.5 + 0.5) * width;
      const y = (-this.v.y * 0.5 + 0.5) * height;
      const nameY = (-this.v.set(r.position.x, over + NAME_OVER, r.position.z).project(camera).y * 0.5 + 0.5) * height;
      const color = teammate ? TEAM_COLORS[myTeam as 0 | 1] : '#ff4a3a';
      let mark: Placed | undefined;
      if (marked) {
        const el = this.markEl(tag, teammate ? DIAMOND_SVG : CHEVRON_SVG);
        el.style.color = color;
        el.style.opacity = teammate ? '0.95' : (0.95 * spot).toFixed(2);
        const scale = markScale(far);
        mark = { el, x, y, w: MARK.w * scale, h: MARK.h * scale, scale, far, rank: far };
        marks.push(mark);
      } else this.dropMark(tag);
      if (named) {
        const el = this.nameEl(tag, r.entry.name, teammate ? color : null);
        const scale = nameScale(far);
        names.push({ el, x, y: nameY, w: tag.width * scale, h: PILL_H * scale, scale, far, rank: (isAimed ? 0 : 1000) + far, on: mark });
      } else this.dropName(tag);
    }
    // Nearer markers keep their spot; a farther one that would overlap is lifted above it, so a row of figures reads
    // as markers over each, never as one strip.
    stack(marks, []);
    for (const m of marks) place(m.el, m.x, m.y, m.scale);
    // A name stands on its own figure's marker, then clears every other marker and the names placed before it (the
    // aimed one first, then nearer ones).
    for (const n of names) if (n.on) n.y = Math.min(n.y, n.on.y - n.on.h - 1);
    stack(names, marks);
    for (const n of names) place(n.el, n.x, n.y, n.scale);
    for (const [id, tag] of this.tags) {
      if (seen.has(id)) continue;
      this.dropMark(tag);
      this.dropName(tag);
      this.tags.delete(id);
    }
    // The match keeps its grenades in a scene group of this name, beside the remotes' group.
    this.grenades ??= remotes.group.parent?.children.find((o) => o.name === 'grenades')?.userData.view as GrenadeView | undefined;
    const g = this.grenades;
    this.alerts.update(camera, g?.live ?? [], g?.self ?? null, (id) => remotes.map.get(id)?.entry.team ?? -1, myTeam, width, height);
  }

  private tag(id: number) {
    let t = this.tags.get(id);
    if (!t) {
      t = { mark: null, name: null, text: '', width: 0 };
      this.tags.set(id, t);
    }
    return t;
  }

  private markEl(tag: Tag, svg: string) {
    if (!tag.mark) {
      tag.mark = document.createElement('div');
      tag.mark.className = 'absolute left-0 top-0';
      this.container.appendChild(tag.mark);
    }
    if (tag.mark.dataset.kind !== svg) {
      tag.mark.dataset.kind = svg;
      tag.mark.innerHTML = svg;
    }
    return tag.mark;
  }

  /** A name pill: white on the team's colour for a teammate, warm red on dark for an enemy. */
  private nameEl(tag: Tag, text: string, team: string | null) {
    if (!tag.name) {
      tag.name = document.createElement('div');
      tag.name.className = 'bf-display bf-hud-text absolute left-0 top-0 whitespace-nowrap text-xl leading-7';
      Object.assign(tag.name.style, { padding: '0 10px 2px', borderRadius: '10px', marginBottom: '3px', borderWidth: '2px', borderStyle: 'solid' });
      this.container.appendChild(tag.name);
    }
    const el = tag.name;
    const look = team ?? 'enemy';
    if (el.dataset.look !== look) {
      el.dataset.look = look;
      el.style.background = team ? `color-mix(in srgb, ${team} 72%, #000)` : 'rgba(16,8,10,.78)';
      el.style.borderColor = team ? 'rgba(255,255,255,.55)' : 'rgba(255,90,70,.75)';
      el.style.color = team ? '#ffffff' : '#ff8a7a';
    }
    if (tag.text !== text) {
      tag.text = text;
      el.textContent = text;
      tag.width = el.offsetWidth;
    }
    return el;
  }

  private dropMark(tag: Tag) {
    tag.mark?.remove();
    tag.mark = null;
  }

  private dropName(tag: Tag) {
    tag.name?.remove();
    tag.name = null;
    tag.text = '';
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
    this.alerts.clear();
    for (const tag of this.tags.values()) {
      this.dropMark(tag);
      this.dropName(tag);
    }
    this.tags.clear();
    this.sight.clear();
  }
}

/**
 * Bottom-anchored boxes by rank: each keeps its place unless it overlaps one placed before it or one of `fixed`, and is
 * then lifted just above that one, up to a few times.
 */
function stack(items: Placed[], fixed: Placed[]) {
  items.sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < items.length; i++) {
    const c = items[i]!;
    const others = [...items.slice(0, i), ...fixed.filter((f) => f !== c.on)];
    for (let step = 0; step < 4; step++) {
      const hit = others.find((o) => Math.abs(o.x - c.x) < (o.w + c.w) / 2 + 2 && c.y > o.y - o.h && c.y - c.h < o.y);
      if (!hit) break;
      c.y = hit.y - hit.h - 1;
    }
  }
}

/** Anchors a tag's bottom centre at (x, y), scaled about that point. */
function place(el: HTMLDivElement, x: number, y: number, scale: number) {
  el.style.transformOrigin = '50% 100%';
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
}
