import {loadSave} from '../game/save.ts';
import {DEFAULT_RUNTIME_CONFIG} from '../shared/config.ts';
import type {RuntimeConfig} from '../shared/config.ts';
import type {D1Like} from './d1.ts';

const USER_HEADER = 'oai-authenticated-user-id';
const MAX_SAVE_BODY = 16_000;

interface ProgressRow {
  data: string;
  revision: number;
  updated: number;
}

interface ProgressUpload {
  revision: number;
  save: {owned: unknown[]; coins: number};
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json', 'cache-control': 'no-store'},
  });
}

function storageOf(text: string): {getItem: () => string} {
  return {getItem: () => text};
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

async function readProgress(
  user: string,
  db: D1Like,
  config: RuntimeConfig,
): Promise<Response> {
  const row = await db
    .prepare('SELECT data, revision, updated FROM player_progress WHERE user_id = ?')
    .bind(user)
    .first<ProgressRow>();
  if (!row) {
    return json({save: null, revision: 0});
  }
  return json({save: loadSave(storageOf(row.data), config), revision: row.revision, updated: row.updated});
}

async function writeProgress(user: string, db: D1Like, body: ProgressUpload): Promise<Response> {
  const save = loadSave(storageOf(JSON.stringify(body.save)));
  const updated = Date.now();
  const data = JSON.stringify(save);
  const result =
    body.revision === 0
      ? await db
          .prepare('INSERT OR IGNORE INTO player_progress (user_id, data, revision, updated) VALUES (?, ?, 1, ?)')
          .bind(user, data, updated)
          .run()
      : await db
          .prepare(
            'UPDATE player_progress SET data = ?, revision = revision + 1, updated = ? WHERE user_id = ? AND revision = ?',
          )
          .bind(data, updated, user, body.revision)
          .run();
  if (result.meta.changes !== 1) {
    return json({error: 'The backup changed on another device. Load the current version before saving.'}, 409);
  }
  return json({revision: body.revision + 1, updated});
}

async function handlePut(request: Request, user: string, db: D1Like): Promise<Response> {
  try {
    const text = await request.text();
    if (text.length > MAX_SAVE_BODY) {
      return json({error: 'File too large.'}, 413);
    }
    const body = JSON.parse(text) as Partial<ProgressUpload> | null;
    if (!isValidUpload(body)) {
      return json({error: 'Invalid progress.'}, 400);
    }
    return await writeProgress(user, db, body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json({error: 'Invalid JSON.'}, 400);
    }
    throw error;
  }
}

export async function cloudProgress(
  request: Request,
  db: D1Like,
  config: RuntimeConfig = DEFAULT_RUNTIME_CONFIG,
): Promise<Response> {
  const user = request.headers.get(USER_HEADER);
  if (!user) {
    return json({error: 'Sign in to use cloud backup.'}, 401);
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({error: 'Invalid origin.'}, 403);
  }
  if (request.method === 'GET') {
    return readProgress(user, db, config);
  }
  if (request.method !== 'PUT') {
    return json({error: 'Invalid method.'}, 405);
  }
  return handlePut(request, user, db);
}
