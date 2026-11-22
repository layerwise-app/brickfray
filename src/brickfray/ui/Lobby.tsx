import { useState } from 'react';
import { MATCH } from '../sim/constants';
import { DIFFICULTIES, type MatchSettings } from '../sim/types';
import { mapPreview } from './map-preview';
import { useApp, useGame } from './App';
import { useT } from './i18n';
import { Avatar } from './board/Avatar';
import { CopyIcon, DoorIcon, PlayIcon } from './icons';
import { LobbySeats } from './LobbySeats';
import { SnapbotPrimer, SoloBrief } from './hud/SoloBrief';

const MAPS = ['plaza', 'fortress', 'docks', 'temple'] as const;
const MINUTES = [3, 5, 10, 15];

export function Lobby() {
  const game = useGame();
  const app = useApp();
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const lobby = app.lobby;
  if (!lobby) return null;
  const s = lobby.settings;
  const host = app.isHost;
  const solo = s.mode === 'solo';
  const set = (patch: Partial<MatchSettings>) => {
    game.audio.play('uiClick', { volume: 0.6 });
    game.setLobbySettings(patch);
  };
  const go = host ? (
    <button className='bf-btn bf-btn-primary !h-16 w-full' onClick={() => game.startMatch()}>
      <PlayIcon size={26} />
      <span className='bf-display text-3xl'>{t('start')}</span>
    </button>
  ) : (
    <div className='py-4 text-center font-medium text-[var(--bf-muted)]'>{t('waitingForHost')}</div>
  );
  const copy = async () => {
    if (!lobby.code) return;
    await navigator.clipboard?.writeText(lobby.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className='bf-screen-in absolute inset-0 overflow-y-auto bg-[#0b1222]/70 p-4 backdrop-blur-md sm:p-8'>
      <div className='bf-screen-rise mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-5 2xl:max-w-6xl'>
        <div className='flex items-center gap-4'>
          <button className='bf-btn bf-btn-ghost' onClick={() => game.leave()}>
            <DoorIcon size={20} />
            {t('leave')}
          </button>
          {lobby.code && (
            <button className='bf-btn bf-btn-ghost ml-auto !h-14 !px-5' onClick={copy} aria-label={t('copy')}>
              <span className='text-sm uppercase tracking-[0.18em] text-[var(--bf-muted)]'>{t('roomCode')}</span>
              <span className='bf-display text-3xl tracking-[0.18em]'>{lobby.code}</span>
              <span className='text-[var(--bf-yellow)]'>{copied ? '✓' : <CopyIcon size={18} />}</span>
            </button>
          )}
        </div>

        <div className='grid gap-5 lg:grid-cols-[1fr_340px]'>
          <section className='bf-panel bf-studs flex flex-col gap-5 p-5'>
            {!solo && (
              <Field label={t('mode')}>
                <div className='bf-seg'>
                  {(['ffa', 'tdm'] as const).map((mode) => (
                    <button key={mode} aria-pressed={s.mode === mode} disabled={!host} onClick={() => set({ mode })}>
                      {t(`mode.${mode}`)}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label={t('map')}>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {MAPS.map((map) => (
                  <button
                    key={map}
                    disabled={!host}
                    onClick={() => set({ map })}
                    className='group relative aspect-[4/3] overflow-hidden rounded-xl text-left transition-transform enabled:hover:-translate-y-0.5'
                    style={{ background: mapPreview(map), boxShadow: s.map === map ? '0 0 0 3px var(--bf-yellow), 0 5px 0 rgba(0,0,0,.35)' : '0 5px 0 rgba(0,0,0,.35)' }}
                  >
                    <span className='bf-display absolute bottom-2 left-3 text-xl drop-shadow-[0_2px_0_rgba(0,0,0,.6)] sm:text-2xl'>{t(`map.${map}`)}</span>
                  </button>
                ))}
              </div>
            </Field>
            {solo && (
              <Field label={t('difficulty')}>
                <div className='bf-seg'>
                  {DIFFICULTIES.map((difficulty) => (
                    <button key={difficulty} aria-pressed={s.difficulty === difficulty} onClick={() => set({ difficulty })}>
                      {t(`difficulty.${difficulty}`)}
                    </button>
                  ))}
                </div>
                <p className='text-sm text-[var(--bf-muted)]'>{t(`difficultyHint.${s.difficulty}`)}</p>
              </Field>
            )}
            {solo && <SnapbotPrimer />}
            {!solo && (
            <div className='grid gap-5 sm:grid-cols-2'>
              <Field label={t('timeLimit')}>
                <div className='bf-seg'>
                  {MINUTES.map((m) => (
                    <button key={m} aria-pressed={s.minutes === m} disabled={!host} onClick={() => set({ minutes: m })}>
                      {t('minutes', { n: m })}
                    </button>
                  ))}
                </div>
              </Field>
              <SeatsSlider seats={s.seats} min={Math.max(1, lobby.players.length)} disabled={!host} onSeats={(seats) => set({ seats })} />
            </div>
            )}
          </section>

          <section className='bf-panel bf-studs flex flex-col gap-3 p-5'>
            <div className='flex items-baseline justify-between gap-3'>
              <h2 className='bf-display text-2xl'>{solo ? t('soloCaption') : t('players')}</h2>
              {!solo && <SeatCount humans={lobby.players.length} seats={s.seats} />}
            </div>
            {solo ? (
              <ul className='flex flex-col gap-2'>
                {lobby.players.map((p) => (
                  <li key={p.id} className='flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2'>
                    <Avatar character={p.character} size={32} />
                    <span className='font-semibold'>{p.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <LobbySeats players={lobby.players} settings={s} />
            )}
            {solo && <SoloBrief settings={s} />}
            <div className='mt-auto pt-3 max-lg:hidden'>{go}</div>
          </section>
        </div>
        {/* One column (phones, narrow windows): Start rides at the bottom of the screen instead of two screens down. */}
        <div className='sticky -bottom-4 z-10 -mx-4 -mb-4 bg-gradient-to-b from-transparent to-[#0b1222] to-35% px-4 pb-4 pt-6 sm:-bottom-8 sm:-mx-8 sm:-mb-8 sm:px-8 sm:pb-6 lg:hidden'>{go}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-2'>
      <div className='text-xs font-semibold uppercase tracking-[0.2em] text-[var(--bf-muted)]'>{label}</div>
      {children}
    </div>
  );
}

/** "1 + 5 bots / 6": players in the room, the bots that will fill the other seats, and the room's size. */
function SeatCount({ humans, seats }: { humans: number; seats: number }) {
  const { t } = useT();
  const size = Math.max(humans, Math.min(seats, MATCH.maxPlayers));
  const bots = size - humans;
  return (
    <span className='bf-display whitespace-nowrap text-xl text-[var(--bf-muted)]'>
      {bots ? t('lobby.count', { h: humans, b: bots }) : humans} / {size}
    </span>
  );
}

/** The room's size, 1 to 10, never below the players already in it: the number large, a tick for every size. */
function SeatsSlider({ seats, min, disabled, onSeats }: { seats: number; min: number; disabled: boolean; onSeats: (seats: number) => void }) {
  const { t } = useT();
  const max = MATCH.maxPlayers;
  const value = Math.max(min, Math.min(max, seats));
  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-baseline justify-between gap-3'>
        <span className='text-xs font-semibold uppercase tracking-[0.2em] text-[var(--bf-muted)]'>{t('lobby.size')}</span>
        <span className='bf-display text-4xl leading-none text-[var(--bf-yellow)]'>{value}</span>
      </div>
      <input
        type='range'
        className='bf-range'
        min={1}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={t('lobby.size')}
        style={{ ['--fill' as string]: `${((value - 1) / (max - 1)) * 100}%` }}
        onChange={(e) => onSeats(Math.max(min, Number(e.target.value)))}
      />
      <div className='bf-ticks' aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} data-off={i + 1 < min || undefined} data-on={i + 1 === value || undefined}>
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
