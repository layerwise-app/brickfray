import type * as THREE from 'three';
import { SIDEARMS, type WeaponId } from '../defs';
import type { Clip, ClipPlayer } from './clip';
import { DRAW_MARGIN, drawClip, drawEdge, holsterClip } from './clips-extra';
import { outOfFrame } from './frame-out';
import type { GunRig } from './rig';

/** A switch re-issued mid-holster gets the old gun out of the picture within this many seconds. */
const HURRY = 0.08;

/** What a weapon switch needs from the view model. */
export interface SwitchHost {
  readonly player: ClipPlayer;
  readonly camera: THREE.Camera;
  gun(): GunRig;
  play(clip: Clip): void;
  /** Puts `id` in the hands, nothing drawn yet. */
  setGun(id: WeaponId): GunRig;
  /** Whether `rig` at its hip rest plus the clip offset `offset` lies wholly outside the frame grown `margin` times. */
  outside(rig: GunRig, offset: readonly number[], margin: number): boolean;
  /** The new gun is in the hands: what the old one's clips left carried over (hands, parts, held things) is let go. */
  fresh(): void;
}

/**
 * Weapon switching: the old gun is holstered out of the picture and the new one drawn from wholly outside it. A switch
 * asked for with a bomb still in the hand waits for that throw's release; one re-issued mid-holster brings the same gun
 * straight back or hurries the old one out.
 */
export class Switcher {
  private pendingDraw = 0;
  private pendingWeapon: WeaponId | null = null;
  private waiting: { clip: Clip; release: number; to: WeaponId; holster: number; draw: number; since: number } | null = null;

  constructor(private readonly host: SwitchHost) {}

  reset() {
    this.pendingWeapon = this.waiting = null;
  }

  request(to: WeaponId, holster: number, draw: number) {
    const player = this.host.player;
    const clip = player.clip;
    const release = clip?.name === 'throw' ? (clip.events.find((e) => e[1] === 'release')?.[0] ?? 0) : 0;
    if (clip && player.u < release) {
      this.waiting = { clip, release, to, holster, draw, since: player.time };
      return;
    }
    if (clip?.name === 'holster' && this.pendingWeapon) {
      // Re-issued while the old gun is still on its way down: it comes straight back up if it is wanted again, else it hurries out.
      if (to === this.host.gun().id) {
        this.pendingWeapon = null;
        return this.host.play(drawClip(Math.max(0.05, draw)));
      }
      player.hurry(HURRY);
      this.pendingWeapon = to;
      this.pendingDraw = draw - player.left;
      return;
    }
    this.pendingWeapon = to;
    this.pendingDraw = draw;
    this.host.play(holsterClip(Math.max(0.05, holster), to));
  }

  /** The holster's tail, once the old gun is out of the picture, goes to the new gun's draw. */
  swap() {
    const to = this.pendingWeapon;
    if (!to) return;
    const host = this.host;
    const from = host.gun().id;
    const draw = this.pendingDraw + host.player.left;
    const rig = host.setGun(to);
    this.pendingWeapon = null;
    const edge = drawEdge(from, rig.id, rig.tuning.stow ?? 1, (offset) => host.outside(rig, offset, DRAW_MARGIN));
    host.play(drawClip(Math.max(0.05, draw), SIDEARMS.has(rig.id), from, edge));
    // Both hands come up on the new gun, so it never shows before them.
    host.fresh();
  }

  /** Each frame, after the clip has run: the swap as soon as the old gun has left the picture, and a waiting switch let go. */
  update() {
    const player = this.host.player;
    if (this.pendingWeapon && player.clip?.name === 'holster' && outOfFrame(this.host.gun().rigged.model.root, this.host.camera, DRAW_MARGIN)) this.swap();
    const w = this.waiting;
    if (w && (player.clip !== w.clip || player.u >= w.release)) {
      // The holster makes up the wait, so the new gun is still up when the game expects it.
      this.waiting = null;
      this.request(w.to, w.holster - Math.max(0, player.time - w.since), w.draw);
    }
  }
}
