/** Bounty gold: face, its shaded lower half, rim, the star's ink; the chip's dark backing. */
export const BOUNTY_GOLD = { light: '#ffe27a', face: '#ffcd2e', dark: '#e0a400', rim: '#9a6400', ink: '#6e4500', backing: 'rgba(28,18,0,.84)' } as const;

/**
 * The bounty mark as SVG markup (React and the DOM name tags share it): a gold round 1x1 plate seen from above, its
 * stud embossed with a star. Flat fills only: no ids to clash between copies.
 */
export function coinSvg(size: number): string {
  const g = BOUNTY_GOLD;
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 20 20" style="display:block;flex:none;overflow:visible">` +
    `<circle cx="10" cy="11" r="9" fill="${g.rim}"/>` +
    `<circle cx="10" cy="9.6" r="8.7" fill="${g.face}" stroke="${g.rim}" stroke-width="1.1"/>` +
    `<path d="M2.2 11.2a8 8 0 0 0 15.6 0a8.2 6.6 0 0 1-15.6 0z" fill="${g.dark}"/>` +
    `<circle cx="10" cy="9.4" r="5.7" fill="${g.light}" stroke="${g.dark}" stroke-width="0.9"/>` +
    `<path d="M10 5.5l1.25 2.6 2.85.4-2.07 2 .49 2.85L10 12l-2.52 1.35.49-2.85-2.07-2 2.85-.4z" fill="${g.ink}"/>` +
    `</svg>`
  );
}
