import {loadSave} from '../game/save.ts';
import {authenticatedAccount, authApi, validOrigin, usernameKey} from './auth.ts';
import {syncAccountProgress} from './account-progress.ts';
import {absorbGuestScore, retireShadowScores} from './score-cleanup.ts';
import {isPlayerId} from '../game/username.ts';
import {cloudProgress, json, leaderboardApi, PLAYER_HEADER} from './cloud.ts';
import type {AccountStore} from './accounts.ts';
import type {PlayerStore} from './players.ts';
import {DEFAULT_RUNTIME_CONFIG} from '../shared/config.ts';
import type {RuntimeConfig} from '../shared/config.ts';

/** Shared authorization for Vercel and the Node server. No GUID can authorize an account. */
export async function playerApi(request: Request, store: PlayerStore & {accounts: AccountStore},
  config: RuntimeConfig = DEFAULT_RUNTIME_CONFIG): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === '/api/auth') return authApi(request, store.accounts);
  if (!validOrigin(request)) return json({error: 'Invalid origin.'}, 403);
  try {
    const account = await authenticatedAccount(request, store.accounts);
    // Guests never publish: scores and progress writes need a signed-in session, whatever GUID they send.
    if ((path === '/api/score' || path === '/api/progress') && !account) {
      return json({error: 'Sign in required.'}, 401);
    }
    if (path === '/api/account') {
      if (!account) return json({error: 'Sign in required.'}, 401);
      if (request.method !== 'PUT') return json({error: 'Invalid method.'}, 405);
      const input = await readInput(request);
      const save = input?.save as {owned?: unknown; coins?: unknown} | undefined;
      if (!save || !Array.isArray(save.owned) || !Number.isFinite(save.coins)) return json({error: 'Invalid progress.'}, 400);
      const sourceId = (input!.save as {playerId?: unknown}).playerId;
      if (typeof sourceId === 'string' && sourceId !== account.id && await store.accounts.findId(sourceId)) {
        return json({error: 'Cannot merge another account.'}, 403);
      }
      const merged = await syncAccountProgress(store, account, input!.save);
      // This device's guest GUID is retired: its ranking row now lives on the account only.
      if (typeof sourceId === 'string' && sourceId !== account.id && isPlayerId(sourceId)) {
        await absorbGuestScore(store, account.id, account.username, sourceId);
      }
      return json({save: loadSave({getItem: () => JSON.stringify(merged)}, config)});
    }
    let input: Record<string, unknown> | null = null;
    if (request.method === 'POST' || request.method === 'PUT') {
      input = await readInput(request.clone());
      if (!input) return json({error: 'Invalid request.'}, 400);
    }
    const requested = path === '/api/score' ? input?.playerId : request.headers.get(PLAYER_HEADER);
    if (typeof requested === 'string') {
      const owner = await store.accounts.findId(requested);
      if (owner && owner.id !== account?.id) return json({error: 'Sign in required.'}, 401);
    }
    const headers = new Headers(request.headers);
    // Only the session decides which row is "mine"; a header sent by a guest is ignored.
    if (path === '/api/leaderboard') {
      headers.delete(PLAYER_HEADER);
      if (account) headers.set(PLAYER_HEADER, account.id);
    }
    if (account && requested === account.id) {
      if (input && path === '/api/score') input.username = account.username;
      if (input?.save && typeof input.save === 'object') {
        input.save = {...input.save, playerId: account.id, username: account.username};
      }
    } else if (input) {
      // Guest display names cannot impersonate a registered account on new submissions.
      const name = path === '/api/score' ? input.username : (input.save as {username?: unknown} | undefined)?.username;
      if (typeof name === 'string' && await store.accounts.findUsername(usernameKey(name))) {
        return json({error: 'Username is reserved.'}, 409);
      }
    }
    // Reading the ranking also retires duplicate guest rows left from before signup (rate-limited).
    if (path === '/api/leaderboard') await retireShadowScores(store, store.accounts).catch(() => 0);
    const forwarded = new Request(request.url, {method: request.method, headers,
      ...(input ? {body: JSON.stringify(input)} : {})});
    if (path === '/api/progress') {
      const response = await cloudProgress(forwarded, store, config);
      if (response.ok && request.method === 'PUT' && account && requested === account.id) {
        await syncAccountProgress(store, account, input!.save);
      }
      return response;
    }
    return await leaderboardApi(forwarded, store);
  } catch {
    return json({error: 'Online storage is unavailable.'}, 503);
  }
}

async function readInput(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > 16000) return null;
  try {
    const input: unknown = JSON.parse(text);
    return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
  } catch { return null; }
}
