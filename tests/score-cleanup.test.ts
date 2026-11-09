import {test} from 'node:test';
import assert from 'node:assert/strict';
import {absorbGuestScore, resetScoreCleanupClock, retireShadowScores} from '../src/server/score-cleanup.ts';
import {submitScore} from '../src/server/players.ts';
import {memoryAccountStore} from './support/memory-account-store.ts';
import {memoryPlayerStore} from './support/memory-player-store.ts';

const ACCOUNT = crypto.randomUUID();
const GUEST = crypto.randomUUID();
const OTHER = crypto.randomUUID();

async function setup() {
  const store = memoryPlayerStore();
  const accounts = memoryAccountStore();
  await accounts.create({id: ACCOUNT, username: 'lisboa', usernameKey: 'lisboa', passwordHash: 'unused', createdAt: 1000});
  return {store, accounts};
}

test('a guest row that duplicates an account name and is not better is retired', async () => {
  const {store, accounts} = await setup();
  await submitScore(store, {playerId: ACCOUNT, username: 'lisboa', score: 19360, distance: 8.57});
  await submitScore(store, {playerId: GUEST, username: 'lisboa', score: 19360, distance: 8.57});
  await submitScore(store, {playerId: OTHER, username: 'lisboa_iphone_ii', score: 12261, distance: 11.68});
  resetScoreCleanupClock();
  assert.equal(await retireShadowScores(store, accounts), 1);
  const names = (await store.read<[string, string][]>('scores', [])).map((row) => row[0]).sort();
  assert.deepEqual(names, [ACCOUNT, OTHER].sort());
});

test('a guest row with a better score is kept, and the cleanup is rate limited', async () => {
  const {store, accounts} = await setup();
  await submitScore(store, {playerId: ACCOUNT, username: 'lisboa', score: 100, distance: 1});
  await submitScore(store, {playerId: GUEST, username: 'lisboa', score: 500, distance: 1});
  resetScoreCleanupClock();
  assert.equal(await retireShadowScores(store, accounts, 0), 0);
  assert.equal((await store.read<unknown[]>('scores', [])).length, 2);
  assert.equal(await retireShadowScores(store, accounts, 1), 0, 'second scan inside the interval does nothing');
});

test('absorbing a guest keeps its higher score on the account and deletes the guest row', async () => {
  const {store} = await setup();
  await submitScore(store, {playerId: ACCOUNT, username: 'lisboa', score: 100, distance: 1});
  await submitScore(store, {playerId: GUEST, username: 'Lisboa', score: 500, distance: 9});
  await absorbGuestScore(store, ACCOUNT, 'lisboa', GUEST);
  const rows = await store.read<[string, string, number, number][]>('scores', []);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0]![0], rows[0]![2], rows[0]![3]], [ACCOUNT, 500, 9]);
});

test('a guest row with a different name is not absorbed, so a GUID alone cannot delete it', async () => {
  const {store} = await setup();
  await submitScore(store, {playerId: ACCOUNT, username: 'lisboa', score: 100, distance: 1});
  await submitScore(store, {playerId: GUEST, username: 'someone-else', score: 500, distance: 9});
  await absorbGuestScore(store, ACCOUNT, 'lisboa', GUEST);
  const rows = await store.read<[string, string, number, number][]>('scores', []);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row[2]).sort((a, b) => a - b), [100, 500]);
});
