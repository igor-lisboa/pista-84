import type { EndReason, Race, SaveData } from '../game/index.ts';
import { POINTS_PER_COIN, SECOND_CHANCE_PRICE } from '../game/index.ts';
import { t, type MessageKey } from '../i18n/index.ts';
import { byId, formatInteger } from './dom.ts';
import { distanceUnit, formatDistance, speedUnit, speedValue } from './units.ts';
import { icon } from './icons.ts';

export interface PauseActions {
  resume(): void;
  openSettings(): void;
  toMenu(): void;
}

export interface GameOverActions {
  restart(): void;
  secondChance(): void;
  toMenu(): void;
}

const REASON_KEYS: Readonly<Record<EndReason, MessageKey>> = {
  fuel: 'reason.fuel',
  traffic: 'reason.traffic',
  wall: 'reason.wall',
};

function showOverlay(html: string, crash = false): HTMLElement {
  const overlay = byId('overlay');
  overlay.classList.toggle('crash', crash);
  overlay.innerHTML = html;
  return overlay;
}

export function showPause(actions: PauseActions): void {
  showOverlay(`
    <div class="overlay-card">
      <span class="kicker">${t('pause.kicker')}</span>
      <h2>${t('pause.title')}</h2>
      <button id="resume" class="primary"><span>${t('pause.resume')}</span>${icon('play')}</button>
      <div class="overlay-actions">
        <button id="pauseSettings" class="secondary">${t('pause.options')}</button>
        <button id="toMenu" class="secondary">${t('pause.menu')}</button>
      </div>
    </div>`);
  byId('resume').onclick = actions.resume;
  byId('pauseSettings').onclick = actions.openSettings;
  byId('toMenu').onclick = actions.toMenu;
}

export function showGameOver(race: Race, save: SaveData, actions: GameOverActions): void {
  const crashed = race.crashed;
  const reasonKey = REASON_KEYS[race.endReason ?? 'fuel'];
  const reason = t(reasonKey, { speed: speedValue(race.crashSpeed), unit: speedUnit() });
  showOverlay(
    `
    <div class="overlay-card">
      <span class="kicker">${crashed ? t('over.crashKicker') : t('over.kicker')}</span>
      <h2>${crashed ? t('over.crashTitle') : t('over.title')}</h2>
      <p>${reason}</p>
      <div class="result-stats">
        <span>${formatInteger(race.score)} ${t('hud.pts')}</span>
        <span>${formatDistance(race.distance)} ${distanceUnit()}</span>
        <span>${t('coins.amount', { n: formatInteger(race.coins) })}</span>
      </div>
      <div class="result-conversion">
        <strong>${t('over.coinConversion', { score: formatInteger(race.score), coins: formatInteger(race.coins) })}</strong>
        <small>${t('over.coinRate', { points: POINTS_PER_COIN })}</small>
      </div>
      <p>${t('over.record', { n: formatInteger(save.bestScore) })}</p>
      <button id="restart" class="primary"><span>${t('over.again')}</span>${icon('play')}</button>
      ${race.continued ? '' : `<button id="continue" class="secondary" ${save.coins < SECOND_CHANCE_PRICE ? 'disabled' : ''}>${t('over.second', { price: formatInteger(SECOND_CHANCE_PRICE) })}</button>
        <p class="second-chance-balance">${t('over.secondBalance', { coins: formatInteger(save.coins) })}</p>`}
      <button id="toMenu" class="secondary">${t('over.menu')}</button>
    </div>`,
    crashed,
  );
  byId('restart').onclick = actions.restart;
  byId('toMenu').onclick = actions.toMenu;
  const second = document.getElementById('continue');
  if (second) second.onclick = actions.secondChance;
}
