import { USERNAME_MAX, USERNAME_MIN, normalizeUsername, type SaveData } from '../game/index.ts';
import { t } from '../i18n/index.ts';
import { byId } from './dom.ts';

export interface UsernameDeps {
  readonly save: SaveData;
  persist(): void;
  /** Called after a valid name is stored. */
  onSaved(name: string): void;
}

/** Asks for the leaderboard name; on first launch the dialog cannot be dismissed. */
export class UsernameDialog {
  private readonly deps: UsernameDeps;

  constructor(deps: UsernameDeps) {
    this.deps = deps;
  }

  /** Whether the player still has to pick a name before playing. */
  get required(): boolean {
    return this.deps.save.username === null;
  }

  render(): void {
    const { save } = this.deps;
    byId('modalBody').innerHTML = `
      <span class="label">${t('user.label')}</span>
      <h1>${t('user.title')}<span>.</span></h1>
      <p>${t('user.hint')}</p>
      <p>${t('user.keep')}</p>
      <form id="usernameForm" class="username-form" novalidate>
        <input id="usernameInput" type="text" name="username" autocomplete="nickname" autocapitalize="off" spellcheck="false"
          minlength="${USERNAME_MIN}" maxlength="${USERNAME_MAX}" placeholder="${t('user.placeholder')}"
          aria-label="${t('user.title')}" aria-describedby="usernameRules" value="${save.username ?? ''}">
        <p id="usernameRules" class="username-rules">${t('user.rules')}</p>
        <button class="primary" type="submit"><span>${t('user.confirm')}</span></button>
      </form>`;
    byId('closeModal').hidden = this.required;

    const input = byId<HTMLInputElement>('usernameInput');
    byId<HTMLFormElement>('usernameForm').onsubmit = (event) => {
      event.preventDefault();
      const name = normalizeUsername(input.value);
      if (name === null) {
        byId('usernameRules').classList.add('invalid');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      save.username = name;
      this.deps.persist();
      byId('closeModal').hidden = false;
      byId<HTMLDialogElement>('modal').close();
      this.deps.onSaved(name);
    };
    input.oninput = () => {
      byId('usernameRules').classList.remove('invalid');
      input.removeAttribute('aria-invalid');
    };
    requestAnimationFrame(() => input.focus());
  }
}
