import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {normalizeUsername} from '../game/username.ts';
import {accountUser} from './accounts.ts';
import type {Account, AccountStore} from './accounts.ts';
import {json} from './cloud.ts';
import {DUMMY_PASSWORD, hashPassword, validPassword, verifyPassword} from './passwords.ts';

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const COOKIE = 'pista84-session';
export const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

export function usernameKey(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

export function validOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return request.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || origin === new URL(request.url).origin);
}

function sessionToken(request: Request): string | null {
  const name = new URL(request.url).protocol === 'https:' ? `__Host-${COOKIE}` : COOKIE;
  const value = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function cookie(request: Request, token: string, age: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${secure ? '__Host-' : ''}${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
}

export async function authenticatedAccount(request: Request, store: AccountStore): Promise<Account | null> {
  const token = sessionToken(request);
  return token ? store.session(digest(token), new Date()) : null;
}

async function signedIn(request: Request, store: AccountStore, account: Account): Promise<Response> {
  const token = randomBytes(32).toString('hex');
  await store.createSession(digest(token), account.id, new Date(Date.now() + SESSION_SECONDS * 1000));
  // Rotate any prior session on this device; never use a caller-supplied session ID.
  const previous = sessionToken(request);
  if (previous) await store.deleteSession(digest(previous));
  const response = json({user: accountUser(account)});
  response.headers.set('set-cookie', cookie(request, token, SESSION_SECONDS));
  return response;
}

/** Replaces the password of the signed-in account after re-checking the current one. */
async function changePassword(request: Request, store: AccountStore, input: Record<string, unknown>): Promise<Response> {
  const account = await authenticatedAccount(request, store);
  if (!account) return json({error: 'Sign in again.', code: 'session'}, 401);
  if (!validPassword(input.password) || !validPassword(input.newPassword)) {
    return json({error: 'Invalid password.', code: 'invalid'}, 400);
  }
  // Guessing the current password through this route shares the login budget of the account.
  const now = Date.now();
  if (!await store.consumeAttempt('global', 300, 60_000, now) ||
    !await store.consumeAttempt(digest(account.usernameKey), 10, 15 * 60_000, now)) {
    const response = json({error: 'Too many attempts. Try again later.', code: 'limited'}, 429);
    response.headers.set('retry-after', '900');
    return response;
  }
  if (!await verifyPassword(input.password, account.passwordHash)) {
    return json({error: 'Incorrect password.', code: 'credentials'}, 401);
  }
  await store.updatePasswordHash(account.id, await hashPassword(input.newPassword));
  // Every other device must sign in again with the new password; this one gets a fresh session.
  await store.deleteAccountSessions(account.id);
  return await signedIn(request, store, account);
}

/** Credentials never leave this Node-only path or enter logs or browser storage. */
export async function authApi(request: Request, store: AccountStore): Promise<Response> {
  if (!validOrigin(request)) return json({error: 'Invalid origin.', code: 'origin'}, 403);
  if (process.env.NODE_ENV === 'production' && new URL(request.url).protocol !== 'https:') {
    return json({error: 'HTTPS is required.', code: 'secure'}, 400);
  }
  try {
    if (request.method === 'GET') {
      const account = await authenticatedAccount(request, store);
      return json({user: account ? accountUser(account) : null});
    }
    if (request.method !== 'POST') return json({error: 'Invalid method.'}, 405);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
      return json({error: 'JSON is required.', code: 'invalid'}, 415);
    }
    const text = await request.text();
    if (text.length > 4000) return json({error: 'File too large.', code: 'invalid'}, 413);
    let input: Record<string, unknown>;
    try {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JSON.');
      input = value as Record<string, unknown>;
    } catch { return json({error: 'Invalid JSON.', code: 'invalid'}, 400); }
    if (input.action === 'logout') {
      const token = sessionToken(request);
      if (token) await store.deleteSession(digest(token));
      const response = json({ok: true});
      response.headers.set('set-cookie', cookie(request, '', 0));
      return response;
    }
    if (input.action === 'password') return await changePassword(request, store, input);
    if (input.action !== 'login' && input.action !== 'signup') return json({error: 'Invalid action.', code: 'invalid'}, 400);
    const name = typeof input.username === 'string' ? normalizeUsername(input.username.normalize('NFKC')) : null;
    if (!name || !validPassword(input.password)) return json({error: 'Invalid username or password.', code: 'invalid'}, 400);
    const key = usernameKey(name);
    const now = Date.now();
    // Persistent budgets limit both guessing one account and expensive hashing across names.
    if (!await store.consumeAttempt('global', 300, 60_000, now) ||
      !await store.consumeAttempt(digest(key), 10, 15 * 60_000, now)) {
      const response = json({error: 'Too many attempts. Try again later.', code: 'limited'}, 429);
      response.headers.set('retry-after', '900');
      return response;
    }
    const existing = await store.findUsername(key);
    if (input.action === 'login') {
      const verified = await verifyPassword(input.password, existing?.passwordHash ?? DUMMY_PASSWORD);
      if (!existing || !verified) return json({error: 'Invalid username or password.', code: 'credentials'}, 401);
      return await signedIn(request, store, existing);
    }
    // Hash before resolving a duplicate so registration does not create a fast timing oracle.
    const passwordHash = await hashPassword(input.password);
    const account: Account = {id: randomUUID(), username: name, usernameKey: key, passwordHash, createdAt: now};
    if (existing || !await store.create(account)) return json({error: 'Username is unavailable.', code: 'taken'}, 409);
    return await signedIn(request, store, account);
  } catch {
    return json({error: 'Account storage is unavailable.', code: 'unavailable'}, 503);
  }
}
