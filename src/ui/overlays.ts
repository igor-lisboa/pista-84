import type { EndReason, Race, SaveData } from '../game/index.ts';
import { t, type MessageKey } from '../i18n/index.ts';
import { byId, formatInteger, formatKm } from './dom.ts';

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
      <button id="resume" class="primary"><span>${t('pause.resume')}</span><b>▶</b></button>
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
  const reason = t(reasonKey, { speed: Math.round(race.crashSpeed) });
  showOverlay(
    `
    <div class="overlay-card">
      <span class="kicker">${crashed ? t('over.crashKicker') : t('over.kicker')}</span>
      <h2>${crashed ? t('over.crashTitle') : t('over.title')}</h2>
      <p>${reason}</p>
      <div class="result-stats">
        <span>${formatInteger(race.score)} ${t('hud.pts')}</span>
        <span>${formatKm(race.distance)} km</span>
        <span>◈ ${race.coins}</span>
      </div>
      <p>${t('over.record', { n: formatInteger(save.bestScore) })}</p>
      <button id="restart" class="primary"><span>${t('over.again')}</span><b>▶</b></button>
      ${race.continued ? '' : `<button id="continue" class="secondary">${t('over.second')}</button>`}
      <button id="toMenu" class="secondary">${t('over.menu')}</button>
    </div>`,
    crashed,
  );
  byId('restart').onclick = actions.restart;
  byId('toMenu').onclick = actions.toMenu;
  const second = document.getElementById('continue');
  if (second) second.onclick = actions.secondChance;
}
