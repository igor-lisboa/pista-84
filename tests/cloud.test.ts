import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloudProgress, leaderboardApi} from '../src/server/cloud.ts';
import {importSave, loadSave} from '../src/game/index.ts';
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
    read: () => Promise.reject(new Error('Global Config unreachable')),
    update: () => Promise.reject(new Error('Global Config unreachable')),
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
