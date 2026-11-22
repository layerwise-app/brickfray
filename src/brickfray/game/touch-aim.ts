import * as THREE from 'three';
import { rayHitPlayer } from '../sim/hitboxes';
import type { MatchView } from './match-view';

/** Auto-fire never reaches past this (m). */
const REACH = 120;
const dir = new THREE.Vector3();

/** True while the crosshair is on an enemy (another team, or anyone in free-for-all) with no wall in between. */
export function enemyInSights(match: MatchView): boolean {
  if (!match.me.alive) return false;
  const cam = match.fp.camera;
  const d = cam.getWorldDirection(dir);
  const o = cam.position;
  const wall = match.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, REACH, true);
  const reach = wall?.t ?? REACH;
  const team = match.myTeam;
  for (const r of match.remotes.map.values()) {
    if (!r.alive || (team !== -1 && r.entry.team === team)) continue;
    const pose = match.remotes.pose(r);
    if (pose && rayHitPlayer(pose, o.x, o.y, o.z, d.x, d.y, d.z, reach)) return true;
  }
  return false;
}
