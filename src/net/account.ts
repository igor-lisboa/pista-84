import {defaultSave, loadSave, SAVE_KEY} from '../game/save.ts';
import type {SaveData} from '../game/save.ts';
import {isPlayerId, normalizeUsername} from '../game/username.ts';

export const ACCOUNT_KEY = 'pista84.account';
export interface AccountIdentity {id: string; username: string}

export class AccountError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export function localAccount(): AccountIdentity | null {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null') as Partial<AccountIdentity> | null;
    return raw && isPlayerId(raw.id) && normalizeUsername(raw.username) ? raw as AccountIdentity : null;
  } catch { return null; }
}

export async function accountRequest(path: string, body?: unknown): Promise<Record<string, unknown>> {
  try {
    const action = body && typeof body === 'object' && 'action' in body ? body.action : null;
    if ((action === 'login' || action === 'signup') && location.protocol !== 'https:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new AccountError('secure');
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : path === '/api/account' ? 'PUT' : 'POST',
      credentials: 'same-origin',
      headers: {'content-type': 'application/json'},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new AccountError(typeof data.code === 'string' ? data.code : 'unavailable');
    return data;
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError('unavailable');
  }
}

export async function mergeAccount(save: SaveData): Promise<SaveData> {
  const data = await accountRequest('/api/account', {save});
  if (!data.save || typeof data.save !== 'object') throw new AccountError('unavailable');
  return loadSave({getItem: () => JSON.stringify(data.save)});
}

/** Clear every game record; device preferences may carry over into a new guest. */
export function clearAccountDevice(previous: SaveData): void {
  const fresh = defaultSave();
  fresh.lang = previous.lang;
  fresh.sound = previous.sound;
  fresh.units = previous.units;
  for (const key of Object.keys(localStorage)) {
    if (key === SAVE_KEY || key.startsWith('pista84.')) localStorage.removeItem(key);
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
}
