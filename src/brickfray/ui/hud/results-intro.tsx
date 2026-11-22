import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { number } from '../board/format';
import { useT } from '../i18n';

/** Seconds the entrance takes; past this nothing is left to skip. */
export const INTRO_SECONDS = 1.8;
/** Input in the first moment is still the match's (a held trigger, a strafe key) and does not skip. */
const ARM_MS = 400;

const Skipped = createContext(false);
export const IntroSkipped = Skipped.Provider;

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The entrance plays once and any input cuts it short: a key (which then does nothing else, so a first Enter does not
 * also press the focused button), a click or tap anywhere (a press on a button still goes through), the wheel.
 * Skipping finishes every entrance animation under `root` that is still to play; what mounts later (the leaderboard
 * badge once the server answers) still plays its own.
 */
export function useIntro(root: RefObject<HTMLElement | null>): boolean {
  const [skipped, setSkipped] = useState(reducedMotion);
  useEffect(() => {
    if (skipped) return;
    const armedAt = performance.now() + ARM_MS;
    const skip = (e: Event) => {
      if (performance.now() < armedAt) return;
      if (e instanceof KeyboardEvent && (e.repeat || e.key === 'Tab')) return;
      const entrance = (root.current?.getAnimations({ subtree: true }) ?? []).filter((a) => a.playState !== 'finished' && Number.isFinite(a.effect?.getComputedTiming().endTime));
      // Confetti still falling is not worth a key press; anything else still moving is.
      const moving = entrance.some((a) => !(a.effect instanceof KeyframeEffect && a.effect.target?.closest('.bf-confetti')));
      if (moving && e instanceof KeyboardEvent) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      for (const a of entrance) a.finish();
      setSkipped(true);
    };
    const done = window.setTimeout(() => setSkipped(true), INTRO_SECONDS * 1000);
    const opts = { capture: true };
    window.addEventListener('keydown', skip, opts);
    window.addEventListener('pointerdown', skip, opts);
    window.addEventListener('wheel', skip, opts);
    return () => {
      window.clearTimeout(done);
      window.removeEventListener('keydown', skip, opts);
      window.removeEventListener('pointerdown', skip, opts);
      window.removeEventListener('wheel', skip, opts);
    };
  }, [skipped, root]);
  return skipped;
}

/** A number that counts up from `from` after `delay` seconds of the entrance; the final value once skipped. */
export function CountUp({ value, from = 0, delay = 0, duration = 0.7, format }: { value: number; from?: number; delay?: number; duration?: number; format?: (n: number) => string }) {
  const skipped = useContext(Skipped);
  const { lang } = useT();
  const [shown, setShown] = useState(skipped ? value : Math.min(from, value));
  const start = useRef(performance.now());
  useEffect(() => {
    if (skipped) {
      setShown(value);
      return;
    }
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, Math.max(0, ((performance.now() - start.current) / 1000 - delay) / duration));
      const base = Math.min(from, value);
      setShown(Math.round(base + (value - base) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [skipped, value, from, delay, duration]);
  return <>{format ? format(shown) : number(lang, shown)}</>;
}
