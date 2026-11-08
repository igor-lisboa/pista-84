import assert from 'node:assert/strict';
import {test} from 'node:test';
import {authApi, authenticatedAccount, digest, usernameKey} from '../src/server/auth.ts';
import {hashPassword, verifyPassword} from '../src/server/passwords.ts';
import {playerApi} from '../src/server/player-api.ts';
import {readBackup, writeBackup} from '../src/server/players.ts';
import {defaultSave} from '../src/game/save.ts';
import {memoryAccountStore} from './support/memory-account-store.ts';
import {memoryPlayerStore} from './support/memory-player-store.ts';

const password = 'a long unique test passphrase';
function request(path: string, body?: unknown, cookie?: string, origin = 'https://game.test'): Request {
  return new Request(`https://game.test${path}`, {
    method: body === undefined ? 'GET' : path === '/api/account' || path.startsWith('/api/progress') ? 'PUT' : 'POST',
    headers: {'content-type': 'application/json', origin, ...(cookie ? {cookie} : {})},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
}
const cookieOf = (response: Response): string => response.headers.get('set-cookie')!.split(';')[0]!;

test('passwords have independent salts, bounded work parameters and constant-time comparison', async () => {
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect passphrase', first), false);
  assert.equal(await verifyPassword(password, first.replace('131072', '999999999')), false);
});

test('signup atomically reserves normalized usernames and never returns a password hash', async () => {
  const accounts = memoryAccountStore();
  const first = await authApi(request('/api/auth', {action: 'signup', username: 'Driver', password}), accounts);
  assert.equal(first.status, 200);
  const text = await first.text();
  assert.equal(text.includes('scrypt'), false);
  assert.equal(text.includes(password), false);
  const cookie = first.headers.get('set-cookie')!;
  for (const flag of ['__Host-pista84-session=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(flag));
  const duplicate = await authApi(request('/api/auth', {action: 'signup', username: 'ＤＲＩＶＥＲ', password}), accounts);
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, 'taken');
  assert.equal(usernameKey('  ＤＲＩＶＥＲ '), 'driver');
});

test('simultaneous signups with the same normalized username create only one account', async () => {
  const accounts = memoryAccountStore();
  const responses = await Promise.all(['Driver', 'driver'].map(username =>
    authApi(request('/api/auth', {action: 'signup', username, password}), accounts)));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const duplicate = responses.find(response => response.status === 409)!;
  assert.equal((await duplicate.json()).code, 'taken');
  assert.equal(duplicate.headers.has('set-cookie'), false);
});

test('login rotates the session and logout revokes the server record', async () => {
  const accounts = memoryAccountStore();
  const signup = await authApi(request('/api/auth', {action: 'signup', username: 'Driver', password}), accounts);
  const firstCookie = cookieOf(signup);
  const bad = await authApi(request('/api/auth', {action: 'login', username: 'Driver', password: 'the wrong password value'}), accounts);
  const unknown = await authApi(request('/api/auth', {action: 'login', username: 'Unknown', password}), accounts);
  assert.equal(bad.status, 401);
  assert.deepEqual(await bad.json(), await unknown.json());
  const login = await authApi(request('/api/auth', {action: 'login', username: 'DRIVER', password}, firstCookie), accounts);
  const secondCookie = cookieOf(login);
  assert.notEqual(firstCookie, secondCookie);
  assert.equal(await authenticatedAccount(request('/api/auth', undefined, firstCookie), accounts), null);
  assert.ok(await authenticatedAccount(request('/api/auth', undefined, secondCookie), accounts));
  const logout = await authApi(request('/api/auth', {action: 'logout'}, secondCookie), accounts);
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get('set-cookie')!.includes('Max-Age=0'));
  assert.equal(await authenticatedAccount(request('/api/auth', undefined, secondCookie), accounts), null);
});

test('expired sessions are rejected even before MongoDB TTL cleanup', async () => {
  const accounts = memoryAccountStore();
  const account = {id: crypto.randomUUID(), username: 'Driver', usernameKey: 'driver', passwordHash: 'unused', createdAt: Date.now()};
  await accounts.create(account);
  const token = 'a'.repeat(64);
  await accounts.createSession(digest(token), account.id, new Date(Date.now() - 1));
  assert.equal(await authenticatedAccount(request('/api/auth', undefined, `__Host-pista84-session=${token}`), accounts), null);
});

test('auth rejects cross-site requests, malformed input and short passwords', async () => {
  const accounts = memoryAccountStore();
  assert.equal((await authApi(request('/api/auth', {action: 'signup', username: 'Driver', password}, undefined, 'https://evil.test'), accounts)).status, 403);
  assert.equal((await authApi(request('/api/auth', {action: 'signup', username: 'Driver', password: 'short'}), accounts)).status, 400);
  assert.equal((await authApi(request('/api/auth', []), accounts)).status, 400);
  assert.equal((await authApi(request('/api/auth', {action: 'nope'}), accounts)).status, 400);
  assert.equal((await authApi(new Request('https://game.test/api/auth', {method: 'POST', body: '{}'}), accounts)).status, 415);
});

test('production rejects account credentials over HTTP', async t => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });
  const response = await authApi(new Request('http://game.test/api/auth', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({action: 'signup', username: 'Driver', password}),
  }), memoryAccountStore());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'HTTPS is required.');
});

test('a shared exhausted budget blocks expensive password derivations and storage failures never succeed', async () => {
  const accounts = memoryAccountStore();
  accounts.consumeAttempt = async () => false;
  const limited = await authApi(request('/api/auth', {action: 'login', username: 'Driver', password}), accounts);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '900');
  accounts.session = async () => { throw new Error('private connection details'); };
  const unavailable = await authApi(request('/api/auth', undefined, `__Host-pista84-session=${'a'.repeat(64)}`), accounts);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.text()).includes('private'), false);
});

test('account progress merges guest data, restores on another device and keeps manual/device backups', async () => {
  const store = {...memoryPlayerStore(), accounts: memoryAccountStore()};
  const signup = await playerApi(request('/api/auth', {action: 'signup', username: 'Driver', password}), store);
  const cookie = cookieOf(signup);
  const {user} = await signup.json() as {user: {id: string}};
  const old = {...defaultSave(1000), bestScore: 100, coins: 500, username: 'Driver'};
  await writeBackup(store, user.id, old, 0);
  const device = crypto.randomUUID();
  await writeBackup(store, user.id, old, 0, device);
  const guest = {...defaultSave(2000), coins: 250, bestScore: 200, best: 1000, owned: ['fusca', 'gol'], paints: ['original', 'scarlet']};
  const sync = await playerApi(request('/api/account', {save: guest}, cookie), store);
  assert.equal(sync.status, 200);
  const {save} = await sync.json() as {save: typeof guest};
  assert.equal(save.playerId, user.id);
  assert.equal(save.username, 'Driver');
  assert.equal(save.bestScore, 200);
  assert.equal(save.coins, 250);
  const replay = await playerApi(request('/api/account', {save: guest}, cookie), store);
  assert.equal((await replay.json()).save.coins, 250, 'lost-response retries do not double coins');
  const otherDevice = {...defaultSave(3000), coins: 50, best: 2000};
  const restored = await playerApi(request('/api/account', {save: otherDevice}, cookie), store);
  const merged = (await restored.json()).save;
  assert.equal(merged.coins, 250);
  assert.equal(merged.bestScore, 200);
  assert.equal(merged.best, 2000);
  assert.ok(merged.owned.includes('gol'));
  assert.equal((await readBackup(store, user.id)).save?.coins, 500);
  assert.equal((await readBackup(store, user.id, device)).save?.coins, 500);
  assert.equal((await playerApi(request('/api/account', {save: guest}), store)).status, 401);
  assert.equal((await playerApi(request('/api/account', {}, cookie), store)).status, 400);
});

test('neither GUID headers nor forged score bodies authorize another account', async () => {
  const store = {...memoryPlayerStore(), accounts: memoryAccountStore()};
  const account = {id: crypto.randomUUID(), username: 'Owner', usernameKey: 'owner', passwordHash: 'unused', createdAt: 1000};
  await store.accounts.create(account);
  const stranger = {id: crypto.randomUUID(), username: 'Other', usernameKey: 'other', passwordHash: 'unused', createdAt: 1000};
  await store.accounts.create(stranger);
  const token = 'b'.repeat(64);
  await store.accounts.createSession(digest(token), stranger.id, new Date(Date.now() + 60000));
  for (const cookie of [undefined, `__Host-pista84-session=${token}`]) {
    const progress = new Request('https://game.test/api/progress', {headers: {'x-player-id': account.id, ...(cookie ? {cookie} : {})}});
    assert.equal((await playerApi(progress, store)).status, 401);
    assert.equal((await playerApi(request('/api/score', {playerId: account.id, username: 'Owner', score: 50, distance: 10}, cookie), store)).status, 401);
  }
  assert.equal((await playerApi(request('/api/account', {save: {...defaultSave(), playerId: account.id}}, `__Host-pista84-session=${token}`), store)).status, 403);
  const guest = defaultSave();
  assert.equal((await playerApi(request('/api/score', {playerId: guest.playerId, username: ' OWNER ', score: 100, distance: 10}), store)).status, 409);
});
