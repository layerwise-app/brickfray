import { useEffect, useRef, useState, type Ref } from 'react';
import type { UpgradeOffer } from '../../game/hud';
import type { Picker } from '../../game/input';
import { PICK_TIME } from '../../sim/match';
import { maxLevel, UPGRADES, type UpgradeId } from '../../sim/upgrades';
import { useGame, useHud } from '../App';
import { useT } from '../i18n';
import { WeaponIcon } from '../icons';
import { useTouchMode } from '../touch/useInputMode';
import { cardText, type DetailPart } from './upgrade-text';
import { UPGRADE_LOOK, UpgradeIcon } from './UpgradeIcon';

/** Clicks and number keys this soon after the cards appear are leftovers from the fight, not a choice. */
const GRACE_MS = 450;
/** Screen pixels per mouse count for the drawn pointer. */
const POINTER_SPEED = 1.15;
const KEYFRAMES = `@keyframes bf-card-in { 0% { opacity: 0; transform: translateY(40px) scale(.86); } 100% { opacity: 1; transform: none; } }
@keyframes bf-pip-next { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }`;

/** Solo, after a cleared wave: three upgrade cards, picked with 1–3, a click, or the pad. */
export function UpgradePick() {
  const hud = useHud();
  if (!hud.offer || hud.settings?.mode !== 'solo' || hud.phase === 'ended') return null;
  return <Cards key={hud.offer.key} offer={hud.offer} />;
}

function Cards({ offer }: { offer: UpgradeOffer }) {
  const game = useGame();
  const hud = useHud();
  const { t } = useT();
  const touch = useTouchMode();
  const [hovered, setHovered] = useState<number | null>(null);
  /** The card a number key marked: the same key again takes it. */
  const [marked, setMarked] = useState<number | null>(null);
  const [chosen, setChosen] = useState<UpgradeId | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const pointer = useRef<HTMLDivElement>(null);
  // The cards describe the player as they were dealt, so a chosen card doesn't change its numbers under the pointer.
  const [armor] = useState(hud.armor);
  const picked = offer.picked ?? chosen;
  const character = hud.rows.find((r) => r.me)?.character ?? game.settings.character;

  // Input is the external system: while the cards are up the captured mouse moves the drawn pointer, not the view.
  useEffect(() => {
    if (picked) return;
    const shown = performance.now();
    const pos = { x: innerWidth / 2, y: innerHeight * 0.86 };
    let over: number | null = null;
    const place = () => {
      if (pointer.current) pointer.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    };
    const hover = (i: number | null) => {
      if (i === over) return;
      over = i;
      setHovered(i);
      if (i !== null) game.audio.play('uiHover', { priority: 8 });
    };
    const choose = (i: number) => {
      const id = offer.options[i];
      if (!id || performance.now() - shown < GRACE_MS) return;
      hover(i);
      setChosen(id);
      game.pickUpgrade(id);
    };
    const under = () =>
      cards.current.findIndex((el) => {
        const r = el?.getBoundingClientRect();
        return !!r && pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom;
      });
    const picker: Picker = {
      move(dx, dy) {
        pos.x = Math.max(0, Math.min(innerWidth, pos.x + dx * POINTER_SPEED));
        pos.y = Math.max(0, Math.min(innerHeight, pos.y + dy * POINTER_SPEED));
        place();
        const i = under();
        hover(i >= 0 ? i : null);
      },
      click() {
        if (over !== null) choose(over);
      },
      // A number key marks its card and the same key again takes it: 1 and 2 also switch guns, and one pressed as
      // the cards come up must not pick.
      choose(i) {
        if (over === i) choose(i);
        else if (offer.options[i]) {
          goTo(i);
          setMarked(i);
        }
      },
      step(direction) {
        const n = offer.options.length;
        goTo(over === null ? (direction > 0 ? 0 : n - 1) : (over + direction + n) % n);
      },
      pick(i) {
        choose(i);
      }
    };
    const goTo = (i: number) => {
      const r = cards.current[i]?.getBoundingClientRect();
      if (r) {
        pos.x = r.left + r.width / 2;
        pos.y = r.top + r.height * 0.62;
        place();
      }
      hover(i);
    };
    place();
    game.input.setPicker(picker);
    return () => game.input.setPicker(null);
  }, [game, offer, picked]);

  const waiting = !picked && hud.phase === 'intermission' && hud.phaseLeft > 0;
  return (
    <div className='bf-pick absolute inset-0 flex flex-col items-center justify-center gap-7' style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(6,10,22,.6), rgba(6,10,22,.15))' }}>
      <style>{KEYFRAMES}</style>
      <div className='bf-pop flex flex-col items-center'>
        <span className='bf-display bf-hud-text text-5xl leading-none text-[var(--bf-yellow)]'>{t('upgrade.cleared', { n: offer.wave })}</span>
        <span className='bf-hud-text mt-2 text-lg font-semibold uppercase tracking-[0.25em] text-white/90'>{t('upgrade.title')}</span>
      </div>
      <div className='flex items-stretch gap-[clamp(12px,2.2vw,30px)]'>
        {offer.options.map((id, i) => (
          <div key={id} className={touch ? 'pointer-events-auto' : undefined} onClick={touch ? () => game.input.pick(i) : undefined} style={{ animation: `bf-card-in .5s cubic-bezier(.2,1.4,.4,1) ${120 + i * 90}ms both` }}>
            <Card
              id={id}
              index={i}
              offer={offer}
              character={character}
              armor={armor}
              state={picked ? (picked === id ? 'chosen' : 'faded') : hovered === i ? 'hover' : 'idle'}
              setRef={(el) => {
                cards.current[i] = el;
              }}
            />
          </div>
        ))}
      </div>
      <div className='flex flex-col items-center gap-2' style={{ opacity: picked ? 0 : 1, transition: 'opacity .2s' }}>
        <div className='bf-pick-hint bf-hud-text flex items-center gap-2 text-base font-semibold text-white/85'>
          {!touch &&
            offer.options.map((_, i) => (
              <span key={i} className='bf-display grid h-7 w-7 place-items-center rounded-md bg-white/15 text-lg leading-none shadow-[inset_0_-2px_0_rgba(0,0,0,.3)]'>
                {i + 1}
              </span>
            ))}
          <span className='ml-1'>{t(touch ? 'touch.pickHint' : 'upgrade.hint')}</span>
        </div>
        <div className='bf-hud-text bf-display text-2xl text-[var(--bf-yellow)]' style={{ visibility: !touch && marked !== null && marked === hovered ? 'visible' : 'hidden' }}>
          {t('upgrade.again', { n: (marked ?? 0) + 1 })}
        </div>
        <div className='bf-pick-auto flex items-center gap-3 text-sm font-semibold text-white/70' style={{ visibility: waiting ? 'visible' : 'hidden' }}>
          <span className='bf-hud-text tabular-nums'>{t('upgrade.auto', { n: Math.ceil(hud.phaseLeft) })}</span>
          <span className='h-1.5 w-40 overflow-hidden rounded-full bg-black/45'>
            <span className='block h-full rounded-full bg-white/70' style={{ width: `${Math.min(1, hud.phaseLeft / PICK_TIME) * 100}%` }} />
          </span>
        </div>
      </div>
      {!picked && !touch && <Pointer ref={pointer} />}
    </div>
  );
}

type CardState = 'idle' | 'hover' | 'chosen' | 'faded';

function Card({ id, index, offer, character, armor, state, setRef }: { id: UpgradeId; index: number; offer: UpgradeOffer; character: Parameters<typeof cardText>[2]; armor: number; state: CardState; setRef: (el: HTMLDivElement | null) => void }) {
  const { t } = useT();
  const look = UPGRADE_LOOK[id];
  const text = cardText(id, offer.levels, character, armor);
  const level = offer.levels[id];
  const cap = maxLevel(id);
  const up = state === 'hover' || state === 'chosen';
  const glow = state === 'chosen' ? `0 0 0 4px #ffffff, 0 0 46px ${look.color}` : state === 'hover' ? `0 0 0 3px #ffffff, 0 0 28px ${look.color}99` : '0 0 0 0 transparent';
  return (
    <div
      ref={setRef}
      className='bf-studs relative flex h-full w-[clamp(196px,21vw,282px)] flex-col rounded-[22px]'
      style={{
        ['--stud' as string]: look.color,
        background: '#15233f',
        boxShadow: `0 7px 0 ${look.lip}, 0 16px 28px rgba(0,0,0,.45), ${glow}`,
        transform: state === 'chosen' ? 'translateY(-14px) scale(1.06)' : up ? 'translateY(-10px) scale(1.03)' : state === 'faded' ? 'translateY(14px) scale(.94)' : 'none',
        opacity: state === 'faded' ? 0.18 : 1,
        transition: 'transform .18s cubic-bezier(.2,1.4,.4,1), box-shadow .18s ease, opacity .3s ease'
      }}
    >
      <div
        className='bf-card-art relative grid h-[clamp(118px,13vw,156px)] place-items-center rounded-t-[22px]'
        style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${look.color} 82%, white) 0%, ${look.color} 55%)`, boxShadow: 'inset 0 3px 0 rgba(255,255,255,.35), inset 0 -6px 0 rgba(0,0,0,.18)' }}
      >
        <span
          className='bf-display absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-[10px] text-2xl leading-none'
          style={{ background: up ? '#ffffff' : 'rgba(0,0,0,.3)', color: up ? '#15233f' : '#ffffff', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.25)' }}
        >
          {index + 1}
        </span>
        {UPGRADES[id].rare && (
          <span className='absolute right-3 top-3.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#3a2400]' style={{ background: 'linear-gradient(180deg,#ffe98a,#ffc21a)', boxShadow: '0 2px 0 #b07c00' }}>
            {t('upgrade.rare')}
          </span>
        )}
        <UpgradeIcon id={id} size={92} style={{ color: look.ink, ['--bf-upgrade-tile' as string]: look.color, filter: 'drop-shadow(0 3px 0 rgba(0,0,0,.22))' }} />
      </div>
      <div className='flex flex-1 flex-col items-center gap-2 px-4 pb-4 pt-3 text-center'>
        <span className='bf-display text-[clamp(21px,2vw,27px)] leading-tight'>{t(`upgrade.name.${id}`)}</span>
        <span className='bf-card-fx text-[clamp(15px,1.35vw,18px)] font-bold leading-snug text-[var(--bf-yellow)] [text-wrap:balance]'>{t(text.effect.key, text.effect.vars)}</span>
        <Detail parts={text.detail} />
        <div className='mt-auto flex items-center gap-1.5 pt-2'>
          {Array.from({ length: cap }, (_, i) => (
            <span
              key={i}
              className='h-3 w-3 rounded-full'
              style={{
                background: i < level ? look.color : i === level ? '#ffffff' : 'rgba(255,255,255,.16)',
                boxShadow: i <= level ? 'inset 0 -2px 0 rgba(0,0,0,.25)' : undefined,
                animation: i === level && state !== 'faded' ? 'bf-pip-next 1.1s ease-in-out infinite' : undefined
              }}
            />
          ))}
          <span className='bf-card-level ml-1.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-white/55'>{t('upgrade.level', { n: `${level + 1}/${cap}` })}</span>
        </div>
      </div>
    </div>
  );
}

function Detail({ parts }: { parts: DetailPart[] }) {
  const { t } = useT();
  const fmt = (v: number, unit: DetailPart['unit']) => {
    const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
    return unit === 'seconds' ? t('unit.seconds', { n }) : unit === 'perSecond' ? t('unit.perSecond', { n }) : unit === 'percent' ? `${n}%` : n;
  };
  return (
    <div className='bf-card-delta flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[15px] font-semibold tabular-nums text-white/70'>
      {parts.map((p, i) => (
        <span key={i} className='flex items-center gap-1.5'>
          {p.weapon && <WeaponIcon weapon={p.weapon} size={34} className='text-white/80' />}
          <span>{fmt(p.from, p.unit)}</span>
          <span className='text-white/45'>→</span>
          <span className='font-extrabold text-white'>{fmt(p.to, p.unit)}</span>
        </span>
      ))}
    </div>
  );
}

/** The drawn arrow the captured mouse steers over the cards. */
function Pointer({ ref }: { ref: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className='pointer-events-none absolute left-0 top-0' style={{ willChange: 'transform' }}>
      <svg width={28} height={32} viewBox='0 0 28 32' aria-hidden style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.5))' }}>
        <path d='M2 2l22 17-10.5 1.6L19 30l-4.6 1.8-5.4-9.5L2 28z' fill='#ffffff' stroke='#0f1a2e' strokeWidth={2.2} strokeLinejoin='round' />
      </svg>
    </div>
  );
}
