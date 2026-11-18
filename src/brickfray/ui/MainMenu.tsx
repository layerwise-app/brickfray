import { useState } from 'react';
import { ROSTER, CHARACTER_IDS } from '../characters/roster';
import type { CharacterId } from '../characters/types';
import { useApp, useGame } from './App';
import { LANGUAGES, setLang, useT } from './i18n';
import { MELEES, WEAPONS } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import { BotIcon, FullscreenIcon, GearIcon, GlobeIcon, PlayIcon, UsersIcon, WeaponIcon } from './icons';
import { RoomsPanel } from './RoomsPanel';

export function MainMenu({ openSettings }: { openSettings: () => void }) {
  const game = useGame();
  const app = useApp();
  const { t } = useT();
  const [character, setCharacter] = useState<CharacterId>(game.settings.character);
  const [name, setName] = useState(game.settings.name);
  const [rooms, setRooms] = useState(false);
  const info = ROSTER[character];

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

  const rename = (value: string) => {
    const clean = value.replace(/\s+/g, ' ').slice(0, 16);
    setName(clean);
    game.applySettings({ ...game.settings, name: clean.trim() });
  };

  return (
    <div className='absolute inset-0 flex flex-col p-5 sm:p-8'>
      <div className='pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 bg-gradient-to-l from-[#0b1222]/70 to-transparent lg:block' />
      <div className='pointer-events-none absolute inset-x-0 bottom-0 h-[600px] max-h-full bg-gradient-to-t from-[#0b1222] via-[#0b1222]/75 to-transparent lg:hidden' />
      <header className='relative flex items-start justify-between gap-1.5 sm:gap-4'>
        <h1 className='bf-logo select-none max-[480px]:!text-[7.6vw]'>BRICKFRAY</h1>
        <div className='flex shrink-0 gap-1.5 sm:gap-3'>
          <LanguageButton />
          <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={() => void document.documentElement.requestFullscreen?.()} aria-label={t('fullscreen')}>
            <FullscreenIcon size={22} />
          </button>
          <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={openSettings} aria-label={t('settings')}>
            <GearIcon size={24} />
          </button>
        </div>
      </header>

      <div className='relative mt-auto flex flex-col items-stretch gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6'>
        <section className='flex flex-col gap-3'>
          <div className='bf-fade-in' key={character}>
            <div className='text-sm font-semibold uppercase tracking-[0.2em] drop-shadow-[0_1px_2px_rgba(0,0,0,.7)]' style={{ color: info.primary }}>
              {t(`role.${character}`)}
            </div>
            <div className='bf-display text-5xl leading-none sm:text-6xl'>{info.name}</div>
            <div className='mt-1 text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.7)]'>{t(`style.${character}`)}</div>
            <Loadout character={character} />
          </div>
          <div className='flex flex-wrap gap-2'>
            {CHARACTER_IDS.map((id) => {
              const selected = id === character;
              return (
                <button
                  key={id}
                  onClick={() => pick(id)}
                  aria-pressed={selected}
                  className='group flex w-12 flex-col items-center gap-1 transition-transform hover:-translate-y-0.5 sm:w-[4.5rem]'
                >
                  <span
                    className='relative block h-12 w-12 overflow-hidden rounded-xl sm:h-16 sm:w-16 sm:rounded-2xl'
                    style={{
                      background: `linear-gradient(160deg, ${ROSTER[id].primary} 0 55%, ${ROSTER[id].secondary} 55% 100%)`,
                      boxShadow: selected ? '0 0 0 3px #fff, 0 6px 0 rgba(0,0,0,.35)' : '0 5px 0 rgba(0,0,0,.35)'
                    }}
                  >
                    {app.portraits[id] && <img src={app.portraits[id]} alt='' draggable={false} className='absolute inset-0 h-full w-full object-cover' />}
                  </span>
                  <span
                    className={`max-w-full truncate text-[11px] font-semibold sm:text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,.8)] ${selected ? 'text-white' : 'text-white/75 group-hover:text-white'}`}
                  >
                    {ROSTER[id].name}
                  </span>
                </button>
              );
            })}
          </div>
          <input className='bf-input w-64' placeholder={t('namePlaceholder')} value={name} maxLength={16} onChange={(e) => rename(e.target.value)} />
        </section>

        <nav className='grid w-full grid-cols-2 gap-3 lg:flex lg:w-[340px] lg:flex-col lg:gap-4'>
          <BigButton primary icon={<PlayIcon size={30} />} label={t('play')} caption={t('playCaption')} onClick={() => begin(() => game.quickMatch())} disabled={!!app.busy} />
          <BigButton icon={<BotIcon size={28} />} label={t('solo')} caption={t('soloCaption')} onClick={() => begin(() => game.playSolo())} disabled={!!app.busy} />
          <BigButton icon={<UsersIcon size={28} />} label={t('rooms')} caption={t('roomsCaption')} onClick={() =>
              begin(async () => {
                setRooms(true);
                void game.browse();
              })
            } disabled={!!app.busy} />
        </nav>
      </div>
      {rooms && <RoomsPanel onClose={() => setRooms(false)} />}
    </div>
  );
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
    <ul className='mt-3 flex gap-2'>
      {items.map((item) => (
        <li key={item.slot} className='flex w-[112px] flex-col gap-1 rounded-xl bg-black/40 px-2.5 py-2 backdrop-blur-sm'>
          <span className='text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60'>{item.slot}</span>
          <WeaponIcon weapon={item.id} size={item.id in WEAPONS ? 64 : 48} className='h-6 text-white' />
          <span className='truncate text-xs font-semibold'>{item.name}</span>
        </li>
      ))}
    </ul>
  );
}

function BigButton(props: { primary?: boolean; icon: React.ReactNode; label: string; caption: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className={`bf-btn ${props.primary ? 'bf-btn-primary col-span-2' : 'bf-btn-blue'} !h-auto min-w-0 !justify-start !gap-3 !px-3.5 !py-3 text-left lg:!gap-4 lg:!px-5 lg:!py-4`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/15 lg:h-12 lg:w-12'>{props.icon}</span>
      <span className='flex min-w-0 flex-col'>
        <span className={`bf-display leading-none ${props.primary ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'}`}>{props.label}</span>
        <span className='mt-1 text-xs font-medium leading-tight opacity-75 lg:text-sm'>{props.caption}</span>
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
