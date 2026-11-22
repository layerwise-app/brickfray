import type { Game } from '../../game/game';

/** Short buzzes (ms, or an on/off pattern) for the player's own shots, hits, kills and the hits they take. */
const SHOT = 10;
const HIT = 16;
const HEAD = 26;
const KILL = [0, 20, 45, 34];

/** Vibration where the device has it (Android; iPhone Safari has none) and the player wants it. */
export function watchHaptics(game: Game) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return () => undefined;
  const buzz = (pattern: number | number[]) => {
    if (game.settings.input.touch.haptics) navigator.vibrate(pattern);
  };
  let { ammo, weapon } = game.hud.state;
  const offState = game.hud.subscribe(() => {
    const s = game.hud.state;
    if (s.alive && s.weapon === weapon && s.ammo < ammo) buzz(SHOT);
    ammo = s.ammo;
    weapon = s.weapon;
  });
  const offPulse = game.hud.onPulse((p) => {
    if (p.type === 'hit') buzz(p.kind === 'kill' ? KILL : p.kind === 'head' ? HEAD : HIT);
    else if (p.type === 'hurt') buzz(Math.min(60, 24 + p.amount));
  });
  return () => {
    offState();
    offPulse();
  };
}
