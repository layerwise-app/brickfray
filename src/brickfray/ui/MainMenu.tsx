import { useState } from 'react';
import { ROSTER, CHARACTER_IDS } from '../characters/roster';
import type { CharacterId } from '../characters/types';
import { useApp, useGame } from './App';
import { LANGUAGES, setLang, useT } from './i18n';
import { BotIcon, FullscreenIcon, GearIcon, GlobeIcon, PlayIcon, UsersIcon } from './icons';
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
      <div className='pointer-events-none absolute inset-0 bg-gradient-to-l from-[#0b1222]/70 via-transparent to-transparent' />
      <header className='relative flex items-start justify-between gap-4'>
        <h1 className='bf-logo select-none'>BRICKFRAY</h1>
        <div className='flex gap-3'>
          <LanguageButton />
          <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={() => void document.documentElement.requestFullscreen?.()} aria-label={t('fullscreen')}>
            <FullscreenIcon size={22} />
          </button>
          <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={openSettings} aria-label={t('settings')}>
            <GearIcon size={24} />
          </button>
        </div>
      </header>

      <div className='relative mt-auto flex flex-col-reverse items-stretch gap-6 lg:flex-row lg:items-end lg:justify-between'>
        <section className='flex flex-col gap-3'>
          <div className='bf-fade-in' key={character}>
            <div className='text-sm font-semibold uppercase tracking-[0.2em]' style={{ color: info.primary }}>
              {t(`role.${character}`)}
            </div>
            <div className='bf-display text-5xl leading-none sm:text-6xl'>{info.name}</div>
          </div>
          <div className='flex flex-wrap gap-2.5'>
            {CHARACTER_IDS.map((id) => (
              <button
                key={id}
                onClick={() => pick(id)}
                aria-label={ROSTER[id].name}
                aria-pressed={id === character}
                className='relative h-14 w-14 rounded-2xl transition-transform hover:-translate-y-0.5'
                style={{
                  background: `linear-gradient(160deg, ${ROSTER[id].primary} 0 58%, ${ROSTER[id].secondary} 58% 100%)`,
                  boxShadow: id === character ? '0 0 0 3px #fff, 0 6px 0 rgba(0,0,0,.35)' : '0 5px 0 rgba(0,0,0,.35)'
                }}
              >
                <span className='bf-display absolute inset-x-0 bottom-1 text-center text-lg text-white drop-shadow-[0_2px_0_rgba(0,0,0,.5)]'>{ROSTER[id].name[0]}</span>
              </button>
            ))}
          </div>
          <input className='bf-input w-64' placeholder={t('namePlaceholder')} value={name} maxLength={16} onChange={(e) => rename(e.target.value)} />
        </section>

        <nav className='flex w-full flex-col gap-4 lg:w-[340px]'>
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

function BigButton(props: { primary?: boolean; icon: React.ReactNode; label: string; caption: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className={`bf-btn ${props.primary ? 'bf-btn-primary' : 'bf-btn-blue'} !h-auto !justify-start !gap-4 !px-5 !py-4 text-left`} onClick={props.onClick} disabled={props.disabled}>
      <span className='grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-black/15'>{props.icon}</span>
      <span className='flex flex-col'>
        <span className={`bf-display leading-none ${props.primary ? 'text-4xl' : 'text-3xl'}`}>{props.label}</span>
        <span className='mt-1 text-sm font-medium opacity-75'>{props.caption}</span>
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
