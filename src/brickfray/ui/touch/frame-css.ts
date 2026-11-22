/**
 * While the app is drawn turned a quarter (landscape.ts), the browser still answers media queries, viewport units and
 * safe-area insets for the upright viewport. This pass rewrites the page's style sheets for the landscape box instead:
 * viewport media conditions are decided for the box, `vw`/`vh` read the box's own size and the insets come from the
 * edges they now sit at. Everything is put back as authored once the app stands straight again.
 */

/** Stays in place: a rule for an element drawn upright over the turned app (the text editor). */
const UPRIGHT = 'bf-upright';
const ALWAYS = '(min-width: 0px)';
const NEVER = '(max-width: 0px)';
const VIEWPORT_LEAF = /\([^()]*\b(?:width|height|orientation|aspect-ratio)\b[^()]*\)/g;
const VIEWPORT_UNIT = /(^|[^\w.-])(-?(?:\d+\.?\d*|\.\d+))[dsl]?(vw|vh)\b/g;
const INSET = /env\(\s*safe-area-inset-(top|right|bottom|left)/g;
const OPERATOR = /(<=|>=|<|>|=)/;

export interface Box {
  width: number;
  height: number;
}

/** One media feature in parentheses, decided for a box; null when it is not a viewport feature this understands. */
export function viewportFeature(leaf: string, box: Box): boolean | null {
  const body = leaf.slice(1, -1).trim().toLowerCase();
  const plain = /^(min-|max-)?(width|height|aspect-ratio|orientation)\s*:\s*(.+)$/.exec(body);
  if (plain) {
    const [, prefix, feature, raw] = plain as unknown as [string, string | undefined, string, string];
    if (feature === 'orientation') return raw === 'landscape' ? box.width > box.height : raw === 'portrait' ? box.height >= box.width : null;
    const value = feature === 'aspect-ratio' ? ratio(raw) : length(raw);
    if (value === null) return null;
    const actual = measure(feature, box);
    return prefix === 'min-' ? actual >= value : prefix === 'max-' ? actual <= value : actual === value;
  }
  const parts = body.split(OPERATOR).map((part) => part.trim());
  if (parts.length !== 3 && parts.length !== 5) return null;
  const at = parts.findIndex((part) => part === 'width' || part === 'height' || part === 'aspect-ratio');
  if (at < 0 || at % 2) return null;
  const feature = parts[at]!;
  const actual = measure(feature, box);
  const read = (raw: string) => (feature === 'aspect-ratio' ? ratio(raw) : length(raw));
  const checks: [number | null, string, number | null][] = [];
  if (at > 0) checks.push([read(parts[at - 2]!), parts[at - 1]!, actual]);
  if (at < parts.length - 1) checks.push([actual, parts[at + 1]!, read(parts[at + 2]!)]);
  if (checks.some(([a, , b]) => a === null || b === null)) return null;
  return checks.every(([a, op, b]) => compare(a!, op, b!));
}

/** A media query list with each viewport feature replaced by one that is always or never true. */
export function mediaForBox(text: string, box: Box) {
  return text.replace(VIEWPORT_LEAF, (leaf) => {
    const result = viewportFeature(leaf, box);
    return result === null ? leaf : result ? ALWAYS : NEVER;
  });
}

/** Declarations with viewport units reading the box's size and safe-area insets reading the turned edges. */
export function declarationsForBox(text: string) {
  return text.replace(VIEWPORT_UNIT, (_, before: string, n: string, unit: string) => `${before}calc(${n} * var(--bf-${unit}))`).replace(INSET, (_, side: string) => `var(--bf-inset-${side}`);
}

function measure(feature: string, box: Box) {
  return feature === 'width' ? box.width : feature === 'height' ? box.height : box.width / box.height;
}

/** Media query lengths: px, and em/rem from the initial 16 px. */
function length(raw: string) {
  const m = /^(-?(?:\d+\.?\d*|\.\d+))(px|r?em)?$/.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!m[2]) return n === 0 ? 0 : null;
  return m[2] === 'px' ? n : n * 16;
}

function ratio(raw: string) {
  const [a, b] = raw.split('/').map((part) => Number(part.trim()));
  if (!Number.isFinite(a) || (b !== undefined && !Number.isFinite(b))) return null;
  return b === undefined ? a! : a! / b;
}

function compare(a: number, op: string, b: number) {
  return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : op === '>=' ? a >= b : a === b;
}

const mediaAsAuthored = new Map<CSSMediaRule, string>();
const styleAsAuthored = new Map<CSSStyleDeclaration, string>();

/** Rewrites every readable style sheet for the box, or puts them all back (null). Safe to call again as sheets come and go. */
export function fitStyleSheets(box: Box | null) {
  if (!box) {
    for (const [rule, text] of mediaAsAuthored) rule.media.mediaText = text;
    for (const [style, text] of styleAsAuthored) style.cssText = text;
    mediaAsAuthored.clear();
    styleAsAuthored.clear();
    return;
  }
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // Still loading, or from another origin: a loaded sheet comes round again (watchStyleSheets).
      continue;
    }
    fitRules(rules, box);
  }
}

function fitRules(rules: CSSRuleList, box: Box) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule && rule.selectorText.includes(UPRIGHT)) continue;
    if (rule instanceof CSSMediaRule) {
      const authored = mediaAsAuthored.get(rule) ?? rule.media.mediaText;
      const fitted = mediaForBox(authored, box);
      if (fitted !== authored || mediaAsAuthored.has(rule)) {
        mediaAsAuthored.set(rule, authored);
        if (rule.media.mediaText !== fitted) rule.media.mediaText = fitted;
      }
    }
    const style = (rule as CSSStyleRule).style as CSSStyleDeclaration | undefined;
    if (style && !styleAsAuthored.has(style)) {
      const text = style.cssText;
      const fitted = declarationsForBox(text);
      if (fitted !== text) {
        styleAsAuthored.set(style, text);
        style.cssText = fitted;
      }
    }
    if (rule instanceof CSSImportRule) {
      try {
        if (rule.styleSheet) fitRules(rule.styleSheet.cssRules, box);
      } catch {
        // Another origin.
      }
    }
    const children = (rule as CSSGroupingRule).cssRules as CSSRuleList | undefined;
    if (children) fitRules(children, box);
  }
}

/** Calls `fn` when style sheets are added, replaced (hot reload) or finish loading, at most once a frame. */
export function watchStyleSheets(fn: () => void) {
  let frame = 0;
  const soon = () => {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      fn();
    });
  };
  const observer = new MutationObserver(soon);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  const onLoad = (e: Event) => {
    if (e.target instanceof HTMLLinkElement || e.target instanceof HTMLStyleElement) soon();
  };
  document.addEventListener('load', onLoad, true);
  return () => {
    observer.disconnect();
    document.removeEventListener('load', onLoad, true);
    cancelAnimationFrame(frame);
  };
}
