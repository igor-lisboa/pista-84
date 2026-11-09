import type {SaveData} from '../game/save.ts';
import {ACCOUNT_KEY, AccountError, accountRequest, localAccount, mergeAccount} from '../net/account.ts';
import type {AccountIdentity} from '../net/account.ts';
import {t} from '../i18n/index.ts';
import type {MessageKey} from '../i18n/types.ts';
import {byId} from './dom.ts';

interface AccountDeps {
  save: SaveData;
  switching(): void;
  finished(): void;
  signedIn(save: SaveData, user: AccountIdentity): void;
  signedOut(): void;
}

const errors: Record<string, MessageKey> = {
  taken: 'auth.taken', credentials: 'auth.credentials', invalid: 'auth.invalid', limited: 'auth.limited',
  secure: 'auth.secure',
};

/** Translation key for a failed account request. */
export const authErrorKey = (error: unknown): MessageKey =>
  error instanceof AccountError ? errors[error.code] ?? 'auth.unavailable' : 'auth.unavailable';

/** Optional account access. Password inputs are cleared immediately after submission. */
export class AccountDialog {
  private busy = false;
  /** The name typed in the last submission, restored when a merge has to be retried. */
  private retryUsername = '';
  private pendingUser: AccountIdentity | null = null;
  constructor(deps: AccountDeps) { this.deps = deps; }
  private readonly deps: AccountDeps;

  async open(): Promise<void> {
    const initialUser = localAccount();
    this.render(initialUser);
    try {
      const {user} = await accountRequest('/api/auth');
      // Recover a valid cookie after a response/storage failure without asking for credentials again.
      if (!byId<HTMLDialogElement>('modal').open || !document.getElementById('accountStatus')) return;
      const identity = user as AccountIdentity | null;
      const known = localAccount();
      // A slow session check must not erase credentials already being typed.
      if (!identity && !initialUser) return;
      if (identity && initialUser?.id === identity.id) return;
      if (identity && (!known || known.id === identity.id)) this.render(identity);
      else this.render(null);
    } catch { /* The local account screen remains available offline. */ }
  }

  private render(user = localAccount(), signup = false): void {
    if (this.busy) return;
    byId('closeModal').hidden = false;
    const known = localAccount();
    if (known) signup = false;
    byId('modalBody').innerHTML = `
      <span class="label">${t('auth.account')}</span>
      <h1>${t(user ? 'auth.account' : signup ? 'auth.signup' : 'auth.login')}</h1>
      <p>${t(user ? 'auth.logoutHelp' : 'auth.help')}</p>
      ${user ? '<p id="accountName"></p><button id="accountLogout" class="menu-button danger"><span>' + t('auth.logout') + '</span></button>' : `
      <form id="accountForm" class="username-form">
        <label for="accountUsername">${t('auth.username')}</label>
        <input id="accountUsername" name="username" autocomplete="username" required minlength="3" maxlength="32" autocapitalize="none" spellcheck="false">
        <label for="accountPassword">${t('auth.password')}</label>
        <input id="accountPassword" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="5" maxlength="256" aria-describedby="accountRules">
        <p id="accountRules" class="username-rules">${t('auth.rules')}</p>
        <button class="menu-button" type="submit"><span>${t(signup ? 'auth.signup' : 'auth.login')}</span></button>
        ${known ? `<button id="accountLogout" class="menu-button danger" type="button"><span>${t('auth.logout')}</span></button><p>${t('auth.logoutHelp')}</p>` : `<button id="accountSwitch" class="menu-button" type="button"><span>${t(signup ? 'auth.login' : 'auth.signup')}</span></button>`}
      </form>`}
      <p id="accountStatus" role="status" aria-live="polite"></p>`;
    if (user) {
      byId('accountName').textContent = user.username;
    } else {
      if (known) {
        const username = byId<HTMLInputElement>('accountUsername');
        username.value = known.username;
        username.readOnly = true;
      } else byId('accountSwitch').onclick = () => this.render(null, !signup);
      byId<HTMLInputElement>('accountUsername').oninput = event => {
        (event.target as HTMLInputElement).removeAttribute('aria-invalid');
        byId('accountStatus').textContent = '';
      };
      byId('accountForm').onsubmit = event => {
        event.preventDefault();
        const username = byId<HTMLInputElement>('accountUsername').value;
        this.retryUsername = username;
        const field = byId<HTMLInputElement>('accountPassword');
        const password = field.value;
        field.value = '';
        void this.run(async () => {
          // Never silently merge one signed-in account into a different account.
          if (localAccount()?.id !== known?.id) throw new AccountError('unavailable');
          const {user: identity} = await accountRequest('/api/auth', {action: signup ? 'signup' : 'login', username, password});
          this.pendingUser = identity as AccountIdentity;
          await this.reconcile(identity as AccountIdentity);
        });
      };
    }
    const logout = document.getElementById('accountLogout');
    if (logout) logout.onclick = () => void this.run(async () => {
      this.deps.switching();
      // Try the last local snapshot before revoking, but permit explicit logout if sync fails.
      try { await mergeAccount(this.deps.save); } catch { /* Logout intentionally clears local records. */ }
      await accountRequest('/api/auth', {action: 'logout'});
      this.deps.signedOut();
    });
  }

  /**
   * Signs in or creates an account from any screen (the first-launch name screen uses this).
   * Throws an AccountError on failure; the guest save is left untouched in that case.
   */
  async signInWith(action: 'login' | 'signup', username: string, password: string): Promise<void> {
    this.deps.switching();
    try {
      const {user} = await accountRequest('/api/auth', {action, username, password});
      await this.reconcile(user as AccountIdentity);
    } catch (error) {
      this.deps.finished();
      throw error;
    }
  }

  private async reconcile(user: AccountIdentity): Promise<void> {
    this.deps.switching();
    // Commit the owner marker only after the server has acknowledged the guest merge.
    const save = await mergeAccount(this.deps.save);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(user));
    this.deps.signedIn(save, user);
    this.pendingUser = null;
    byId<HTMLDialogElement>('modal').close();
  }

  /** Enables or disables the buttons currently on screen (a re-render replaces them). */
  private setBusy(busy: boolean): void {
    byId('modalBody').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.disabled = busy);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.setBusy(true);
    byId('closeModal').hidden = true;
    const modal = byId<HTMLDialogElement>('modal');
    const preventClose = (event: Event): void => event.preventDefault();
    modal.addEventListener('cancel', preventClose);
    try { await action(); }
    catch (error) {
      if (this.pendingUser) {
        // The merge failed after the server signed us in: show the form again so submitting retries it.
        this.busy = false;
        this.render(null);
        // Keep the typed name, so only the password has to be entered again.
        const field = document.getElementById('accountUsername') as HTMLInputElement | null;
        if (field) field.value = this.retryUsername;
      }
      byId('accountStatus').textContent = t(error instanceof AccountError ? errors[error.code] ?? 'auth.unavailable' : 'auth.unavailable');
      if (error instanceof AccountError && error.code === 'taken') {
        const username = byId<HTMLInputElement>('accountUsername');
        username.setAttribute('aria-invalid', 'true');
        username.setAttribute('aria-describedby', 'accountStatus');
        username.focus();
        username.select();
      }
    } finally {
      this.deps.finished();
      this.busy = false;
      this.setBusy(false);
      byId('closeModal').hidden = false;
      modal.removeEventListener('cancel', preventClose);
    }
  }
}
