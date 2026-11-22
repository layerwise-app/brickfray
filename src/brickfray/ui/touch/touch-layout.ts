import type { TouchButton } from '../../game/touch-input';

/**
 * Where a control sits at button size 1: its centre `x` px in from the screen edge on its side and `y` px up from the
 * bottom (both inside the safe area), `d` px across. The action buttons arc around fire under the aiming thumb and
 * leave the space straight above fire free, where that thumb lands to look; the stick side keeps a second fire button
 * above where the moving thumb rests.
 */
export interface Spot {
  id: TouchButton;
  x: number;
  y: number;
  d: number;
}

export const ACTION_SPOTS: readonly Spot[] = [
  { id: 'fire', x: 114, y: 108, d: 88 },
  { id: 'crouch', x: 40, y: 40, d: 56 },
  { id: 'jump', x: 40, y: 180, d: 58 },
  { id: 'ads', x: 220, y: 72, d: 62 },
  { id: 'reload', x: 232, y: 170, d: 52 },
  { id: 'grenade', x: 160, y: 238, d: 56 },
  { id: 'melee', x: 292, y: 120, d: 50 },
  { id: 'swap', x: 40, y: 252, d: 50 }
];

/** Takes the jump button's place while scoped: the scope's breath hold. */
export const STEADY_SPOT: Spot = { id: 'steady', x: 40, y: 180, d: 58 };

export const FIRE_LEFT_SPOT: Spot = { id: 'fireLeft', x: 84, y: 198, d: 68 };

/** Buttons a finger can keep dragging to aim with. */
export const DRAG_AIMS: ReadonlySet<TouchButton> = new Set(['fire', 'ads', 'grenade']);

/** The stick's resting place (centre, from the stick-side bottom corner), ring radius and knob size at size 1. */
export const STICK = { x: 150, y: 124, radius: 58, knob: 52 };
/** Dragged this many radii straight up from the stick's centre, letting go locks the run. */
export const RUN_LOCK = 1.65;

/** Top-corner buttons: pause and the scoreboard. */
export const TOP_BUTTON = 44;
