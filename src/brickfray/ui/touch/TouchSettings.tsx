import type { ReactNode } from 'react';
import type { Settings } from '../../game/settings';
import type { TouchSettings as Touch } from '../../game/touch-input';
import { useT, type MessageKey } from '../i18n';

type Slider = (label: MessageKey, value: number, min: number, max: number, step: number, apply: (v: number) => Settings, format?: (v: number) => string) => ReactNode;
type Toggle = (label: MessageKey, value: boolean, apply: (v: boolean) => Settings, hint?: MessageKey) => ReactNode;

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** The Controls tab's touch section, drawn with the panel's own sliders and switches. */
export function TouchSettings({ s, slider, toggle }: { s: Settings; slider: Slider; toggle: Toggle }) {
  const { t } = useT();
  const touch = s.input.touch;
  const set = (patch: Partial<Touch>): Settings => ({ ...s, input: { ...s.input, touch: { ...touch, ...patch } } });
  const vibrates = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  return (
    <>
      <span className='text-xs font-semibold uppercase tracking-[0.2em] text-[var(--bf-muted)]'>{t('touch.section')}</span>
      {slider('touch.sensitivity', touch.sensitivity, 0.3, 3, 0.05, (sensitivity) => set({ sensitivity }), percent)}
      {slider('touch.buttonSize', touch.buttonSize, 0.8, 1.4, 0.05, (buttonSize) => set({ buttonSize }), percent)}
      {toggle('touch.leftHanded', touch.leftHanded, (leftHanded) => set({ leftHanded }), 'touch.leftHandedHint')}
      {toggle('touch.autoFire', touch.autoFire, (autoFire) => set({ autoFire }), 'touch.autoFireHint')}
      {vibrates && toggle('touch.haptics', touch.haptics, (haptics) => set({ haptics }), 'touch.hapticsHint')}
    </>
  );
}
