import { useEffect, useRef } from 'react';
import type { HudPulse } from '../../game/hud';
import { useGame } from '../App';

/**
 * Crosshair, hit markers and damage arcs update every frame from HUD pulses,
 * by writing styles directly instead of re-rendering React.
 */
export function Crosshair({ hidden }: { hidden: boolean }) {
  const game = useGame();
  const cross = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const arcs = useRef<HTMLDivElement>(null);
  const numbers = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribes to the game's per-frame HUD pulses
  useEffect(() => {
    let markerTimer = 0;
    const onPulse = (p: HudPulse) => {
      if (p.type === 'spread' && cross.current) {
        const gap = Math.max(5, Math.min(70, p.px)) * game.settings.crosshair.gap;
        cross.current.style.setProperty('--gap', `${gap}px`);
        return;
      }
      if (p.type === 'hit' && marker.current) {
        const el = marker.current;
        const color = p.kind === 'kill' ? '#ff3b30' : p.kind === 'head' ? '#ffd23f' : '#ffffff';
        el.style.setProperty('--hit', color);
        el.style.setProperty('--scale', p.kind === 'body' ? '1' : '1.35');
        el.style.opacity = '1';
        el.style.transition = 'none';
        clearTimeout(markerTimer);
        markerTimer = window.setTimeout(() => {
          el.style.transition = 'opacity .18s ease';
          el.style.opacity = '0';
        }, p.kind === 'kill' ? 260 : 110);
        if (game.settings.damageNumbers && p.amount > 0 && numbers.current) {
          const n = document.createElement('div');
          n.textContent = String(p.amount);
          n.className = 'bf-display bf-hud-text absolute left-1/2 top-1/2 text-xl';
          n.style.color = color;
          n.style.transform = `translate(${20 + Math.random() * 20}px, -40px)`;
          n.style.transition = 'transform .6s ease-out, opacity .6s ease-in';
          numbers.current.appendChild(n);
          requestAnimationFrame(() => {
            n.style.transform = `translate(${30 + Math.random() * 30}px, -90px)`;
            n.style.opacity = '0';
          });
          setTimeout(() => n.remove(), 650);
        }
        return;
      }
      if (p.type === 'hurt' && arcs.current) {
        const el = document.createElement('div');
        el.className = 'absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2';
        el.style.transform = `translate(-50%, -50%) rotate(${p.angle}rad)`;
        el.style.background = `radial-gradient(ellipse 36% 9% at 50% 4%, rgba(255,40,30,${Math.min(0.95, 0.45 + p.amount / 60)}) 0 60%, transparent 100%)`;
        el.style.transition = 'opacity .9s ease-in';
        arcs.current.appendChild(el);
        requestAnimationFrame(() => (el.style.opacity = '0'));
        setTimeout(() => el.remove(), 950);
      }
    };
    const off = game.hud.onPulse(onPulse);
    return () => {
      off();
      clearTimeout(markerTimer);
    };
  }, []);

  const { color, size, dot } = game.settings.crosshair;
  const len = 8 * size;
  const bar = { background: color, boxShadow: '0 0 0 1px rgba(0,0,0,.55)' };
  return (
    <>
      <div ref={arcs} className='pointer-events-none absolute inset-0' />
      <div ref={numbers} className='pointer-events-none absolute inset-0' />
      <div ref={cross} className='pointer-events-none absolute left-1/2 top-1/2' style={{ ['--gap' as string]: '10px', opacity: hidden ? 0 : 1, transition: 'opacity .12s' }}>
        <span className='absolute' style={{ ...bar, width: 2, height: len, left: -1, top: `calc(-1 * var(--gap) - ${len}px)` }} />
        <span className='absolute' style={{ ...bar, width: 2, height: len, left: -1, top: 'var(--gap)' }} />
        <span className='absolute' style={{ ...bar, height: 2, width: len, top: -1, left: `calc(-1 * var(--gap) - ${len}px)` }} />
        <span className='absolute' style={{ ...bar, height: 2, width: len, top: -1, left: 'var(--gap)' }} />
        {dot && <span className='absolute rounded-full' style={{ ...bar, width: 3, height: 3, left: -1.5, top: -1.5 }} />}
      </div>
      <div ref={marker} className='pointer-events-none absolute left-1/2 top-1/2 opacity-0' style={{ ['--hit' as string]: '#fff', ['--scale' as string]: '1' }}>
        <div className='absolute' style={{ transform: 'translate(-50%,-50%) scale(var(--scale))' }}>
          {[45, 135, 225, 315].map((deg) => (
            <span
              key={deg}
              className='absolute'
              style={{ width: 3, height: 11, background: 'var(--hit)', boxShadow: '0 0 0 1px rgba(0,0,0,.6)', left: -1.5, top: -5.5, transform: `rotate(${deg}deg) translateY(-13px)` }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
