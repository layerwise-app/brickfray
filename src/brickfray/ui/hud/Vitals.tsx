import { useEffect, useState } from 'react';
import { useGame, useHud } from '../App';
import { WeaponIcon } from '../icons';
import { UpgradeIcon } from './UpgradeIcon';

/** Share of max health below which the screen edges and the health bar turn to warning red. */
export const LOW_HEALTH = 0.45;

const PLATE = 'rounded-2xl bg-black/35 px-3 pb-1.5 pt-1 shadow-[0_3px_0_rgba(0,0,0,.25)]';
const WARN_TEXT = '#ff6a5c';
const WARN_FILL = '#ff4a3d';
const FLASH_KEYFRAMES = `@keyframes bf-hp-flash { 0%, 30% { opacity: 1; } 100% { opacity: 0; } }
@keyframes bf-hp-text-flash { 0% { color: var(--bf-hp-flash); transform: scale(1.08); } }`;

/** Counts a 'hurt' pulse from the HUD store, so a hit can restart the flash. */
function useHits() {
  const game = useGame();
  const [hits, setHits] = useState(0);
  useEffect(() => {
    const off = game.hud.onPulse((p) => {
      if (p.type === 'hurt') setHits((n) => n + 1);
    });
    return () => {
      off();
    };
  }, [game]);
  return hits;
}

/** The bar is as long at any max health as it is at 100: more health means more, thinner cells. */
const BAR = 236;
/** Below this cell width (px) a cell holds 20 health instead of 10. */
const MIN_CELL = 9;
/** Hits closer together than this (ms) flash as one run of lost health. */
const MERGE_MS = 300;

/** Cells of `unit` health (the last one holds what is left) and the gap between them, all within BAR. */
export function healthCells(max: number) {
  const fit = (unit: number) => {
    const count = Math.ceil(max / unit - 1e-6);
    const gap = count > 12 ? 3 : 4;
    const px = (BAR + gap) / max;
    const cells = Array.from({ length: count }, (_, i) => {
      const from = i * unit;
      const worth = Math.min(unit, max - from);
      return { from, worth, width: worth * px - gap };
    });
    return { unit, gap, cells };
  };
  const ten = fit(10);
  return ten.cells.every((c) => c.worth < 10 || c.width >= MIN_CELL) ? ten : fit(20);
}

/** The run of health the latest hit took, kept while its flash plays; a regen tick never starts one. */
function useLostFlash(health: number) {
  const [seen, setSeen] = useState(health);
  const [flash, setFlash] = useState({ key: 0, top: 0, bottom: 0, at: 0 });
  if (health !== seen) {
    setSeen(health);
    if (health < seen) {
      const now = performance.now();
      const top = now - flash.at < MERGE_MS ? Math.max(flash.top, seen) : seen;
      setFlash({ key: flash.key + 1, top, bottom: Math.max(0, health), at: now });
    }
  }
  return flash;
}

/**
 * Health as a white figure on the same dark plate as the ammo count, beside a bar of bricks that drain. The bar keeps
 * its length whatever the max (upgrades add cells, each thinner; past a point a cell holds 20). Both turn red only below
 * LOW_HEALTH, where the screen edges warn too; a hit flashes the health it took (red, or white once already red).
 * Armour rides above as a row of steel bricks.
 */
export function Health({ health, max, armor }: { health: number; max: number; armor: number }) {
  const hits = useHits();
  const lost = useLostFlash(health);
  const { unit, gap, cells } = healthCells(max);
  const low = health < max * LOW_HEALTH;
  const fill = low ? WARN_FILL : '#f4f6fb';
  const flash = low ? '#ffffff' : WARN_FILL;
  return (
    <div className='absolute bottom-6 left-6 flex items-end gap-3' style={{ ['--bf-hp-flash' as string]: flash }}>
      <style>{FLASH_KEYFRAMES}</style>
      <div className={PLATE}>
        <span
          key={hits}
          className='bf-display bf-hud-text inline-block min-w-[3ch] text-right text-6xl leading-none tabular-nums'
          style={{ color: low ? WARN_TEXT : undefined, animation: hits ? 'bf-hp-text-flash .4s ease-out' : undefined }}
        >
          {Math.max(0, Math.ceil(health))}
        </span>
      </div>
      <div className='flex flex-col gap-1.5 pb-1.5'>
        {armor > 0 && <Armor armor={armor} />}
        <div className='flex' style={{ gap, width: BAR }}>
          {cells.map(({ from, worth, width }) => {
            const share = (v: number) => Math.max(0, Math.min(1, (v - from) / worth));
            const level = share(health);
            const flashTop = share(lost.top);
            const flashBottom = share(lost.bottom);
            const stud = Math.min(10, width * 0.5);
            return (
              <div key={from} className='relative h-7 shrink-0 overflow-hidden rounded-[5px] bg-black/45 shadow-[0_2px_0_rgba(0,0,0,.4)]' style={{ width, borderRadius: Math.min(5, width / 3) }}>
                <div
                  className='absolute inset-x-0 bottom-0 transition-[height] duration-150'
                  style={{ height: `${level * 100}%`, borderRadius: 'inherit', background: fill, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.22), inset 0 2px 0 rgba(255,255,255,.5)' }}
                />
                {unit === 20 && worth === 20 && <div className='absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/30' />}
                <div className='absolute left-1/2 top-[-3px] h-[6px] -translate-x-1/2 rounded-full' style={{ width: stud, background: level > 0.95 ? (low ? '#ff8a7c' : '#ffffff') : 'rgba(0,0,0,.35)' }} />
                {lost.key > 0 && flashTop > flashBottom && (
                  <div
                    key={lost.key}
                    className='absolute inset-x-0'
                    style={{ bottom: `${flashBottom * 100}%`, height: `${(flashTop - flashBottom) * 100}%`, background: flash, animation: 'bf-hp-flash .45s ease-in both' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Ten armour a brick, the last one partly filled, after a shield and the figure. */
function Armor({ armor }: { armor: number }) {
  const bricks = Math.ceil(armor / 10);
  return (
    <div className='flex items-center gap-1'>
      <UpgradeIcon id='armor' size={20} className='mr-0.5 text-[#b9cdf5] drop-shadow-[0_1px_0_rgba(0,0,0,.5)]' />
      <span className='bf-display bf-hud-text mr-1 text-lg leading-none tabular-nums text-[#d6e3ff]'>{Math.ceil(armor)}</span>
      {Array.from({ length: bricks }, (_, i) => (
        <div key={i} className='relative h-3.5 w-5 overflow-hidden rounded-[4px] bg-black/45 shadow-[0_2px_0_rgba(0,0,0,.4)]'>
          <div className='absolute inset-y-0 left-0 rounded-[4px]' style={{ width: `${Math.min(1, (armor - i * 10) / 10) * 100}%`, background: '#8fb0ec', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.25), inset 0 2px 0 rgba(255,255,255,.55)' }} />
        </div>
      ))}
    </div>
  );
}

export function Ammo() {
  const hud = useHud();
  const reloading = hud.reload >= 0;
  const lowAmmo = hud.ammo <= Math.ceil(hud.mag * 0.25);
  return (
    <div className='absolute bottom-6 right-6 flex flex-col items-end gap-2'>
      <Grenades count={hud.grenades} max={hud.grenadeMax} timer={hud.grenadeTimer} refill={hud.grenadeRefill} />
      <div className='flex items-end gap-4'>
        <WeaponIcon weapon={hud.weapon} size={92} className='text-white/90 drop-shadow-[0_2px_0_rgba(0,0,0,.5)]' />
        {/* A soft dark plate under the count keeps both numbers legible over bright or red scenery. */}
        <div className={`flex items-baseline gap-1.5 ${PLATE}`}>
          <span className='bf-display bf-hud-text text-6xl leading-none tabular-nums' style={{ color: lowAmmo ? WARN_TEXT : undefined }}>
            {hud.ammo}
          </span>
          <span className='bf-display bf-hud-text text-3xl leading-none text-white/90'>/{hud.mag}</span>
        </div>
      </div>
      <div className='h-1.5 w-40 overflow-hidden rounded-full bg-black/40' style={{ opacity: reloading ? 1 : 0, transition: 'opacity .15s' }}>
        <div className='h-full rounded-full bg-[var(--bf-yellow)]' style={{ width: `${Math.max(0, hud.reload) * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * The grenade load. The first empty slot fills from the bottom while its grenade comes back, with the seconds left on
 * it; a grenade that arrives pops in. Slots after it wait as outlines.
 */
function Grenades({ count, max, timer, refill }: { count: number; max: number; timer: number; refill: number }) {
  const [seen, setSeen] = useState(count);
  const [arrivals, setArrivals] = useState(0);
  if (count !== seen) {
    setSeen(count);
    if (count > seen) setArrivals((n) => n + 1);
  }
  const charging = timer > 0 && count < max;
  return (
    <div className='flex items-end gap-1'>
      {Array.from({ length: Math.max(max, count) }, (_, i) => {
        const arrived = i === count - 1 && arrivals > 0;
        return (
          <GrenadeIcon
            key={arrived ? `pop-${arrivals}` : i}
            state={i < count ? 'full' : charging && i === count ? 'charging' : 'empty'}
            progress={charging ? 1 - timer / Math.max(1e-3, refill) : 0}
            seconds={Math.ceil(timer)}
            className={arrived ? 'bf-pop' : undefined}
          />
        );
      })}
    </div>
  );
}

/** A toy pineapple with a pin ring: solid while held, an outline once thrown, filling from the bottom as it comes back. */
function GrenadeIcon({ state, progress, seconds, className }: { state: 'full' | 'empty' | 'charging'; progress: number; seconds: number; className?: string }) {
  const full = state === 'full';
  const charging = state === 'charging';
  // The fill climbs the body and cap (y 36 → 6).
  const top = 36 - 30 * Math.max(0, Math.min(1, progress));
  const clip = `bf-gren-fill-${Math.round(top * 10)}`;
  return (
    <svg width={36} height={46} viewBox='0 0 30 38' aria-hidden className={`${full ? 'drop-shadow-[0_2px_0_rgba(0,0,0,.5)]' : ''} ${className ?? ''}`}>
      {charging && (
        <>
          <clipPath id={clip}>
            <rect x={0} y={top} width={30} height={38 - top} />
          </clipPath>
          <g clipPath={`url(#${clip})`} fill='rgba(255,205,46,.62)'>
            <rect x={4} y={12} width={20} height={24} rx={7} />
            <rect x={9} y={6} width={10} height={7} rx={2} />
          </g>
        </>
      )}
      <g fill={full ? 'var(--bf-yellow)' : charging ? 'none' : 'rgba(255,255,255,.14)'} stroke={full ? 'rgba(40,30,0,.55)' : charging ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.45)'} strokeWidth={1.5}>
        <rect x={4} y={12} width={20} height={24} rx={7} />
        <rect x={9} y={6} width={10} height={7} rx={2} />
        <path d='M19 8h5l3 4' fill='none' />
        <circle cx={25} cy={5} r={3.5} fill='none' />
      </g>
      {full && <path d='M5 21h18M5 27h18M14 13v22' stroke='rgba(60,40,0,.35)' strokeWidth={1.5} />}
      {charging && (
        <text x={14} y={29.5} textAnchor='middle' fontSize={12} fontWeight={800} fill='#ffffff' stroke='rgba(0,0,0,.75)' strokeWidth={2.6} paintOrder='stroke' style={{ fontVariantNumeric: 'tabular-nums' }}>
          {seconds}
        </text>
      )}
    </svg>
  );
}
