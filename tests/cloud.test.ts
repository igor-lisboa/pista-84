import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloudProgress, leaderboardApi} from '../src/server/cloud.ts';
import {importSave, loadSave, startNewPlayer} from '../src/game/index.ts';
import {memoryPlayerStore} from '../src/server/players.ts';
import type {PlayerStore} from '../src/server/players.ts';

const ALICE = '6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b';
const BOB = '7a2d3b4f-8c5e-4f60-9b8c-1d2e3f4a5b6c';

function progressRequest(playerId: string | null, method = 'GET', body?: unknown): Request {
  return new Request('https://pista.test/api/progress', {
    method,
    headers: {
      origin: 'https://pista.test',
      ...(playerId ? {'x-player-id': playerId} : {}),
    },
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
}

const scoreRequest = (body: unknown): Request =>
  new Request('https://pista.test/api/score', {
    method: 'POST',
    headers: {origin: 'https://pista.test'},
    body: JSON.stringify(body),
  });

const board = async (store: PlayerStore) =>
  (await (await leaderboardApi(new Request('https://pista.test/api/leaderboard'), store)).json()).entries;

test('cloud backups are isolated by player GUID and use optimistic concurrency', async () => {
  const store = memoryPlayerStore();
  const call = (id: string | null, method?: string, body?: unknown, config?: {coins: number | null}) =>
    cloudProgress(progressRequest(id, method, body), store, config);
  const snapshot = {coins: 123, owned: ['fusca', 'gol'], selected: 'gol', best: 500};

  assert.equal((await call(null)).status, 401);
  assert.equal((await call('not-a-guid')).status, 401);
  assert.equal((await call(ALICE, 'PUT', {save: snapshot, revision: 0})).status, 200);
  assert.equal((await call(ALICE, 'PUT', {save: snapshot, revision: 0})).status, 409);

  const alice = await (await call(ALICE)).json();
  assert.equal(alice.save.coins, 123);
  assert.equal(alice.save.selected, 'gol');
  assert.equal(alice.save.playerId, ALICE);
  assert.equal(alice.revision, 1);

  assert.equal((await (await call(BOB)).json()).save, null);

  assert.equal((await call(ALICE, 'PUT', {save: {...snapshot, coins: 150}, revision: 1})).status, 200);
  assert.equal((await call(ALICE, 'PUT', {save: snapshot, revision: 1})).status, 409);
  assert.equal((await (await call(ALICE)).json()).save.coins, 150);

  const overridden = await (await call(ALICE, 'GET', undefined, {coins: 10000})).json();
  assert.equal(overridden.save.coins, 10000);
  assert.equal((await (await call(ALICE)).json()).save.coins, 150);
});

test('a backup cannot claim another player GUID', async () => {
  const store = memoryPlayerStore();
  const forged = {coins: 1, owned: ['fusca'], playerId: BOB, username: 'Mallory'};
  await cloudProgress(progressRequest(ALICE, 'PUT', {save: forged, revision: 0}), store);
  assert.equal((await (await cloudProgress(progressRequest(BOB), store)).json()).save, null);
  assert.equal((await (await cloudProgress(progressRequest(ALICE), store)).json()).save.playerId, ALICE);
});

test('the leaderboard ranks by best score and a rename keeps the score', async () => {
  const store = memoryPlayerStore();
  const submit = (playerId: string, username: string, score: number) =>
    leaderboardApi(scoreRequest({playerId, username, score, distance: score / 10}), store);

  assert.equal((await submit(ALICE, 'Alice', 500)).status, 200);
  assert.equal((await submit(BOB, 'Bob', 900)).status, 200);
  assert.deepEqual((await board(store)).map((entry: {name: string}) => entry.name), ['Bob', 'Alice']);

  // A lower score never replaces the best one; a new name replaces the old one.
  await submit(ALICE, 'AliceRenamed', 100);
  const entries = await board(store);
  assert.deepEqual(entries.map((entry: {name: string; score: number}) => [entry.name, entry.score]), [
    ['Bob', 900],
    ['AliceRenamed', 500],
  ]);
  assert.ok(entries.every((entry: Record<string, unknown>) => !('playerId' in entry) && !JSON.stringify(entry).includes(ALICE)));

  for (const bad of [
    {playerId: 'nope', username: 'Alice', score: 1, distance: 1},
    {playerId: ALICE, username: 'x', score: 1, distance: 1},
    {playerId: ALICE, username: 'Alice', score: -1, distance: 1},
    {playerId: ALICE, username: 'Alice', score: 'lots', distance: 1},
  ]) {
    assert.equal((await leaderboardApi(scoreRequest(bad), store)).status, 400);
  }
});

test('a failing store answers 503 instead of crashing, so clients keep playing offline', async () => {
  const broken: PlayerStore = {
    read: () => Promise.reject(new Error('Blob unreachable')),
    update: () => Promise.reject(new Error('Blob unreachable')),
  };
  assert.equal((await leaderboardApi(new Request('https://pista.test/api/leaderboard'), broken)).status, 503);
  assert.equal((await leaderboardApi(scoreRequest({playerId: ALICE, username: 'Alice', score: 5, distance: 1}), broken)).status, 503);
  assert.equal((await cloudProgress(progressRequest(ALICE), broken)).status, 503);
});

test('importing replaces everything, but keeps the highest score for the same GUID', () => {
  const current = {...loadSave({getItem: () => JSON.stringify({playerId: ALICE, username: 'Alice', bestScore: 900, best: 800, coins: 5})})};

  // Same GUID: progress is replaced, the better score and distance survive, the name follows the file.
  const same = importSave(current, JSON.stringify({playerId: ALICE, username: 'OldAlice', bestScore: 300, best: 1200, coins: 50}));
  assert.equal(same.coins, 50);
  assert.equal(same.username, 'OldAlice');
  assert.equal(same.bestScore, 900);
  assert.equal(same.best, 1200);

  // Different GUID: a different player, so identity and scores are taken wholesale.
  const other = importSave(current, JSON.stringify({playerId: BOB, username: 'Bob', bestScore: 100, best: 10, coins: 7}));
  assert.equal(other.playerId, BOB);
  assert.equal(other.username, 'Bob');
  assert.equal(other.bestScore, 100);

  // A legacy export without identity keeps the current one.
  const legacy = importSave(current, JSON.stringify({coins: 9, bestScore: 20}));
  assert.equal(legacy.playerId, ALICE);
  assert.equal(legacy.username, 'Alice');
  assert.equal(legacy.bestScore, 900);
  assert.equal(legacy.coins, 9);
});

test('starting a new player gets a fresh GUID and garage but keeps device preferences and history', () => {
  const current = loadSave({
    getItem: () => JSON.stringify({playerId: ALICE, username: 'Alice', bestScore: 900, best: 800, coins: 500, owned: ['fusca', 'gol'], lang: 'ja', sound: false}),
  });
  const fresh = startNewPlayer(current, {coins: null}, 1234);

  assert.notEqual(fresh.playerId, ALICE);
  assert.equal(fresh.username, null);
  assert.equal(fresh.coins, 0);
  assert.equal(fresh.bestScore, 0);
  assert.deepEqual(fresh.owned, ['fusca']);
  assert.equal(fresh.lang, 'ja');
  assert.equal(fresh.sound, false);
  assert.deepEqual(fresh.history, [{playerId: ALICE, username: 'Alice', bestScore: 900, best: 800, retired: 1234}]);

  // History survives a save round trip and accumulates; an empty, nameless player is not recorded.
  const reloaded = loadSave({getItem: () => JSON.stringify(fresh)});
  assert.equal(reloaded.history.length, 1);
  assert.equal(startNewPlayer(reloaded, {coins: null}).history.length, 1);
  const named = {...reloaded, username: 'Bob'};
  assert.equal(startNewPlayer(named, {coins: null}).history.length, 2);
});

test('the leaderboard is served in pages of five, sorted, with ties going to whoever got there first', async () => {
  const store = memoryPlayerStore();
  const ids = Array.from({length: 7}, (_, i) => `6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5${i}`);
  const submit = (playerId: string, score: number) =>
    leaderboardApi(scoreRequest({playerId, username: `Driver${playerId.slice(-1)}`, score, distance: 100}), store);
  for (const [i, id] of ids.entries()) await submit(id, 100 + i * 10); // driver 6 leads
  await submit(ids[0]!, 160); // ties driver 6, but arrived later

  const page = async (n: number, caller?: string) =>
    (await leaderboardApi(new Request(`https://pista.test/api/leaderboard?page=${n}`, {headers: caller ? {'x-player-id': caller} : {}}), store)).json();

  const first = await page(1, ids[2]);
  assert.equal(first.size, 5);
  assert.equal(first.total, 7);
  assert.equal(first.pages, 2);
  assert.deepEqual(first.entries.map((e: {name: string}) => e.name), ['Driver6', 'Driver0', 'Driver5', 'Driver4', 'Driver3']);
  assert.deepEqual(first.entries.map((e: {rank: number}) => e.rank), [1, 2, 3, 4, 5]);
  assert.ok(first.entries.every((e: {mine: boolean}) => !e.mine));

  const second = await page(2, ids[2]);
  assert.deepEqual(second.entries.map((e: {name: string; mine: boolean}) => [e.name, e.mine]), [['Driver2', true], ['Driver1', false]]);
  assert.equal(second.entries[0].rank, 6);

  // Out-of-range and junk pages are clamped instead of failing.
  assert.equal((await page(99)).page, 2);
  assert.equal((await page(-3)).page, 1);
  assert.equal((await (await leaderboardApi(new Request('https://pista.test/api/leaderboard?page=x&size=abc'), store)).json()).size, 5);
});

test('the ranking is kept as a compact sorted list apart from the heavy backups', async () => {
  const store = memoryPlayerStore();
  await leaderboardApi(scoreRequest({playerId: ALICE, username: 'Alice', score: 500, distance: 50}), store);
  const rows = await store.read<unknown[][]>('scores', []);
  assert.deepEqual(rows.map((row) => row.slice(0, 4)), [[ALICE, 'Alice', 500, 50]]);
  assert.deepEqual(await store.read('backups', {}), {});

  await cloudProgress(progressRequest(ALICE, 'PUT', {save: {coins: 1, owned: ['fusca'], username: 'Alice', bestScore: 900}, revision: 0}), store);
  assert.equal(Object.keys(await store.read('backups', {})).length, 1);
  // Restoring a backup with a higher score publishes it to the ranking.
  assert.equal((await store.read<unknown[][]>('scores', []))[0]![2], 900);
});

test('rows and backups carry created and updated times that only move when data changes', async () => {
  const store = memoryPlayerStore();
  const submit = (score: number, name = 'Alice') =>
    leaderboardApi(scoreRequest({playerId: ALICE, username: name, score, distance: 50}), store);
  const row = async () => (await store.read<number[][]>('scores', []))[0] as unknown as [string, string, number, number, number, number, number];

  await submit(500);
  const first = await row();
  assert.ok(first[5] > 0 && first[6] >= first[5]);

  await new Promise((resolve) => setTimeout(resolve, 5));
  await submit(500); // identical resubmission: nothing changes
  assert.deepEqual(await row(), first);

  await submit(700);
  const better = await row();
  assert.equal(better[5], first[5], 'created never moves');
  assert.ok(better[6] > first[6] && better[4] > first[4]);

  await new Promise((resolve) => setTimeout(resolve, 5));
  await submit(100, 'AliceRenamed'); // rename only: updated moves, the score clock does not
  const renamed = await row();
  assert.equal(renamed[1], 'AliceRenamed');
  assert.equal(renamed[4], better[4]);
  assert.ok(renamed[6] > better[6]);

  const save = {coins: 1, owned: ['fusca'], username: 'Alice'};
  await cloudProgress(progressRequest(ALICE, 'PUT', {save, revision: 0}), store);
  const [firstBackup] = Object.values(await store.read<Record<string, {created: number; updated: number}>>('backups', {}));
  await new Promise((resolve) => setTimeout(resolve, 5));
  await cloudProgress(progressRequest(ALICE, 'PUT', {save, revision: 1}), store);
  const [secondBackup] = Object.values(await store.read<Record<string, {created: number; updated: number}>>('backups', {}));
  assert.equal(secondBackup!.created, firstBackup!.created);
  assert.ok(secondBackup!.updated > firstBackup!.updated);
});
