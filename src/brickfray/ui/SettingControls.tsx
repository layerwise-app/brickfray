import { useRef } from 'react';
import { frameRect, toFrame, useFrame } from './touch/landscape';
import { useTouchMode } from './touch/useInputMode';

/** How far (px) a finger moves before a touch on a slider counts as sliding it (sideways) or scrolling the list (up or down). */
const SLOP = 8;
/** Half the slider's thumb by touch (touch.css): the thumb's center stops this far inside the track's ends. */
const THUMB_HALF = 15;

/**
 * A slider. By mouse and keyboard it is the browser's own; by touch the browser's would jump to the finger the moment
 * it lands, so a swipe meant to scroll the settings list moved it first. Here a touch moves it only once the finger
 * goes sideways, or on a tap; a swipe up or down scrolls the list (touch-action: pan-y). On a phone held upright the app
 * is turned and the browser would read pan-y across the screen, so there the swipe scrolls the list from here.
 */
export function Range({ value, min, max, step, onValue }: { value: number; min: number; max: number; step: number; onValue: (value: number) => void }) {
  const touchMode = useTouchMode();
  const { rotated } = useFrame();
  const input = useRef<HTMLInputElement>(null);
  const finger = useRef<{ id: number; x: number; y: number; sliding: boolean; list: Element | null } | null>(null);

  const valueAt = (x: number) => {
    const box = frameRect(input.current!);
    const ratio = Math.min(1, Math.max(0, (x - box.left - THUMB_HALF) / Math.max(1, box.width - 2 * THUMB_HALF)));
    const steps = Math.round((ratio * (max - min)) / step);
    const decimals = String(step).split('.')[1]?.length ?? 0;
    return Number(Math.min(max, min + steps * step).toFixed(decimals));
  };
  const set = (x: number) => {
    const next = valueAt(x);
    if (next !== value) onValue(next);
  };

  return (
    <div
      className='relative col-span-2 flex items-center'
      style={{ touchAction: rotated ? 'none' : 'pan-y', minHeight: touchMode ? 44 : undefined }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' || finger.current) return;
        const at = toFrame(e.clientX, e.clientY);
        finger.current = { id: e.pointerId, x: at.x, y: at.y, sliding: false, list: null };
      }}
      onPointerMove={(e) => {
        const f = finger.current;
        if (f?.id !== e.pointerId) return;
        const at = toFrame(e.clientX, e.clientY);
        if (f.list) {
          f.list.scrollTop -= at.y - f.y;
          f.y = at.y;
          return;
        }
        if (!f.sliding) {
          const dx = Math.abs(at.x - f.x);
          const dy = Math.abs(at.y - f.y);
          if (dy > SLOP && dy >= dx) {
            f.list = rotated ? scrollParent(e.currentTarget) : null;
            if (!f.list) finger.current = null;
            else e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (dx <= SLOP || dx < dy) return;
          f.sliding = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        set(at.x);
      }}
      onPointerUp={(e) => {
        const f = finger.current;
        if (f?.id !== e.pointerId) return;
        finger.current = null;
        if (!f.sliding && !f.list) set(toFrame(e.clientX, e.clientY).x);
      }}
      onPointerCancel={() => (finger.current = null)}
    >
      <input
        ref={input}
        type='range'
        className='bf-range'
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%`, pointerEvents: touchMode ? 'none' : undefined }}
        onChange={(e) => onValue(Number(e.target.value))}
      />
    </div>
  );
}

function scrollParent(el: Element) {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const overflow = getComputedStyle(n).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/** A setting that is on or off: its name (and a line about it) and a switch. */
export function SwitchRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className='bf-setting flex shrink-0 cursor-pointer items-center gap-4'>
      <span className='flex flex-1 flex-col'>
        <span className='font-medium'>{label}</span>
        {hint && <span className='text-sm text-[var(--bf-muted)]'>{hint}</span>}
      </span>
      <button role='switch' aria-checked={on} onClick={() => onChange(!on)} className='grid h-11 w-14 shrink-0 place-items-center'>
        <span className={`relative h-8 w-14 rounded-full transition-colors ${on ? 'bg-[var(--bf-yellow)]' : 'bg-white/15'}`}>
          <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-0'}`} />
        </span>
      </button>
    </label>
  );
}
