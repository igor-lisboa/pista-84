import { t } from '../i18n/index.ts';
import { byId } from './dom.ts';

const GITHUB_URL = 'https://github.com/igor-lisboa';
const AVATAR_URL = '/assets/igor-lisboa.jpg';

/** "About" dialog: who made the game and why it exists. */
export class AboutDialog {
  render(): void {
    byId('modalBody').innerHTML = `
      <span class="label">${t('about.label')}</span>
      <h1>${t('about.title')}<span>.</span></h1>
      <div class="about-card">
        <img class="about-avatar" src="${AVATAR_URL}" width="120" height="120" alt="Igor Lisboa" decoding="async">
        <div>
          <strong>Igor Lisboa</strong>
          <small class="label">${t('about.role')}</small>
          <blockquote>${t('about.quote')}</blockquote>
        </div>
      </div>
      <p>${t('about.p1')}</p>
      <p>${t('about.p2')}</p>
      <p>${t('about.p3')}</p>
      <a class="about-link menu-button" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer"><span>${t('about.github')}</span><b data-icon="arrow"></b></a>`;
  }
}
