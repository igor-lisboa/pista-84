import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {cloudProgress} from '../src/server/cloud.ts';
import {d1Adapter} from './support/sqlite-d1.ts';

const PROGRESS_MIGRATION = new URL('../drizzle/0001_true_shriek.sql', import.meta.url);

function progressRequest(user: string | null, method = 'GET', body?: unknown): Request {
  return new Request('https://pista.test/api/progress', {
    method,
    headers: {
      origin: 'https://pista.test',
      ...(user ? {'oai-authenticated-user-id': user} : {}),
    },
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
}

test('cloud backups are isolated by authenticated user and use optimistic concurrency', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(await readFile(PROGRESS_MIGRATION, 'utf8'));
  const adapter = d1Adapter(db);
  const call = (user: string | null, method?: string, body?: unknown, config?: {coins: number | null}) =>
    cloudProgress(progressRequest(user, method, body), adapter, config);
  const snapshot = {coins: 123, owned: ['fusca', 'gol'], selected: 'gol', best: 500};

  assert.equal((await call(null)).status, 401);
  assert.equal((await call('alice', 'PUT', {save: snapshot, revision: 0})).status, 200);
  assert.equal((await call('alice', 'PUT', {save: snapshot, revision: 0})).status, 409);

  const alice = await (await call('alice')).json();
  assert.equal(alice.save.coins, 123);
  assert.equal(alice.save.selected, 'gol');
  assert.equal(alice.revision, 1);

  const bob = await (await call('bob')).json();
  assert.equal(bob.save, null);

  assert.equal((await call('alice', 'PUT', {save: {...snapshot, coins: 150}, revision: 1})).status, 200);
  assert.equal((await call('alice', 'PUT', {save: snapshot, revision: 1})).status, 409);
  assert.equal((await (await call('alice')).json()).save.coins, 150);

  const overridden = await (await call('alice', 'GET', undefined, {coins: 10000})).json();
  assert.equal(overridden.save.coins, 10000);
  assert.equal(overridden.revision, 2);
  assert.equal((await (await call('alice')).json()).save.coins, 150);

  db.close();
});
