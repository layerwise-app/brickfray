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
import { BotIcon, CreditsIcon, ExitFullscreenIcon, FullscreenIcon, GearIcon, GlobeIcon, PlayIcon, UsersIcon, WeaponIcon } from './icons';
import { RoomsPanel } from './RoomsPanel';
import { Credits } from './Credits';
import { useFullscreen } from './fullscreen';
import { TrophyIcon } from './board/icons';
import { ProfileChip } from './board/ProfileChip';
import { canFullscreen, setFullscreen } from '../game/touch-screen';
import { InstallButton } from './touch/InstallGuide';
import { frameRect, toFrame } from './touch/landscape';
import { flushMatches } from '../../lib/board/client/sync';
import './menu.css';
import './menu-motion.css';
import './menu-wide.css';
import './menu-landscape.css';
import './menu-stacked.css';

/** A drag that starts on one of these is theirs; anywhere else on the menu it turns the figure. */
const CONTROLS = 'button, input, a, select, textarea, label, nav, [data-cover], .bf-panel';

const BoardPanel = lazy(() => import('./board/BoardPanel'));
const ProfilePanel = lazy(() => import('./board/ProfilePanel'));
const AchievementsPage = lazy(() => import('./achievements/AchievementsPage'));

/** What covers the menu: one dialog at a time. */
type Overlay = 'rooms' | 'ranks' | 'history' | 'profile' | 'credits' | 'achievements';

export function MainMenu({ openSettings }: { openSettings: () => void }) {
  const game = useGame();
  const app = useApp();
  const { t, lang } = useT();
  const [character, setCharacter] = useState<CharacterId>(game.settings.character);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [turning, setTurning] = useState(false);
  const info = ROSTER[character];
  const root = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLHeadingElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const me = useRef<HTMLButtonElement>(null);
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
        header: [frameRect(logo.current!), frameRect(controls.current!), frameRect(me.current!)],
        panels: stacked ? [frameRect(sheet.current!)] : [...blocks, nav.current!].map(clearance)
      });
    };
    const observer = new ResizeObserver(report);
    for (const el of [root.current!, logo.current!, controls.current!, me.current!, sheet.current!, nav.current!, ...blocks]) observer.observe(el);
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

  const open = (next: Overlay) => {
    game.audio.play('uiClick');
    setOverlay(next);
  };
  const close = () => back(null);
  /** Back out of a dialog: My matches returns to the profile menu it was opened from. */
  const back = (to: Overlay | null) => {
    game.audio.play('uiBack');
    setOverlay(to);
  };

  const grab = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (overlay || drag.current || e.button !== 0 || target.closest(CONTROLS)) return;
    if (sheet.current!.contains(target) && getComputedStyle(root.current!).getPropertyValue('--bf-stage').trim() === 'stacked') return;
    drag.current = { pointer: e.pointerId, x: toFrame(e.clientX, e.clientY).x, at: e.timeStamp };
    e.currentTarget.setPointerCapture(e.pointerId);
    turntable.grab();
    setTurning(true);
  };
  const turn = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.pointer !== e.pointerId) return;
    const x = toFrame(e.clientX, e.clientY).x;
    turntable.drag((x - d.x) * TURN_PER_PIXEL, (e.timeStamp - d.at) / 1000);
    d.x = x;
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
      <header className='bf-menu-header' inert={!!overlay}>
        <h1 ref={logo} className='bf-logo bf-menu-logo'>
          BRICKFRAY
        </h1>
        <div className='bf-menu-corner'>
          <div ref={controls} className='bf-menu-tools'>
            <LanguageButton />
            <FullscreenButton />
            <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={() => open('ranks')} aria-label={t('board.title')} title={t('board.title')}>
              <TrophyIcon size={22} />
            </button>
            <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={() => open('credits')} aria-label={t('credits')} title={t('credits')}>
              <CreditsIcon size={22} />
            </button>
            <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={openSettings} aria-label={t('settings')} title={t('settings')}>
              <GearIcon size={24} />
            </button>
          </div>
          <ProfileChip ref={me} character={character} open={overlay === 'profile'} onOpen={() => open('profile')} />
        </div>
      </header>

      <div ref={sheet} className='bf-menu-sheet' inert={!!overlay}>
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
                <span className='bf-menu-thumb' style={{ background: `linear-gradient(160deg, ${ROSTER[id].primary} 0 calc(66% - 0.7px), ${ROSTER[id].secondary} calc(66% + 0.7px) 100%)` }}>
                  {app.portraits[id] && <img src={app.portraits[id]} alt='' draggable={false} />}
                </span>
                <span className='bf-menu-pick-name'>{ROSTER[id].name}</span>
              </button>
            ))}
          </div>
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
                setOverlay('rooms');
                void game.browse();
              })
            }
            disabled={!!app.busy}
          />
        </nav>
      </div>
      {(overlay === 'ranks' || overlay === 'history') && (
        <Suspense fallback={null}>
          <BoardPanel key={overlay} view={overlay} onClose={overlay === 'history' ? () => back('profile') : close} />
        </Suspense>
      )}
      {overlay === 'profile' && (
        <Suspense fallback={null}>
          <ProfilePanel character={character} onClose={close} onMatches={() => open('history')} onAchievements={() => open('achievements')} />
        </Suspense>
      )}
      {overlay === 'achievements' && (
        <Suspense fallback={null}>
          <AchievementsPage onClose={() => back('profile')} />
        </Suspense>
      )}
      {overlay === 'credits' && <Credits onClose={close} />}
      {overlay === 'rooms' && <RoomsPanel onClose={close} />}
    </div>
  );
}

/** A block's box as the stage keeps clear of it; the big name wants more air on its right than the usual gap. */
function clearance(el: Element) {
  const box = frameRect(el);
  const name = el.querySelector('.bf-menu-name');
  if (!name) return box;
  const air = 0.45 * parseFloat(getComputedStyle(name).fontSize);
  return { left: box.left, top: box.top, right: box.right + air, bottom: box.bottom };
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

/** Where the browser has no fullscreen (iPhone Safari), a phone gets the home-screen guide in its place. */
function FullscreenButton() {
  const { t } = useT();
  const on = useFullscreen();
  if (!canFullscreen()) return <InstallButton />;
  return (
    <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={() => void setFullscreen(!on)} aria-pressed={on} aria-label={t('fullscreen')} title={t('fullscreen')}>
      {on ? <ExitFullscreenIcon size={22} /> : <FullscreenIcon size={22} />}
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
        <div className='bf-panel bf-fade-in absolute right-0 z-20 flex w-44 flex-col p-1.5' style={{ top: 'calc(var(--tool-h) + 8px)' }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`bf-menu-lang-item rounded-lg px-3 py-2 text-left font-medium hover:bg-white/10 ${l.code === lang ? 'text-[var(--bf-yellow)]' : ''}`}
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
