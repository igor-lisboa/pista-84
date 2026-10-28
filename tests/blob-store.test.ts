import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BlobError, BlobPreconditionFailedError} from '@vercel/blob';
import type {GetBlobResult} from '@vercel/blob';
import {blobStore} from '../src/server/blob-store.ts';
import type {BlobApi} from '../src/server/blob-store.ts';
import {cloudProgress, leaderboardApi, onlineHealth} from '../src/server/cloud.ts';

const ENV = {BLOB_STORAGE_READ_WRITE_TOKEN: 'rw-token', BLOB_STORAGE_STORE_ID: 'store_test'};
const ALICE = '6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b';
const BOB = '7a2d3b4f-8c5e-4f60-9b8c-1d2e3f4a5b6c';

interface Call {
  op: 'get' | 'put';
  pathname: string;
  options: Record<string, unknown>;
}

/** An in-memory Blob that enforces the same ETag rules as the real service. */
function fakeBlob(initial: Record<string, string> = {}) {
  const files = new Map<string, {body: string; etag: string}>();
  let version = 0;
  for (const [pathname, body] of Object.entries(initial)) files.set(pathname, {body, etag: `"v${(version += 1)}"`});
  const calls: Call[] = [];
  /** Lets a test run code between a writer's read and its write. */
  const hooks: {afterGet?: () => Promise<void>} = {};

  const api: BlobApi = {
    async get(pathname, options) {
      calls.push({op: 'get', pathname, options: {...options}});
      const file = files.get(pathname);
      if (!file) return null;
      const result = {
        statusCode: 200,
        stream: new Response(file.body).body!,
        headers: new Headers(),
        blob: {etag: file.etag, pathname},
      } as unknown as GetBlobResult;
      await hooks.afterGet?.();
      return result;
    },
    async put(pathname, body, options) {
      calls.push({op: 'put', pathname, options: {...options}});
      const file = files.get(pathname);
      if (file && options.ifMatch === undefined && !options.allowOverwrite) throw new BlobError('This blob already exists');
      if (file && options.ifMatch !== undefined && options.ifMatch !== file.etag) throw new BlobPreconditionFailedError();
      files.set(pathname, {body, etag: `"v${(version += 1)}"`});
      return {pathname};
    },
  };
  return {api, files, calls, hooks, puts: () => calls.filter((call) => call.op === 'put')};
}

const score = (playerId: string, username: string, points: number) =>
  new Request('https://pista.test/api/score', {
    method: 'POST',
    headers: {origin: 'https://pista.test'},
    body: JSON.stringify({playerId, username, score: points, distance: 10}),
  });

test('without a Blob token there is no online store; either token name works', () => {
  assert.equal(blobStore({}), null);
  assert.deepEqual(onlineHealth(null), {ok: true, cloudBackup: false});
  assert.notEqual(blobStore({BLOB_READ_WRITE_TOKEN: 'x'}), null);
  assert.deepEqual(onlineHealth(blobStore(ENV, fakeBlob().api)), {ok: true, cloudBackup: true});
});

test('scores are saved as one private JSON blob and read back', async () => {
  const blob = fakeBlob();
  const store = blobStore(ENV, blob.api, {readCacheMs: 0})!;

  assert.deepEqual(await store.read('scores', []), []);
  assert.equal((await leaderboardApi(score(ALICE, 'Alice', 500), store)).status, 200);

  const put = blob.puts()[0]!;
  assert.equal(put.pathname, 'pista84/scores.json');
  assert.equal(put.options.access, 'private');
  assert.equal(put.options.contentType, 'application/json');
  assert.equal(put.options.token, 'rw-token');
  assert.equal(put.options.storeId, 'store_test');
  assert.equal(put.options.ifMatch, undefined, 'the first write creates the blob');
  assert.equal((JSON.parse(blob.files.get('pista84/scores.json')!.body) as unknown[][])[0]![1], 'Alice');

  const page = await (await leaderboardApi(new Request('https://pista.test/api/leaderboard'), store)).json();
  assert.deepEqual(page.entries.map((e: {name: string; score: number}) => [e.name, e.score]), [['Alice', 500]]);

  // The next change only overwrites the exact version it read.
  await leaderboardApi(score(ALICE, 'Alice', 900), store);
  assert.equal(blob.puts()[1]!.options.ifMatch, '"v1"');
});

test('an unchanged document is never uploaded again', async () => {
  const blob = fakeBlob();
  const store = blobStore(ENV, blob.api, {readCacheMs: 0})!;
  await leaderboardApi(score(ALICE, 'Alice', 500), store);
  await leaderboardApi(score(ALICE, 'Alice', 500), store);
  await leaderboardApi(score(ALICE, 'Alice', 100), store); // lower score, same name: nothing to change
  assert.equal(blob.puts().length, 1);
});

test('two players finishing at the same moment both end up in the ranking', async () => {
  const blob = fakeBlob();
  const store = blobStore(ENV, blob.api, {readCacheMs: 0})!;
  await leaderboardApi(score(ALICE, 'Alice', 100), store);

  // Hold both writers after they read the same version so they genuinely collide.
  let reading = 0;
  let release!: () => void;
  const bothRead = new Promise<void>((resolve) => (release = resolve));
  blob.hooks.afterGet = async () => {
    reading += 1;
    if (reading === 2) release();
    if (reading <= 2) await bothRead;
  };
  const [first, second] = await Promise.all([
    leaderboardApi(score(ALICE, 'Alice', 300), store),
    leaderboardApi(score(BOB, 'Bob', 200), store),
  ]);
  blob.hooks.afterGet = undefined;
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);

  const rows = JSON.parse(blob.files.get('pista84/scores.json')!.body) as [string, string, number][];
  assert.deepEqual(rows.map((row) => [row[1], row[2]]), [['Alice', 300], ['Bob', 200]]);
});

test('two writers racing to create the blob do not lose either score', async () => {
  const blob = fakeBlob();
  const store = blobStore(ENV, blob.api, {readCacheMs: 0})!;
  const [a, b] = await Promise.all([
    leaderboardApi(score(ALICE, 'Alice', 300), store),
    leaderboardApi(score(BOB, 'Bob', 200), store),
  ]);
  assert.equal(a.status + b.status, 400);
  assert.equal((JSON.parse(blob.files.get('pista84/scores.json')!.body) as unknown[]).length, 2);
});

test('reads are cached briefly to spare operations, and writes refresh the cache', async () => {
  const blob = fakeBlob({'pista84/scores.json': JSON.stringify([[ALICE, 'Alice', 500, 10, 1, 1, 1]])});
  let clock = 1_000;
  const store = blobStore(ENV, blob.api, {readCacheMs: 10_000, now: () => clock})!;
  const gets = () => blob.calls.filter((call) => call.op === 'get').length;

  await store.read('scores', []);
  await store.read('scores', []);
  assert.equal(gets(), 1);
  clock += 10_001;
  await store.read('scores', []);
  assert.equal(gets(), 2);

  await leaderboardApi(score(BOB, 'Bob', 900), store);
  const after = gets();
  const rows = await store.read<unknown[][]>('scores', []);
  assert.equal(gets(), after, 'the writer already knows the new document');
  assert.equal(rows.length, 2);
});

test('backups live in their own blob and keep optimistic revisions', async () => {
  const blob = fakeBlob();
  const store = blobStore(ENV, blob.api, {readCacheMs: 0})!;
  const put = (revision: number) =>
    cloudProgress(
      new Request('https://pista.test/api/progress', {
        method: 'PUT',
        headers: {origin: 'https://pista.test', 'x-player-id': ALICE},
        body: JSON.stringify({save: {coins: 5, owned: ['fusca'], username: 'Alice'}, revision}),
      }),
      store,
    );
  assert.equal((await put(0)).status, 200);
  assert.equal((await put(0)).status, 409);
  assert.equal((await put(1)).status, 200);
  assert.ok(blob.files.has('pista84/backups.json'));
  assert.ok(!blob.files.has('pista84/scores.json'), 'a backup without a score does not touch the ranking');
});

test('a full store answers 507 and a failing one 503, both without crashing the request', async () => {
  const blob = fakeBlob();
  const store = blobStore(ENV, blob.api, {readCacheMs: 0})!;

  const broken: BlobApi = {
    get: () => Promise.reject(new Error('network down')),
    put: () => Promise.reject(new Error('network down')),
  };
  const errors: unknown[][] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    const down = blobStore(ENV, broken, {readCacheMs: 0})!;
    assert.equal((await leaderboardApi(new Request('https://pista.test/api/leaderboard'), down)).status, 503);
    assert.equal((await leaderboardApi(score(ALICE, 'Alice', 5), down)).status, 503);
    assert.match(String((errors[0]?.[1] as Error).message), /network down/);
  } finally {
    console.error = log;
  }

  // An absurdly large document is refused up front instead of failing at the service.
  const huge = 'x'.repeat(4_100_000);
  await assert.rejects(
    store.update<string[], void>('scores', [], (doc) => void doc.push(huge)),
    /storage is full/,
  );
});

test('constant write conflicts give up with an error instead of looping forever', async () => {
  const blob = fakeBlob({'pista84/scores.json': '[]'});
  const alwaysBehind: BlobApi = {
    get: blob.api.get,
    put: () => Promise.reject(new BlobPreconditionFailedError()),
  };
  const store = blobStore(ENV, alwaysBehind, {readCacheMs: 0, sleep: async () => undefined})!;
  const errors: unknown[][] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    assert.equal((await leaderboardApi(score(ALICE, 'Alice', 5), store)).status, 503);
    assert.match(String((errors[0]?.[1] as Error).message), /busy/);
    assert.equal(blob.calls.filter((call) => call.op === 'get').length, 8);
  } finally {
    console.error = log;
  }
});

test('the service\'s "conflicting operation" error is retried like a stale ETag', async () => {
  const blob = fakeBlob();
  let failures = 2;
  const flaky: BlobApi = {
    get: blob.api.get,
    put: (pathname, body, options) =>
      failures-- > 0
        ? Promise.reject(new BlobError('Vercel Blob: The conditional request cannot succeed due to a conflicting operation against this resource.'))
        : blob.api.put(pathname, body, options),
  };
  const store = blobStore(ENV, flaky, {readCacheMs: 0, sleep: async () => undefined})!;
  assert.equal((await leaderboardApi(score(ALICE, 'Alice', 5), store)).status, 200);
  assert.equal((JSON.parse(blob.files.get('pista84/scores.json')!.body) as unknown[]).length, 1);
  assert.equal(blob.puts().length, 1);
});

test('an unrelated storage error is not retried', async () => {
  const errors: unknown[][] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    let puts = 0;
    const denied: BlobApi = {
      get: fakeBlob().api.get,
      put: () => {
        puts += 1;
        return Promise.reject(new BlobError('Vercel Blob: Access denied, please provide a valid token'));
      },
    };
    const store = blobStore(ENV, denied, {readCacheMs: 0, sleep: async () => undefined})!;
    assert.equal((await leaderboardApi(score(ALICE, 'Alice', 5), store)).status, 503);
    assert.equal(puts, 1);
  } finally {
    console.error = log;
  }
});
