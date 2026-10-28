import {isPlayerId} from '../game/username.ts';
import {loadSave} from '../game/save.ts';
import {DEFAULT_RUNTIME_CONFIG} from '../shared/config.ts';
import type {RuntimeConfig} from '../shared/config.ts';
import {StoreFullError, leaderboardPage, readBackup, submitScore, writeBackup} from './players.ts';
import type {PlayerStore} from './players.ts';

/** Header carrying the caller's permanent GUID; it is the key of their record. */
export const PLAYER_HEADER = 'x-player-id';
const MAX_BODY = 16_000;

interface ProgressUpload {
  revision: number;
  save: {owned: unknown[]; coins: number};
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json', 'cache-control': 'no-store'},
  });
}

function isValidUpload(body: Partial<ProgressUpload> | null): body is ProgressUpload {
  return (
    !!body &&
    Number.isInteger(body.revision) &&
    (body.revision as number) >= 0 &&
    !!body.save &&
    Array.isArray(body.save.owned) &&
    Number.isFinite(body.save.coins)
  );
}

/** Rejects cross-site browser calls; same-origin and non-browser clients pass. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request: Request): Promise<{ok: true; body: unknown} | {ok: false; response: Response}> {
  const text = await request.text();
  if (text.length > MAX_BODY) return {ok: false, response: json({error: 'File too large.'}, 413)};
  try {
    return {ok: true, body: JSON.parse(text)};
  } catch {
    return {ok: false, response: json({error: 'Invalid JSON.'}, 400)};
  }
}

/**
 * Runs a store operation. A full store is a clear 507 and any other failure
 * (Blob unreachable, bad token) is a 503: clients play on with local
 * data and retry later, so the error must never escape as a crash.
 */
async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof StoreFullError) return json({error: error.message}, 507);
    // The player only sees a generic message; the operator needs the real cause in the logs.
    console.error('[online storage]', error);
    return json({error: 'Online storage is unavailable. Your progress stays on this device.'}, 503);
  }
}

/** `GET`/`PUT /api/progress`: the cloud backup, keyed by the caller's GUID. */
export async function cloudProgress(
  request: Request,
  store: PlayerStore,
  config: RuntimeConfig = DEFAULT_RUNTIME_CONFIG,
): Promise<Response> {
  const playerId = request.headers.get(PLAYER_HEADER);
  if (!isPlayerId(playerId)) return json({error: 'Missing player id.'}, 401);
  if (!sameOrigin(request)) return json({error: 'Invalid origin.'}, 403);

  if (request.method === 'GET') {
    return guarded(async () => {
      const {save, revision} = await readBackup(store, playerId);
      if (!save) return json({save: null, revision});
      const capped = loadSave({getItem: () => JSON.stringify(save)}, config);
      return json({save: capped, revision});
    });
  }
  if (request.method !== 'PUT') return json({error: 'Invalid method.'}, 405);

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as Partial<ProgressUpload> | null;
  if (!isValidUpload(body)) return json({error: 'Invalid progress.'}, 400);
  return guarded(async () => {
    const result = await writeBackup(store, playerId, body.save, body.revision);
    if (!result) {
      return json({error: 'The backup changed on another device. Load the current version before saving.'}, 409);
    }
    return json(result);
  });
}

/**
 * `GET /api/leaderboard?page=1&size=5` (one page of the ranking; `x-player-id`
 * is optional and only marks the caller's own row) and `POST /api/score` (a finished run).
 */
export async function leaderboardApi(request: Request, store: PlayerStore): Promise<Response> {
  const {pathname} = new URL(request.url);
  if (pathname === '/api/leaderboard') {
    if (request.method !== 'GET') return json({error: 'Invalid method.'}, 405);
    const params = new URL(request.url).searchParams;
    const caller = request.headers.get(PLAYER_HEADER);
    return guarded(async () =>
      json(
        await leaderboardPage(store, {
          page: Number(params.get('page')),
          size: Number(params.get('size')),
          playerId: isPlayerId(caller) ? caller : null,
        }),
      ),
    );
  }
  if (pathname === '/api/score') {
    if (request.method !== 'POST') return json({error: 'Invalid method.'}, 405);
    if (!sameOrigin(request)) return json({error: 'Invalid origin.'}, 403);
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const input = (parsed.body ?? {}) as Record<string, unknown>;
    return guarded(async () => {
      const result = await submitScore(store, {
        playerId: input.playerId,
        username: input.username,
        score: input.score,
        distance: input.distance,
      });
      return result ? json(result) : json({error: 'Invalid score.'}, 400);
    });
  }
  return json({error: 'Not found.'}, 404);
}

/** What `/health` reports about online storage. */
export const onlineHealth = (store: PlayerStore | null): {ok: true; cloudBackup: boolean} => ({
  ok: true,
  cloudBackup: store !== null,
});

/** Used when no storage is configured. */
export const storageUnavailable = (): Response => json({error: 'Online storage is not configured.'}, 503);
