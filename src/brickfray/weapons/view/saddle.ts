import type { GunRig } from './rig';

/**
 * A gun's side carrier of shells (`saddle0`…`saddleN` parts): which slots the hand has emptied since the gun was last
 * drawn (it is refilled out of sight, holstered). Shells come out front to back; odd slots carry the blue hulls.
 */
export class Saddle {
  private taken = 0;

  /** The gun was (re)drawn: a full carrier. */
  reset() {
    this.taken = 0;
  }

  /** The slot `ahead` shells from now, if the carrier still holds one. */
  slot(gun: GunRig, ahead: number): number | null {
    const slot = this.taken + ahead;
    return gun.rigged.parts.has(`saddle${slot}`) ? slot : null;
  }

  /** The hand has drawn the next shell. */
  take() {
    this.taken++;
  }

  /** Shows the shells still in their slots. */
  show(gun: GunRig) {
    for (let i = 0, shell; (shell = gun.rigged.parts.get(`saddle${i}`)); i++) shell.visible = i >= this.taken;
  }
}

/** Whether a carrier slot holds a blue hull (they alternate with red). */
export const blueHull = (slot: number | null) => slot !== null && slot % 2 === 1;
