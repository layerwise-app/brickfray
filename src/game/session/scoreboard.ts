/**
 * Free-for-all scores. The host keeps the tally and sends the full table on every change; the
 * other players just show it (the corner ranking and the hold-to-view board).
 */
import { FFA_TARGET } from '../config';
import { t } from '../core/i18n';
import { baseCode, esc, isOnline, mmss } from './state';
import type { ScoreEntry, ScoreRow, Session, Winner } from './state';

export class Scoreboard {
  /** `onWin` ends the match locally once the host has announced a winner. */
  constructor(
    private readonly s: Session,
    private readonly onWin: (winner: Winner) => void,
  ) {}

  /** Host: counts a death (and the kill, if someone else got it), then shares the table. */
  tallyDeath(victim: string, killer: string | null): void {
    const { scores } = this.s;
    const v = scores.get(victim);
    if (v) v.deaths++;
    if (killer && killer !== victim) {
      const k = scores.get(killer);
      if (k) k.kills++;
    }
    this.send();
    this.checkWin();
  }

  /** Host: sends the full table to everyone and shows it here. */
  send(): void {
    const rows: ScoreEntry[] = [...this.s.scores.entries()].map(([id, sc]) => ({ id, ...sc }));
    this.s.net.send('score', rows);
    this.apply(rows);
  }

  apply(rows: readonly ScoreEntry[]): void {
    const { scores } = this.s;
    scores.clear();
    for (const r of rows) scores.set(r.id, { name: r.name, kills: r.kills, deaths: r.deaths });
    this.refreshHud();
  }

  /** Most kills first, then fewest deaths. */
  sorted(): [string, ScoreRow][] {
    return [...this.s.scores.entries()].sort((a, b) => b[1].kills - a[1].kills || a[1].deaths - b[1].deaths);
  }

  refreshHud(): void {
    const { game, net } = this.s;
    const { hud } = this.s.ctx;
    if (!isOnline(game)) return;
    const rows = this.sorted();
    const top = rows.slice(0, 3);
    const myIdx = rows.findIndex(([id]) => id === net.id);
    if (myIdx >= 3) top.push(rows[myIdx]);
    hud.setPvpScore(
      top
        .map(
          ([id, sc]) =>
            `<div class="row${id === net.id ? ' me' : ''}"><span class="rank">${rows.findIndex(([x]) => x === id) + 1}.</span><span>${esc(sc.name)}${id === net.id ? ' (' + t('you') + ')' : ''}</span><b>${sc.kills}</b></div>`,
        )
        .join('') + `<div class="target">${t('targetKills', { kills: FFA_TARGET })}</div>`,
    );
    hud.setModifier('');
    if (!hud.el.board.hidden) hud.setBoard(this.boardHTML());
  }

  /** The hold-to-view score board. */
  boardHTML(title = t('freeForAll')): string {
    const { net, clock } = this.s;
    const rows = this.sorted();
    return `<h3>${title}</h3>${rows.map(([id, sc]) => `<div class="${id === net.id ? 'me' : ''}"><span>${esc(sc.name)}${id === net.id ? ' (' + t('you') + ')' : ''}</span><span>${t('killsDeaths', { kills: sc.kills, deaths: sc.deaths })}</span></div>`).join('')}<div class="foot">${t('lobbyFooter', { kills: FFA_TARGET, time: mmss(clock.left), lobby: baseCode(net.aliasCode || net.code) })}</div>`;
  }

  /** The final standings shown on the results and pause screens. */
  standingsHTML(): string {
    const { net } = this.s;
    return this.sorted()
      .map(([id, sc]) => `<div class="${id === net.id ? 'me' : ''}"><span>${esc(sc.name)}</span><span>${t('killsDeaths', { kills: sc.kills, deaths: sc.deaths })}</span></div>`)
      .join('');
  }

  /** Host: ends the match as soon as someone reaches the kill target. */
  private checkWin(): void {
    const { game, net, scores } = this.s;
    if (!net.isHost || !isOnline(game) || game.over) return;
    let winner: Winner | null = null;
    for (const [id, sc] of scores) if (sc.kills >= FFA_TARGET) winner = { id, name: sc.name };
    if (winner) {
      net.send('end', winner);
      this.onWin(winner);
    }
  }
}
