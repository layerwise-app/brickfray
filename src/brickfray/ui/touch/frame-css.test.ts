import { describe, expect, it } from 'vitest';
import { declarationsForBox, mediaForBox, viewportFeature } from './frame-css';

/** An iPhone 14 held upright, its app turned: the landscape box the page is laid out in. */
const PHONE = { width: 844, height: 390 };

describe('viewport media for a turned app', () => {
  it('decides the features the menus and HUD use for the landscape box', () => {
    expect(viewportFeature('(orientation: landscape)', PHONE)).toBe(true);
    expect(viewportFeature('(orientation: portrait)', PHONE)).toBe(false);
    expect(viewportFeature('(max-height: 560px)', PHONE)).toBe(true);
    expect(viewportFeature('(max-width: 1023.98px)', PHONE)).toBe(true);
    expect(viewportFeature('(min-width: 1024px)', PHONE)).toBe(false);
    expect(viewportFeature('(min-height: 560.02px)', PHONE)).toBe(false);
    expect(viewportFeature('(max-width: 599.98px)', PHONE)).toBe(false);
  });

  it('reads range syntax and rem as the browser does (Tailwind breakpoints)', () => {
    expect(viewportFeature('(width >= 40rem)', PHONE)).toBe(true);
    expect(viewportFeature('(width < 40rem)', PHONE)).toBe(false);
    expect(viewportFeature('(40rem <= width < 64rem)', PHONE)).toBe(true);
    expect(viewportFeature('(height > 500px)', PHONE)).toBe(false);
    expect(viewportFeature('(min-aspect-ratio: 16/9)', PHONE)).toBe(true);
  });

  it('leaves features it does not own to the browser', () => {
    expect(viewportFeature('(hover: hover)', PHONE)).toBeNull();
    expect(viewportFeature('(min-device-width: 400px)', PHONE)).toBeNull();
    expect(viewportFeature('(max-width: 50vw)', PHONE)).toBeNull();
  });

  it('rewrites a whole query list, keeping what is not about the viewport', () => {
    expect(mediaForBox('(orientation: landscape) and (max-height: 560px), (max-width: 1023.98px)', PHONE)).toBe('(min-width: 0px) and (min-width: 0px), (min-width: 0px)');
    expect(mediaForBox('(max-width: 1023.98px) and (orientation: portrait), (max-width: 599.98px)', PHONE)).toBe('(min-width: 0px) and (max-width: 0px), (max-width: 0px)');
    expect(mediaForBox('(hover: hover) and (width >= 64rem)', PHONE)).toBe('(hover: hover) and (max-width: 0px)');
    expect(mediaForBox('(prefers-reduced-motion: reduce)', PHONE)).toBe('(prefers-reduced-motion: reduce)');
  });
});

describe('declarations for a turned app', () => {
  it('makes viewport units read the box and insets read the edges they now sit at', () => {
    expect(declarationsForBox('font-size: clamp(44px, 7.2vw, 104px);')).toBe('font-size: clamp(44px, calc(7.2 * var(--bf-vw)), 104px);');
    expect(declarationsForBox('width: min(72vh, 72vw);')).toBe('width: min(calc(72 * var(--bf-vh)), calc(72 * var(--bf-vw)));');
    expect(declarationsForBox('max-height: 88dvh; margin-left: -5vw;')).toBe('max-height: calc(88 * var(--bf-vh)); margin-left: calc(-5 * var(--bf-vw));');
    expect(declarationsForBox('padding: max(16px, env(safe-area-inset-top)) 0 env(safe-area-inset-bottom, 0px);')).toBe(
      'padding: max(16px, var(--bf-inset-top)) 0 var(--bf-inset-bottom, 0px);'
    );
  });

  it('leaves other units and names alone', () => {
    const text = 'width: 92vmin; --gap-2vw: 3px; height: calc(100% - 12px);';
    expect(declarationsForBox(text)).toBe(text);
  });
});
