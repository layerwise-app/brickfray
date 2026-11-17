import * as THREE from 'three';
import { TEAM_COLORS, type Remotes } from './remotes';

/**
 * Names above heads, as positioned DOM labels: teammates always, enemies only
 * while they're under the crosshair — no clutter otherwise.
 */
export class NameTags {
  private tags = new Map<number, HTMLDivElement>();
  private v = new THREE.Vector3();

  constructor(private readonly container: HTMLElement) {}

  update(camera: THREE.Camera, remotes: Remotes, aimed: number, myTeam: number, width: number, height: number) {
    const seen = new Set<number>();
    for (const r of remotes.map.values()) {
      const teammate = myTeam !== -1 && r.entry.team === myTeam;
      if (!r.visible || (!teammate && r.entry.id !== aimed)) continue;
      this.v.set(r.position.x, r.position.y + (r.entry.bot === 'boss' ? 3.1 : 2.1), r.position.z).project(camera);
      if (this.v.z > 1) continue;
      seen.add(r.entry.id);
      let tag = this.tags.get(r.entry.id);
      if (!tag) {
        tag = document.createElement('div');
        tag.className = 'bf-display bf-hud-text absolute left-0 top-0 whitespace-nowrap text-lg';
        this.container.appendChild(tag);
        this.tags.set(r.entry.id, tag);
      }
      if (tag.textContent !== r.entry.name) tag.textContent = r.entry.name;
      tag.style.color = teammate ? TEAM_COLORS[myTeam as 0 | 1] : '#ff5a4a';
      const x = (this.v.x * 0.5 + 0.5) * width;
      const y = (-this.v.y * 0.5 + 0.5) * height;
      tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const [id, tag] of this.tags) {
      if (seen.has(id)) continue;
      tag.remove();
      this.tags.delete(id);
    }
  }

  clear() {
    for (const tag of this.tags.values()) tag.remove();
    this.tags.clear();
  }
}
