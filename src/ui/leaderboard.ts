import { t } from '../i18n/index.ts';
import { byId, formatInteger } from './dom.ts';
import { distanceUnit, formatDistance } from './units.ts';

const PAGE_SIZE = 5;

interface Entry {
  rank: number;
  name: string;
  score: number;
  distance: number;
  mine: boolean;
}

interface Page {
  entries: Entry[];
  page: number;
  pages: number;
  total: number;
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Online ranking, five drivers per page. Needs a connection; the game itself never does. */
export class LeaderboardDialog {
  private readonly playerId: () => string;

  constructor(playerId: () => string) {
    this.playerId = playerId;
  }

  open(): void {
    this.shell(`<p role="status">${t('lb.loading')}</p>`);
    void this.load(1);
  }

  private shell(body: string): void {
    byId('modalBody').innerHTML = `
      <span class="label">${t('lb.label')}</span>
      <h1>${t('lb.title')}<span>.</span></h1>
      ${body}`;
  }

  private async load(page: number): Promise<void> {
    try {
      const response = await fetch(`/api/leaderboard?page=${page}&size=${PAGE_SIZE}`, {
        headers: { 'x-player-id': this.playerId() },
      });
      if (!response.ok) throw new Error(String(response.status));
      this.render((await response.json()) as Page);
    } catch {
      this.shell(`<p class="warning" role="status">${t('lb.offline')}</p>`);
    }
  }

  private render(data: Page): void {
    if (data.total === 0) {
      this.shell(`<p role="status">${t('lb.empty')}</p>`);
      return;
    }
    const rows = data.entries
      .map(
        (entry) => `
        <li class="lb-row${entry.mine ? ' mine' : ''}">
          <b class="lb-rank">${entry.rank}</b>
          <span class="lb-name">${escapeHtml(entry.name)}${entry.mine ? ` <em>${t('lb.you')}</em>` : ''}</span>
          <strong class="lb-score">${formatInteger(entry.score)}</strong>
          <small class="lb-distance">${formatDistance(entry.distance)} ${distanceUnit()}</small>
        </li>`,
      )
      .join('');
    this.shell(`
      <ol class="lb-list" aria-label="${t('lb.title')}">${rows}</ol>
      <nav class="lb-pager" aria-label="${t('lb.page', { page: data.page, pages: data.pages })}">
        <button id="lbPrev" class="menu-button" ${data.page <= 1 ? 'disabled' : ''}><span>${t('lb.prev')}</span></button>
        <span id="lbPage" role="status">${t('lb.page', { page: data.page, pages: data.pages })}</span>
        <button id="lbNext" class="menu-button" ${data.page >= data.pages ? 'disabled' : ''}><span>${t('lb.next')}</span></button>
      </nav>
      <small class="label">${t('lb.total', { total: data.total })}</small>`);
    byId('lbPrev').onclick = () => void this.load(data.page - 1);
    byId('lbNext').onclick = () => void this.load(data.page + 1);
  }
}
