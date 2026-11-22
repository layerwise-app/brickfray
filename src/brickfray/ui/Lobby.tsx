import { useState } from 'react';
import { ROSTER } from '../characters/roster';
import { MATCH } from '../sim/constants';
import { DIFFICULTIES, type MatchSettings } from '../sim/types';
import { mapPreview } from './map-preview';
import { useApp, useGame } from './App';
import { useT } from './i18n';
import { CopyIcon, CrownIcon, DoorIcon, PlayIcon } from './icons';
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
              <Field label={`${t('seats')} · ${s.seats}`}>
                <input
                  type='range'
                  className='bf-range mt-3'
                  min={1}
                  max={MATCH.maxPlayers}
                  value={s.seats}
                  disabled={!host}
                  style={{ ['--fill' as string]: `${((s.seats - 1) / (MATCH.maxPlayers - 1)) * 100}%` }}
                  onChange={(e) => set({ seats: Number(e.target.value) })}
                />
              </Field>
            </div>
            )}
          </section>

          <section className='bf-panel bf-studs flex flex-col gap-3 p-5'>
            <div className='flex items-baseline justify-between'>
              <h2 className='bf-display text-2xl'>{solo ? t('soloCaption') : t('players')}</h2>
              {!solo && <span className='bf-display text-xl text-[var(--bf-muted)]'>{lobby.players.length}/10</span>}
            </div>
            <ul className='flex flex-col gap-2'>
              {lobby.players.map((p) => (
                <li key={p.id} className='flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2'>
                  <span className='h-8 w-8 rounded-lg' style={{ background: `linear-gradient(160deg, ${ROSTER[p.character].primary} 0 58%, ${ROSTER[p.character].secondary} 58%)` }} />
                  <span className='font-semibold'>{p.name}</span>
                  {p.host && !solo && <CrownIcon size={18} className='ml-auto text-[var(--bf-yellow)]' aria-label={t('host')} />}
                </li>
              ))}
            </ul>
            {solo && <SoloBrief settings={s} />}
            <div className='mt-auto pt-3'>
              {host ? (
                <button className='bf-btn bf-btn-primary !h-16 w-full' onClick={() => game.startMatch()}>
                  <PlayIcon size={26} />
                  <span className='bf-display text-3xl'>{t('start')}</span>
                </button>
              ) : (
                <div className='py-4 text-center font-medium text-[var(--bf-muted)]'>{t('waitingForHost')}</div>
              )}
            </div>
          </section>
        </div>
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
