import { t } from '../i18n/index.ts';
import { byId } from './dom.ts';

export type AuthMode = 'signup' | 'login';

const MODES: readonly AuthMode[] = ['signup', 'login'];

/** Two-way switch between creating an account and logging in; the selected side is highlighted. */
export function authTabs(prefix: string, mode: AuthMode): string {
  const buttons = MODES.map((value) => {
    const selected = value === mode;
    return `<button id="${prefix}Tab-${value}" class="auth-tab${selected ? ' active' : ''}" type="button" aria-pressed="${selected}"><span>${t(value === 'signup' ? 'auth.signup' : 'auth.login')}</span></button>`;
  }).join('');
  return `<div class="auth-tabs" role="group" aria-label="${t('auth.account')}">${buttons}</div>`;
}

/** Calls `select` when the player taps the side that is not already selected. */
export function bindAuthTabs(prefix: string, mode: AuthMode, select: (mode: AuthMode) => void): void {
  for (const value of MODES) {
    if (value !== mode) byId(`${prefix}Tab-${value}`).onclick = () => select(value);
  }
}

/** Disables every button inside `root` and shows a "please wait" label on its submit button. */
export function setFormBusy(root: HTMLElement, busy: boolean): void {
  root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => (button.disabled = busy));
  root.querySelector('form')?.setAttribute('aria-busy', String(busy));
  const label = root.querySelector<HTMLElement>('button[type=submit] > span');
  if (!label) return;
  if (busy && label.dataset.idle === undefined) {
    label.dataset.idle = label.textContent ?? '';
    label.textContent = t('auth.wait');
  } else if (!busy && label.dataset.idle !== undefined) {
    label.textContent = label.dataset.idle;
    delete label.dataset.idle;
  }
}
