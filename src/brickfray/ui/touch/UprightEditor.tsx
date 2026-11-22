import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { holdFrame, useFrame } from './landscape';
import './upright.css';

const TEXT_TYPES = new Set(['text', 'email', 'search', 'tel', 'url', 'password', 'number']);
const COPIED = ['inputmode', 'autocomplete', 'autocapitalize', 'enterkeyhint', 'pattern', 'spellcheck', 'placeholder'] as const;

/** How editing ended: the return key, leaving the field (Done, a tap outside, the keyboard closed) or Escape. */
type Ending = 'enter' | 'leave' | 'cancel';

/**
 * Typing while the app is turned. The phone's keyboard always comes up along the upright screen, so a text field in
 * the turned app is edited here instead: a sheet across the top of the upright screen with its own field, which the
 * player reads with the phone upright. The text goes back to the app's field as if typed there; the return key, Done
 * and a tap outside end the edit the way they would in that field.
 */
export function UprightEditor() {
  const { rotated } = useFrame();
  return rotated ? <Sheet /> : null;
}

function Sheet() {
  const { t } = useT();
  const sheet = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const source = useRef<HTMLInputElement | null>(null);
  /** The field being edited: its label and input type (React owns `type` on the editor and re-applies it each render). */
  const [editing, setEditing] = useState<{ label: string; type: string } | null>(null);

  // Focus is the external system: a field focused in the turned app hands its editing to the upright field at once,
  // inside the same tap, so the phone raises its keyboard for it.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const field = e.target;
      if (!(field instanceof HTMLInputElement) || !TEXT_TYPES.has(field.type) || field.readOnly || field.disabled) return;
      if (sheet.current!.contains(field) || !field.closest('.bf-root')) return;
      const editor = input.current!;
      editor.type = field.type;
      for (const name of COPIED) {
        const value = field.getAttribute(name);
        if (value === null) editor.removeAttribute(name);
        else editor.setAttribute(name, value);
      }
      if (field.maxLength > 0) editor.maxLength = field.maxLength;
      else editor.removeAttribute('maxlength');
      if (!field.hasAttribute('enterkeyhint') && field.form) editor.enterKeyHint = 'go';
      editor.style.textTransform = getComputedStyle(field).textTransform;
      editor.value = field.value;
      source.current = field;
      sheet.current!.dataset.open = 'true';
      holdFrame(true);
      editor.focus({ preventScroll: true });
      setEditing({ label: field.getAttribute('aria-label') || field.placeholder || field.labels?.[0]?.textContent || '', type: field.type });
    };
    document.addEventListener('focusin', onFocus, true);
    return () => document.removeEventListener('focusin', onFocus, true);
  }, []);

  const finish = async (how: Ending) => {
    const field = source.current;
    if (!field) return;
    source.current = null;
    const value = input.current!.value;
    sheet.current!.dataset.open = 'false';
    input.current!.blur();
    setEditing(null);
    holdFrame(false);
    window.scrollTo(0, 0);
    if (!field.isConnected) return;
    if (how === 'cancel') {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return;
    }
    if (value !== field.value) typeInto(field, value);
    // The app's handlers read the new text only after React has rendered it.
    await new Promise((resolve) => setTimeout(resolve));
    if (how === 'enter' && field.isConnected) {
      const go = field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      if (go) field.form?.requestSubmit();
    }
    if (field.isConnected) field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  };

  return (
    <div ref={sheet} className='bf-upright' data-open={editing !== null} onPointerDown={(e) => e.target === e.currentTarget && void finish('leave')}>
      <div className='bf-upright-panel'>
        {editing?.label && <span className='bf-upright-label'>{editing.label}</span>}
        <div className='bf-upright-row'>
          <input
            ref={input}
            className='bf-upright-input'
            type={editing?.type ?? 'text'}
            tabIndex={editing ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                void finish('enter');
              } else if (e.key === 'Escape') void finish('cancel');
            }}
            onBlur={() => void finish('leave')}
          />
          <button className='bf-upright-done' onPointerDown={(e) => e.preventDefault()} onClick={() => void finish('leave')}>
            {t('touch.edit.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sets a field's text the way typing does, so the app's own change handler sees it. */
function typeInto(field: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
