import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ROSTER, CHARACTER_IDS } from '../characters/roster';
import type { CharacterId } from '../characters/types';
import { refreshPortraits } from '../game/portraits';
import { coverStage } from '../game/showroom';
import { TURN_PER_PIXEL, turntable } from '../game/stage-turn';
import { useApp, useGame } from './App';
import { LANGUAGES, setLang, useT } from './i18n';
import { MELEES, WEAPONS } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import { BotIcon, FullscreenIcon, GearIcon, GlobeIcon, PlayIcon, UsersIcon, WeaponIcon } from './icons';
import { RoomsPanel } from './RoomsPanel';
import { TrophyIcon } from './board/icons';
import { useAccount, useProfileSaved } from './board/me';
import { NAME_MAX, nameText } from '../../lib/board/names';
import { queueRename } from '../../lib/board/client/rename';
import { flushMatches } from '../../lib/board/client/sync';
import './menu.css';
import './menu-wide.css';
import './menu-landscape.css';
import './menu-stacked.css';

/** A drag that starts on one of these is theirs; anywhere else on the menu it turns the figure. */
const CONTROLS = 'button, input, a, select, textarea, label, nav, [data-cover], .bf-panel';

const BoardPanel = lazy(() => import('./board/BoardPanel'));

export function MainMenu({ openSettings }: { openSettings: () => void }) {
  const game = useGame();
  const app = useApp();
  const { t, lang } = useT();
  const [character, setCharacter] = useState<CharacterId>(game.settings.character);
  const [name, setName] = useState(game.settings.name);
  const tag = useAccount().data?.profile?.tag ?? null;
  const profileSaved = useProfileSaved();
  const [rooms, setRooms] = useState(false);
  const [board, setBoard] = useState(false);
  const [turning, setTurning] = useState(false);
  const info = ROSTER[character];
  const root = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLHeadingElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const drag = useRef<{ pointer: number; x: number; at: number } | null>(null);

  // Syncs the 3D stage with this overlay: the figure is framed in whatever the header and panels leave free.
  useLayoutEffect(() => {
    const blocks = [...sheet.current!.querySelectorAll('[data-cover]')];
    const report = () => {
      // Side by side, the figure stands between the columns and each block bounds it on its own; stacked, the sheet is one floor.
      const stacked = getComputedStyle(root.current!).getPropertyValue('--bf-stage').trim() === 'stacked';
      coverStage({
        header: [logo.current!.getBoundingClientRect(), controls.current!.getBoundingClientRect()],
        panels: stacked ? [sheet.current!.getBoundingClientRect()] : [...blocks, nav.current!].map(clearance)
      });
    };
    const observer = new ResizeObserver(report);
    for (const el of [root.current!, logo.current!, controls.current!, sheet.current!, nav.current!, ...blocks]) observer.observe(el);
    report();
    return () => {
      observer.disconnect();
      coverStage(null);
    };
  }, [character, lang]);

  // A window made larger (past 1440 × 900 the tiles grow with it) gets portraits drawn for the new tile size.
  useEffect(() => {
    let timer = 0;
    const later = () => {
      clearTimeout(timer);
      timer = window.setTimeout(refreshPortraits, 400);
    };
    window.addEventListener('resize', later);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', later);
    };
  }, []);

  // Matches an earlier visit could not upload (offline, rate limit) go up once the menu has settled.
  useEffect(() => {
    const timer = setTimeout(() => void flushMatches(game.settings.name), 5000);
    return () => clearTimeout(timer);
  }, [game]);

  const begin = async (action: () => Promise<void>) => {
    // The audio context must start inside the click; the sound bank keeps rendering in the background.
    void game.unlockAudio();
    game.audio.play('uiClick');
    await action();
  };

  const pick = (id: CharacterId) => {
    setCharacter(id);
    game.setCharacter(id);
    game.audio.play('uiHover', { volume: 0.6 });
  };

  // While an input method composes (pinyin, kana), its text shows as typed; the name rule applies once it is committed.
  const rename = (value: string, composing = false) => {
    if (composing) return setName(value);
    const clean = nameText(value);
    setName(clean);
    game.applySettings({ ...game.settings, name: clean });
    queueRename(clean, profileSaved);
  };

  const grab = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (rooms || board || drag.current || e.button !== 0 || target.closest(CONTROLS)) return;
    if (sheet.current!.contains(target) && getComputedStyle(root.current!).getPropertyValue('--bf-stage').trim() === 'stacked') return;
    drag.current = { pointer: e.pointerId, x: e.clientX, at: e.timeStamp };
    e.currentTarget.setPointerCapture(e.pointerId);
    turntable.grab();
    setTurning(true);
  };
  const turn = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.pointer !== e.pointerId) return;
    turntable.drag((e.clientX - d.x) * TURN_PER_PIXEL, (e.timeStamp - d.at) / 1000);
    d.x = e.clientX;
    d.at = e.timeStamp;
  };
  const drop = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer !== e.pointerId) return;
    drag.current = null;
    turntable.release();
    setTurning(false);
  };

  return (
    <div ref={root} className='bf-menu' data-turning={turning} onPointerDown={grab} onPointerMove={turn} onPointerUp={drop} onPointerCancel={drop}>
      <header className='bf-menu-header' inert={board}>
        <h1 ref={logo} className='bf-logo bf-menu-logo'>
          BRICKFRAY
        </h1>
        <div ref={controls} className='bf-menu-tools'>
          <LanguageButton />
          <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={() => void document.documentElement.requestFullscreen?.()} aria-label={t('fullscreen')}>
            <FullscreenIcon size={22} />
          </button>
          <button
            className='bf-btn bf-btn-ghost bf-icon-btn'
            onClick={() => {
              game.audio.play('uiClick');
              setBoard(true);
            }}
            aria-label={t('board.title')}
          >
            <TrophyIcon size={22} />
          </button>
          <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={openSettings} aria-label={t('settings')}>
            <GearIcon size={24} />
          </button>
        </div>
      </header>

      <div ref={sheet} className='bf-menu-sheet' inert={board}>
        <section className='bf-menu-info'>
          <div className='bf-menu-swap' key={character}>
            <div data-cover className='bf-menu-title'>
              <div className='bf-menu-role' style={{ color: legible(info.primary) }}>
                {t(`role.${character}`)}
              </div>
              <div className='bf-menu-name bf-display'>{info.name}</div>
              <div className='bf-menu-style'>{t(`style.${character}`)}</div>
            </div>
            <Loadout character={character} />
          </div>
          <div data-cover className='bf-menu-picker'>
            {CHARACTER_IDS.map((id) => (
              <button key={id} onClick={() => pick(id)} aria-pressed={id === character} className='bf-menu-pick'>
                <span className='bf-menu-thumb' style={{ background: `linear-gradient(160deg, ${ROSTER[id].primary} 0 calc(55% - 0.7px), ${ROSTER[id].secondary} calc(55% + 0.7px) 100%)` }}>
                  {app.portraits[id] && <img src={app.portraits[id]} alt='' draggable={false} />}
                </span>
                <span className='bf-menu-pick-name'>{ROSTER[id].name}</span>
              </button>
            ))}
          </div>
          <label data-cover className='bf-menu-callsign'>
            <TagIcon />
            <input
              placeholder={t('namePlaceholder')}
              aria-label={t('namePlaceholder')}
              value={name}
              maxLength={NAME_MAX}
              spellCheck={false}
              autoComplete='off'
              onChange={(e) => rename(e.target.value, (e.nativeEvent as InputEvent).isComposing)}
              onCompositionEnd={(e) => rename(e.currentTarget.value)}
            />
            {tag !== null && <span className='shrink-0 text-[0.875em] font-semibold tabular-nums text-white/45'>#{tag}</span>}
          </label>
        </section>

        <nav ref={nav} className='bf-menu-nav'>
          <BigButton primary icon={<PlayIcon size={30} />} label={t('play')} caption={t('playCaption')} onClick={() => begin(() => game.quickMatch())} disabled={!!app.busy} />
          <BigButton icon={<BotIcon size={28} />} label={t('solo')} caption={t('soloCaption')} onClick={() => begin(() => game.playSolo())} disabled={!!app.busy} />
          <BigButton
            icon={<UsersIcon size={28} />}
            label={t('rooms')}
            caption={t('roomsCaption')}
            onClick={() =>
              begin(async () => {
                setRooms(true);
                void game.browse();
              })
            }
            disabled={!!app.busy}
          />
        </nav>
      </div>
      {board && (
        <Suspense fallback={null}>
          <BoardPanel
            onClose={() => {
              game.audio.play('uiBack');
              setBoard(false);
            }}
            onName={setName}
          />
        </Suspense>
      )}
      {rooms && (
        <RoomsPanel
          onClose={() => {
            game.audio.play('uiBack');
            setRooms(false);
          }}
        />
      )}
    </div>
  );
}

/** A block's box as the stage keeps clear of it; the big name wants more air on its right than the usual gap. */
function clearance(el: Element) {
  const box = el.getBoundingClientRect();
  const name = el.querySelector('.bf-menu-name');
  if (!name) return box;
  const air = 0.45 * parseFloat(getComputedStyle(name).fontSize);
  return { left: box.left, top: box.top, right: box.right + air, bottom: box.bottom };
}

/** A name tag: marks the field under the picker as the player's own name. */
function TagIcon() {
  return (
    <svg width={18} height={18} viewBox='0 0 24 24' fill='currentColor' aria-hidden>
      <circle cx='12' cy='8' r='4' />
      <path d='M4 20.5c.6-4.6 3.9-7 8-7s7.4 2.4 8 7z' />
    </svg>
  );
}

/** A roster color as text on the dark menu: the same hue, lifted until it reads. */
function legible(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  if (light >= 0.72 || max === min) return hex;
  const hue = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  const saturation = (max - min) / (1 - Math.abs(2 * light - 1));
  return `hsl(${Math.round(hue * 60)} ${Math.round(Math.max(saturation, 0.55) * 100)}% 72%)`;
}

/** The character's kit: picking a character picks these three. */
function Loadout({ character }: { character: CharacterId }) {
  const { t } = useT();
  const kit = LOADOUTS[character];
  const items = [
    { slot: t('action.weapon1'), id: kit.primary, name: WEAPONS[kit.primary].name },
    { slot: t('action.weapon2'), id: kit.secondary, name: WEAPONS[kit.secondary].name },
    { slot: t('action.melee'), id: kit.melee, name: MELEES[kit.melee].name }
  ];
  return (
    <ul data-cover className='bf-menu-loadout'>
      {items.map((item) => (
        <li key={item.slot}>
          <span className='bf-menu-slot'>{item.slot}</span>
          <WeaponIcon weapon={item.id} size={item.id in WEAPONS ? 64 : 48} className='bf-menu-arm' />
          <span className='bf-menu-item'>{item.name}</span>
        </li>
      ))}
    </ul>
  );
}

function BigButton(props: { primary?: boolean; icon: React.ReactNode; label: string; caption: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className={`bf-btn bf-big-btn ${props.primary ? 'bf-btn-primary bf-big-btn-main' : 'bf-btn-blue'}`} onClick={props.onClick} disabled={props.disabled}>
      <span className='bf-big-btn-icon'>{props.icon}</span>
      <span className='bf-big-btn-text'>
        <span className='bf-big-btn-label bf-display'>{props.label}</span>
        <span className='bf-big-btn-caption'>{props.caption}</span>
      </span>
    </button>
  );
}

function LanguageButton() {
  const { lang, t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className='relative'>
      <button className='bf-btn bf-btn-ghost !px-3' onClick={() => setOpen(!open)} aria-label={t('language')} aria-expanded={open}>
        <GlobeIcon size={22} />
        <span className='text-sm font-semibold uppercase'>{lang}</span>
      </button>
      {open && (
        <div className='bf-panel bf-fade-in absolute right-0 top-14 z-20 flex w-44 flex-col p-1.5'>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`rounded-lg px-3 py-2 text-left font-medium hover:bg-white/10 ${l.code === lang ? 'text-[var(--bf-yellow)]' : ''}`}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
