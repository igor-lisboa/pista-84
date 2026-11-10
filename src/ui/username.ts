import { USERNAME_MAX, USERNAME_MIN, normalizeUsername, type SaveData } from '../game/index.ts';
import { t } from '../i18n/index.ts';
import { byId } from './dom.ts';
import { AccountError } from '../net/account.ts';
import { authErrorKey } from './account.ts';
import { authTabs, bindAuthTabs, setFormBusy } from './auth-tabs.ts';

export interface UsernameDeps {
  readonly save: SaveData;
  /** Creates the account (signup) or signs into it (login), merging this device's progress. */
  signIn(action: 'login' | 'signup', username: string, password: string): Promise<void>;
  /** Called after the account is ready on this device. */
  onSaved(name: string): void;
  /** Keeps the name on this device only, when the account service cannot be reached. */
  offline(name: string): void;
}

const PASSWORD_MIN = 5;
const PASSWORD_MAX = 128;

/**
 * First-launch screen: the driver name and a password create the online account, so the same
 * progress can be used on other devices. Players who already have an account switch to login.
 */
export class UsernameDialog {
  private readonly deps: UsernameDeps;
  private mode: 'signup' | 'login' = 'signup';

  constructor(deps: UsernameDeps) {
    this.deps = deps;
  }

  /** Whether the player still has to create or log into an account before playing. */
  get required(): boolean {
    return this.deps.save.username === null;
  }

  render(): void {
    const login = this.mode === 'login';
    const submitLabel = t(login ? 'auth.login' : 'auth.signup');
    byId('modalBody').innerHTML = `
      <span class="label">${t('user.label')}</span>
      <h1>${t(login ? 'user.loginTitle' : 'user.title')}<span>.</span></h1>
      ${authTabs('username', this.mode)}
      <p>${t(login ? 'user.loginHint' : 'user.hint')}</p>
      <form id="usernameForm" class="username-form" novalidate>
        <label for="usernameInput">${t('auth.username')}</label>
        <input id="usernameInput" type="text" name="username" autocomplete="username" autocapitalize="off" spellcheck="false"
          minlength="${USERNAME_MIN}" maxlength="${USERNAME_MAX}" placeholder="${t('user.placeholder')}" aria-describedby="usernameRules">
        <label for="usernamePassword">${t('auth.password')}</label>
        <input id="usernamePassword" type="password" name="password" autocomplete="${login ? 'current-password' : 'new-password'}"
          minlength="${PASSWORD_MIN}" maxlength="${PASSWORD_MAX}" aria-describedby="usernameRules">
        <p id="usernameRules" class="username-rules">${t('auth.rules')}</p>
        <p id="usernameStatus" class="form-status" role="status" aria-live="polite"></p>
        <button class="primary submit" type="submit"><span>${submitLabel}</span></button>
      </form>
      <button id="usernameOffline" class="text-button" type="button" hidden><span>${t('user.offline')}</span></button>`;
    byId('closeModal').hidden = this.required;

    const input = byId<HTMLInputElement>('usernameInput');
    byId<HTMLFormElement>('usernameForm').onsubmit = (event) => {
      event.preventDefault();
      void this.submit();
    };
    bindAuthTabs('username', this.mode, (mode) => {
      this.mode = mode;
      this.render();
    });
    byId('usernameOffline').onclick = () => this.playOffline();
    input.oninput = () => {
      input.removeAttribute('aria-invalid');
      byId('usernameStatus').textContent = '';
    };
    requestAnimationFrame(() => input.focus());
  }

  /** Offline fallback: network trouble must never block local play. The account can be created later. */
  private playOffline(): void {
    const input = byId<HTMLInputElement>('usernameInput');
    const name = normalizeUsername(input.value);
    if (name === null) {
      byId('usernameStatus').textContent = t('auth.invalid');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    this.deps.offline(name);
    byId('closeModal').hidden = false;
    byId<HTMLDialogElement>('modal').close();
    this.deps.onSaved(name);
  }

  private async submit(): Promise<void> {
    const input = byId<HTMLInputElement>('usernameInput');
    const passwordField = byId<HTMLInputElement>('usernamePassword');
    const status = byId('usernameStatus');
    const name = normalizeUsername(input.value);
    const password = passwordField.value;
    passwordField.value = '';
    if (name === null || password.length < PASSWORD_MIN) {
      status.textContent = t('auth.invalid');
      if (name === null) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      } else passwordField.focus();
      return;
    }

    const body = byId('modalBody');
    setFormBusy(body, true);
    try {
      await this.deps.signIn(this.mode, name, password);
      this.deps.onSaved(name);
    } catch (error) {
      status.textContent = t(authErrorKey(error));
      // Only a connection problem opens the offline way in; a wrong password or a taken name does not.
      byId('usernameOffline').hidden = !(error instanceof AccountError && error.code === 'unavailable');
      if (error instanceof Error && 'code' in error && error.code === 'taken') {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      }
      setFormBusy(body, false);
    }
  }
}
