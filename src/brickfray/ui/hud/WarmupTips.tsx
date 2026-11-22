import { useEffect, useState } from 'react';
import type { Action } from '../../game/input';
import type { MatchSettings } from '../../sim/types';
import { useGame, useHud } from '../App';
import { useT, type MessageKey } from '../i18n';
import { useTouchMode } from '../touch/useInputMode';

/** First runs only: the card shows in this many warm-ups of each kind, then never again. */
const FIRST_RUNS = 3;
/** Seconds the card stays once the fight starts. */
const LINGER = 3.5;
const KEY = 'brickfray.tips.v1';

const ITEMS: { action: Action; label: MessageKey; note?: MessageKey }[] = [
  { action: 'ads', label: 'action.ads' },
  { action: 'grenade', label: 'action.grenade', note: 'tips.cook' },
  { action: 'melee', label: 'action.melee' },
  { action: 'sprint', label: 'action.sprint' },
  { action: 'crouch', label: 'action.crouch', note: 'tips.slide' }
];

interface Seen {
  matches: number;
  solo: number;
}

function loadSeen(): Seen {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Seen> | null;
    return { matches: saved?.matches ?? 0, solo: saved?.solo ?? 0 };
  } catch {
    return { matches: 0, solo: 0 };
  }
}

function saveSeen(seen: Seen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    // Blocked storage: the card shows again next time, which is harmless.
  }
}

/** A mouse with its pressed button lit, or a key cap with the key's name. */
function KeyCap({ code }: { code: string }) {
  if (code === 'Mouse0' || code === 'Mouse2') {
    const left = code === 'Mouse0';
    return (
      <svg width={22} height={30} viewBox='0 0 22 30' aria-label={left ? 'Left mouse button' : 'Right mouse button'} className='shrink-0'>
        <rect x='1' y='1' width='20' height='28' rx='10' fill='#1c2944' stroke='#ffffff' strokeOpacity='.75' strokeWidth='1.6' />
        <path d={left ? 'M11 1.8A9.2 9.2 0 0 0 1.8 11V13H11z' : 'M11 1.8A9.2 9.2 0 0 1 20.2 11V13H11z'} fill='var(--bf-yellow)' />
        <path d='M1.8 13h18.4M11 1.8V13' stroke='#ffffff' strokeOpacity='.75' strokeWidth='1.4' />
      </svg>
    );
  }
  const names: Record<string, string> = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', Tab: 'Tab', Enter: 'Enter', Mouse1: 'MMB' };
  const label = code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : (names[code] ?? code);
  return <kbd className='bf-display grid h-8 min-w-8 place-items-center rounded-lg bg-white px-2 text-lg leading-none text-[#15233f] shadow-[inset_0_-3px_0_rgba(0,0,0,.25),0_2px_0_rgba(0,0,0,.4)]'>{label}</kbd>;
}

/**
 * The warm-up of a player's first matches: the controls that "get ready" does not teach (aim, grenade, melee,
 * sprint, crouch and slide) and, in solo, what waves and upgrades are. Touch controls have their own first-run hint.
 */
export function WarmupTips() {
  const hud = useHud();
  const game = useGame();
  const { t } = useT();
  const touch = useTouchMode();
  const [card, setCard] = useState<{ settings: MatchSettings | null; keys: boolean; waves: boolean }>({ settings: null, keys: false, waves: false });
  const [gone, setGone] = useState<MatchSettings | null>(null);
  const settings = hud.settings;

  // Decided once per match, as its warm-up begins.
  if (settings && card.settings !== settings && hud.phase === 'warmup') {
    const seen = loadSeen();
    setCard({ settings, keys: seen.matches < FIRST_RUNS, waves: settings.mode === 'solo' && seen.solo < FIRST_RUNS });
  }

  // Storage is the external system: this warm-up counts towards the first runs.
  useEffect(() => {
    if (!card.settings) return;
    const seen = loadSeen();
    saveSeen({ matches: seen.matches + 1, solo: seen.solo + (card.settings.mode === 'solo' ? 1 : 0) });
  }, [card.settings]);

  const fighting = hud.phase === 'playing';
  // A timer: the card lingers a moment into the fight, then leaves.
  useEffect(() => {
    if (!fighting || card.settings !== settings) return;
    const timer = setTimeout(() => setGone(settings), LINGER * 1000);
    return () => clearTimeout(timer);
  }, [fighting, card.settings, settings]);

  const keys = card.keys && !touch;
  const live = card.settings === settings && gone !== settings && (hud.phase === 'warmup' || fighting);
  if (!live || (!keys && !card.waves)) return null;
  const bindings = game.settings.input.bindings;
  return (
    <div className='bf-warmup-tips bf-fade-in absolute bottom-[19%] left-1/2 flex w-[min(720px,92vw)] -translate-x-1/2 flex-col items-center gap-2.5 rounded-2xl bg-[#0b1222]/82 px-5 py-3 shadow-[0_6px_0_rgba(0,0,0,.35)]' style={{ opacity: fighting ? 0.85 : 1 }}>
      {keys && (
        <>
          <span className='text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--bf-muted)]'>{t('tips.title')}</span>
          <div className='flex flex-wrap items-start justify-center gap-x-5 gap-y-2'>
            {ITEMS.map((item) => (
              <div key={item.action} className='flex items-center gap-2'>
                <KeyCap code={bindings[item.action][0]} />
                <span className='flex flex-col leading-tight'>
                  <span className='text-sm font-bold'>{t(item.label)}</span>
                  {item.note && <span className='text-[11px] font-semibold text-white/60'>{t(item.note)}</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {card.waves && <p className={`text-center text-sm font-semibold text-white/85 ${keys ? 'border-t border-white/10 pt-2' : ''}`}>{t('tips.waves')}</p>}
    </div>
  );
}
