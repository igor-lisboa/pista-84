import { t } from '../i18n/index.ts';
import type { SaveData } from '../game/index.ts';
import { byId } from './dom.ts';

export interface NewPlayerDeps {
  readonly save: SaveData;
  /** Performs the reset once the player confirmed. */
  confirm(): void;
}

/** Asks for confirmation before this device starts over as a new player. */
export class NewPlayerDialog {
  private readonly deps: NewPlayerDeps;

  constructor(deps: NewPlayerDeps) {
    this.deps = deps;
  }

  render(): void {
    const name = this.deps.save.username ?? '—';
    byId('modalBody').innerHTML = `
      <span class="label">${t('newp.label')}</span>
      <h1>${t('newp.title')}<span>.</span></h1>
      <p>${t('newp.body')}</p>
      <p>${t('newp.keep', { name })}</p>
      <p class="warning">${t('newp.warn')}</p>
      <div class="confirm-actions">
        <button id="newPlayerCancel" class="menu-button"><span>${t('newp.cancel')}</span></button>
        <button id="newPlayerConfirm" class="menu-button danger"><span>${t('newp.confirm')}</span></button>
      </div>`;
    byId('newPlayerCancel').onclick = () => byId<HTMLDialogElement>('modal').close();
    byId('newPlayerConfirm').onclick = () => this.deps.confirm();
    byId('newPlayerCancel').focus();
  }
}
