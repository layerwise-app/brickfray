import { useEffect, useState } from 'react';
import type { Action } from '../game/input';
import type { Settings } from '../game/settings';
import { useGame } from './App';
import { LANGUAGES, setLang, useT, type MessageKey } from './i18n';
import { BackIcon } from './icons';
import { touchCapable } from '../game/input-mode';
import { TouchSettings } from './touch/TouchSettings';
import { useTouchMode } from './touch/useInputMode';

type Tab = 'graphics' | 'controls' | 'audio' | 'interface';
const TABS: Tab[] = ['graphics', 'controls', 'audio', 'interface'];
const ACTIONS: Action[] = ['forward', 'back', 'left', 'right', 'jump', 'crouch', 'sprint', 'fire', 'ads', 'reload', 'melee', 'grenade', 'weapon1', 'weapon2', 'scoreboard', 'chat'];
const CROSSHAIR_COLORS = ['#ffffff', '#ffe14d', '#4dff88', '#4de3ff', '#ff4dd2'];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const game = useGame();
  const { t, lang } = useT();
  const [tab, setTab] = useState<Tab>('graphics');
  const [s, setS] = useState<Settings>(game.settings);
  const [binding, setBinding] = useState<Action | null>(null);
  const touchMode = useTouchMode();

  const update = (next: Settings) => {
    setS(next);
    game.applySettings(next);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- captures the next key press while rebinding
  useEffect(() => {
    if (!binding) return;
    const onKey = (e: KeyboardEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = 'code' in e ? e.code : `Mouse${e.button}`;
      if (code !== 'Escape') {
        const current = s.input.bindings[binding];
        update({ ...s, input: { ...s.input, bindings: { ...s.input.bindings, [binding]: [code, current[1] === code ? undefined : current[1]] } } });
      }
      setBinding(null);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onKey, true);
    };
  }, [binding]);

  const slider = (label: MessageKey, value: number, min: number, max: number, step: number, apply: (v: number) => Settings, format = (v: number) => v.toFixed(step < 1 ? 2 : 0)) => (
    <label className='bf-setting grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2'>
      <span className='font-medium'>{t(label)}</span>
      <span className='bf-display text-lg tabular-nums'>{format(value)}</span>
      <input
        type='range'
        className='bf-range col-span-2'
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }}
        onChange={(e) => update(apply(Number(e.target.value)))}
      />
    </label>
  );

  const toggle = (label: MessageKey, value: boolean, apply: (v: boolean) => Settings, hint?: MessageKey) => (
    <label className='bf-setting flex cursor-pointer items-center gap-4'>
      <span className='flex flex-1 flex-col'>
        <span className='font-medium'>{t(label)}</span>
        {hint && <span className='text-sm text-[var(--bf-muted)]'>{t(hint)}</span>}
      </span>
      <button
        role='switch'
        aria-checked={value}
        onClick={() => update(apply(!value))}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${value ? 'bg-[var(--bf-yellow)]' : 'bg-white/15'}`}
      >
        <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </label>
  );

  return (
    <div className='absolute inset-0 z-40 grid place-items-center bg-[#0b1222]/65 p-4 backdrop-blur-sm' onClick={onClose}>
      <div className='bf-panel bf-studs bf-pop flex max-h-[88vh] w-full max-w-[620px] flex-col gap-4 p-6' onClick={(e) => e.stopPropagation()}>
        <div className='flex items-center gap-3'>
          <button className='bf-btn bf-btn-ghost bf-icon-btn bf-touch-target !h-10 !w-10' onClick={onClose} aria-label={t('done')}>
            <BackIcon size={20} />
          </button>
          <h2 className='bf-display text-3xl'>{t('settings')}</h2>
        </div>
        <div className='bf-seg'>
          {TABS.map((id) => (
            <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
              {t(id)}
            </button>
          ))}
        </div>
        <div className='bf-scroll flex flex-col gap-5 overflow-y-auto pr-1'>
          {tab === 'graphics' && (
            <>
              <div className='flex flex-col gap-2'>
                <span className='font-medium'>{t('quality')}</span>
                <div className='bf-seg'>
                  {(['low', 'medium', 'high'] as const).map((q) => (
                    <button key={q} aria-pressed={s.quality === q} onClick={() => update({ ...s, quality: q })}>
                      {t(`quality.${q}`)}
                    </button>
                  ))}
                </div>
              </div>
              {toggle(
                'autoResolution',
                s.autoResolution,
                (autoResolution) => {
                  game.renderer.autoScale = autoResolution;
                  return { ...s, autoResolution };
                },
                'autoResolutionHint'
              )}
              {slider('fov', s.fov, 80, 110, 1, (fov) => ({ ...s, fov }), (v) => `${v}°`)}
              {toggle('showStats', s.showStats, (showStats) => ({ ...s, showStats }))}
            </>
          )}
          {tab === 'controls' && (
            <>
              {touchCapable() && <TouchSettings s={s} slider={slider} toggle={toggle} />}
              {!touchMode && slider('sensitivity', s.input.sensitivity, 0.2, 8, 0.05, (sensitivity) => ({ ...s, input: { ...s.input, sensitivity } }))}
              {slider('adsSensitivity', s.input.adsSensitivity, 0.3, 2, 0.05, (adsSensitivity) => ({ ...s, input: { ...s.input, adsSensitivity } }))}
              {toggle('invertY', s.input.invertY, (invertY) => ({ ...s, input: { ...s.input, invertY } }))}
              {!touchMode && toggle('toggleAds', s.input.toggleAds, (toggleAds) => ({ ...s, input: { ...s.input, toggleAds } }))}
              {!touchMode && slider('gamepadSensitivity', s.input.gamepadSensitivity, 0.3, 2.5, 0.05, (gamepadSensitivity) => ({ ...s, input: { ...s.input, gamepadSensitivity } }))}
              {slider('aimAssist', s.input.aimAssist, 0, 1, 0.05, (aimAssist) => ({ ...s, input: { ...s.input, aimAssist } }), (v) => `${Math.round(v * 100)}%`)}
              <div className={touchMode ? 'hidden' : 'flex flex-col gap-1.5'}>
                <span className='text-xs font-semibold uppercase tracking-[0.2em] text-[var(--bf-muted)]'>{t('keys')}</span>
                {ACTIONS.map((action) => (
                  <div key={action} className='flex items-center gap-3 rounded-lg px-1 py-0.5'>
                    <span className='flex-1'>{t(`action.${action}`)}</span>
                    <button className='bf-btn bf-btn-ghost !h-9 min-w-28 !px-3 text-sm font-semibold' onClick={() => setBinding(action)}>
                      {binding === action ? t('pressKey') : keyLabel(s.input.bindings[action][0])}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'audio' && (
            <>
              {(['master', 'effects', 'music', 'ui'] as const).map((bus) =>
                slider(`mix.${bus}`, s.mix[bus], 0, 1, 0.01, (v) => ({ ...s, mix: { ...s.mix, [bus]: v } }), (v) => `${Math.round(v * 100)}`)
              )}
            </>
          )}
          {tab === 'interface' && (
            <>
              <div className='flex flex-col gap-2'>
                <span className='font-medium'>{t('language')}</span>
                <div className='grid grid-cols-4 gap-2'>
                  {LANGUAGES.map((l) => (
                    <button key={l.code} className={`bf-touch-target rounded-lg px-2 py-2 font-medium ${l.code === lang ? 'bg-[var(--bf-yellow)] text-[#2a1a00]' : 'bg-white/8 hover:bg-white/15'}`} onClick={() => setLang(l.code)}>
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <span className='font-medium'>{t('crosshair')}</span>
                <div className='flex gap-2'>
                  {CROSSHAIR_COLORS.map((color) => (
                    <button
                      key={color}
                      aria-label={color}
                      onClick={() => update({ ...s, crosshair: { ...s.crosshair, color } })}
                      className='bf-touch-target h-9 w-9 rounded-lg'
                      style={{ background: color, boxShadow: s.crosshair.color === color ? '0 0 0 3px #fff, 0 0 0 5px #0008' : 'none' }}
                    />
                  ))}
                </div>
              </div>
              {toggle('damageNumbers', s.damageNumbers, (damageNumbers) => ({ ...s, damageNumbers }))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function keyLabel(code: string) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names: Record<string, string> = { Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Space: 'Space', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', Tab: 'Tab', Enter: 'Enter', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return names[code] ?? code;
}
