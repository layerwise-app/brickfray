import { useEffect, useRef } from 'react';
import type { HudPulse } from '../../game/hud';
import { useGame } from '../App';
import { useT } from '../i18n';

/**
 * Crosshair, hit markers and damage arcs update every frame from HUD pulses,
 * by writing styles directly instead of re-rendering React.
 */
const HEAD_GOLD = '#ffd23f';

/**
 * A bold crescent with a wedge pointing at the shooter, on a ring about 0.36 of the screen's short side out (clear of
 * whatever is being aimed at). Toward the lower right, where the held gun fills the screen, the ring pulls in to about
 * 0.19 so the crescent sits between the crosshair and the gun instead of on it. `angle` is clockwise from straight
 * ahead (screen up); sized in viewport units (400 units = 92vmin).
 */
const FAR = 158;
const NEAR = 76;
const GUN_SIDE = (140 * Math.PI) / 180;
function hurtArc(angle: number) {
  const off = Math.abs(Math.atan2(Math.sin(angle - GUN_SIDE), Math.cos(angle - GUN_SIDE)));
  const t = Math.min(1, Math.max(0, (off - (32 * Math.PI) / 180) / ((30 * Math.PI) / 180)));
  const R = NEAR + (FAR - NEAR) * t * t * (3 - 2 * t);
  const span = 16 * Math.sqrt(FAR / R);
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const u = -1 + (2 * i) / 20;
    const a = (u * span * Math.PI) / 180;
    const half = 3.7 * Math.cos(u * (Math.PI / 2)) ** 0.7 + 0.45;
    const at = (r: number) => `${(Math.sin(a) * r).toFixed(1)},${(-Math.cos(a) * r).toFixed(1)}`;
    outer.push(at(R + half));
    inner.unshift(at(R - half));
  }
  const path = `M${outer.join('L')}L${inner.join('L')}Z`;
  const tip = `M-6,${-R - 3.2}L0,${-R - 11}L6,${-R - 3.2}Z`;
  const ink = 'stroke="rgba(45,0,0,.85)" stroke-width="1.4" stroke-linejoin="round"';
  return `<svg viewBox="-200 -200 400 400" style="display:block;overflow:visible;width:92vmin;height:92vmin"><path d="${tip}" fill="#ff3b30" ${ink}/><path d="${path}" fill="#ff3b30" ${ink}/><path d="${path}" fill="none" stroke="rgba(255,190,170,.55)" stroke-width=".7" transform="scale(.995)"/></svg>`;
}

export function Crosshair({ hidden }: { hidden: boolean }) {
  const game = useGame();
  const { t } = useT();
  const cross = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const callout = useRef<HTMLDivElement>(null);
  const arcs = useRef<HTMLDivElement>(null);
  const numbers = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribes to the game's per-frame HUD pulses
  useEffect(() => {
    let markerTimer = 0;
    let calloutTimer = 0;
    // Restart a CSS transition from `from` styles to `to` styles.
    const play = (el: HTMLElement, from: Partial<CSSStyleDeclaration>, to: Partial<CSSStyleDeclaration>, transition: string) => {
      el.style.transition = 'none';
      Object.assign(el.style, from);
      void el.offsetWidth;
      el.style.transition = transition;
      Object.assign(el.style, to);
    };
    const onPulse = (p: HudPulse) => {
      if (p.type === 'spread' && cross.current) {
        const gap = Math.max(5, Math.min(70, p.px)) * game.settings.crosshair.gap;
        cross.current.style.setProperty('--gap', `${gap}px`);
        return;
      }
      if (p.type === 'hit' && marker.current) {
        const el = marker.current;
        const head = p.kind === 'head' || !!p.headshot;
        const color = p.kind === 'kill' ? '#ff3b30' : head ? HEAD_GOLD : '#ffffff';
        el.style.setProperty('--hit', color);
        el.style.setProperty('--thick', head ? '4.5px' : '4px');
        el.style.setProperty('--len', head ? '15px' : '14px');
        el.style.opacity = '1';
        el.style.transition = 'none';
        // Head hits pop in large and settle, so they read even mid-spray.
        const settle = p.kind === 'body' ? 1 : 1.35;
        play(el.firstElementChild as HTMLElement, { transform: `translate(-50%,-50%) scale(${head ? 1.9 : settle * 1.35})` }, { transform: `translate(-50%,-50%) scale(${settle})` }, 'transform .12s ease-out');
        clearTimeout(markerTimer);
        markerTimer = window.setTimeout(() => {
          el.style.transition = 'opacity .18s ease';
          el.style.opacity = '0';
        }, p.kind === 'kill' ? 260 : head ? 220 : 110);
        if (head && ring.current) {
          play(ring.current, { opacity: '1', transform: 'translate(-50%,-50%) scale(.45)' }, { opacity: '0', transform: 'translate(-50%,-50%) scale(1.5)' }, 'transform .32s ease-out, opacity .32s ease-in');
        }
        if (p.headshot && callout.current) {
          const c = callout.current;
          play(c, { opacity: '1', transform: 'translate(-50%, 0) scale(1.5)' }, { opacity: '1', transform: 'translate(-50%, 0) scale(1)' }, 'transform .18s cubic-bezier(.2,1.6,.4,1)');
          clearTimeout(calloutTimer);
          calloutTimer = window.setTimeout(() => {
            c.style.transition = 'opacity .3s ease';
            c.style.opacity = '0';
          }, 900);
        }
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
        const strength = Math.min(1, 0.55 + p.amount / 45);
        const arc = document.createElement('div');
        arc.className = 'absolute left-1/2 top-1/2';
        arc.style.transform = `translate(-50%, -50%) rotate(${p.angle}rad)`;
        arc.style.filter = 'drop-shadow(0 1px 2px rgba(30,0,0,.75)) drop-shadow(0 0 6px rgba(255,40,20,.5))';
        arc.innerHTML = hurtArc(p.angle);
        arc.style.opacity = String(strength);
        // A flash on the screen edge the shot came from, as strong as the hit was hard.
        const hard = Math.min(1, p.amount / 50);
        const x = 50 + Math.sin(p.angle) * 62;
        const y = 50 - Math.cos(p.angle) * 62;
        const edge = document.createElement('div');
        edge.className = 'absolute inset-0';
        edge.style.background = `radial-gradient(ellipse 55% 55% at ${x.toFixed(1)}% ${y.toFixed(1)}%, rgba(225,28,14,.75), rgba(225,28,14,0) 70%)`;
        edge.style.opacity = String(0.4 + 0.5 * hard);
        arcs.current.appendChild(edge);
        arcs.current.appendChild(arc);
        requestAnimationFrame(() => {
          arc.style.transition = 'opacity .35s ease-in .25s';
          edge.style.transition = 'opacity .45s ease-in .1s';
          arc.style.opacity = '0';
          edge.style.opacity = '0';
        });
        setTimeout(() => {
          arc.remove();
          edge.remove();
        }, 700);
      }
    };
    const off = game.hud.onPulse(onPulse);
    return () => {
      off();
      clearTimeout(markerTimer);
      clearTimeout(calloutTimer);
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
      <div ref={marker} className='pointer-events-none absolute left-1/2 top-1/2 opacity-0' style={{ ['--hit' as string]: '#fff', ['--thick' as string]: '3px', ['--len' as string]: '11px' }}>
        <div className='absolute' style={{ transform: 'translate(-50%,-50%)' }}>
          {[45, 135, 225, 315].map((deg) => (
            <span
              key={deg}
              className='absolute'
              style={{
                width: 'var(--thick)',
                height: 'var(--len)',
                background: 'var(--hit)',
                borderRadius: 1,
                boxShadow: '0 0 0 1.5px rgba(0,0,0,.8), 0 1px 3px rgba(0,0,0,.5)',
                left: 'calc(var(--thick) / -2)',
                top: 'calc(var(--len) / -2)',
                transform: `rotate(${deg}deg) translateY(-15px)`
              }}
            />
          ))}
        </div>
      </div>
      <div
        ref={ring}
        className='pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 rounded-full opacity-0'
        style={{ border: `3px solid ${HEAD_GOLD}`, boxShadow: '0 0 0 1px rgba(0,0,0,.35), inset 0 0 0 1px rgba(0,0,0,.35)' }}
      />
      <div
        ref={callout}
        className='bf-display bf-hud-text pointer-events-none absolute left-1/2 top-[calc(50%+44px)] whitespace-nowrap text-2xl uppercase tracking-wide opacity-0'
        style={{ color: HEAD_GOLD }}
      >
        {t('headshot')}
      </div>
    </>
  );
}
