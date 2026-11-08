import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MongoClient} from 'mongodb';
import type {Db} from 'mongodb';
import {mongoAccountStore} from '../src/server/mongo-account-store.ts';
import {mongoStore} from '../src/server/mongo-store.ts';
import type {Account} from '../src/server/accounts.ts';

type RecordValue = {_id: string; usernameKey?: string; expires?: Date; count?: number; [key: string]: unknown};

function setup() {
  const collections = new Map<string, Map<string, RecordValue>>();
  const db = {collection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    const records = collections.get(name)!;
    return {
      async findOne(query: Record<string, unknown>) {
        const found = [...records.values()].find(row => Object.entries(query).every(([key, expected]) => {
          if (key === 'expires') return row.expires! > (expected as {$gt: Date}).$gt;
          return row[key] === expected;
        }));
        return structuredClone(found ?? null);
      },
      async insertOne(record: RecordValue) {
        if (records.has(record._id) || (name === 'accounts' && [...records.values()].some(row => row.usernameKey === record.usernameKey))) {
          throw Object.assign(new Error('Duplicate'), {code: 11000});
        }
        records.set(record._id, structuredClone(record));
      },
      async deleteOne(query: {_id: string}) { records.delete(query._id); },
      async findOneAndUpdate(query: {_id: string}, update: {$inc: {count: number}; $setOnInsert: {expires: Date}}) {
        const row = records.get(query._id) ?? {_id: query._id, count: 0, ...update.$setOnInsert};
        row.count = (row.count ?? 0) + update.$inc.count;
        records.set(query._id, row);
        return structuredClone(row);
      },
    };
  }} as unknown as Db;
  return {collections, first: mongoAccountStore(async () => db), second: mongoAccountStore(async () => db)};
}

const account = (name: string): Account => ({id: crypto.randomUUID(), username: name,
  usernameKey: name.toLowerCase(), passwordHash: 'a salted hash', createdAt: 1000});

test('independent MongoDB account adapters enforce a single winner for username registration', async () => {
  const {first, second} = setup();
  const result = await Promise.all([first.create(account('Driver')), second.create(account('DRIVER'))]);
  assert.equal(result.filter(Boolean).length, 1);
  const stored = await second.findUsername('driver');
  assert.ok(stored);
  assert.equal((await first.findId(stored.id))?.usernameKey, 'driver');
});

test('MongoDB sessions and auth attempt windows are shared across instances and expire without TTL cleanup', async () => {
  const {first, second, collections} = setup();
  const driver = account('Driver');
  await first.create(driver);
  await first.createSession('session-digest', driver.id, new Date(2000));
  assert.equal((await second.session('session-digest', new Date(1000)))?.id, driver.id);
  assert.equal(await second.session('session-digest', new Date(2000)), null);
  await second.deleteSession('session-digest');
  assert.equal(await first.session('session-digest', new Date(1000)), null);
  const attempts = await Promise.all(Array.from({length: 8}, (_, index) =>
    (index % 2 ? first : second).consumeAttempt('hashed-name', 3, 1000, 1200)));
  assert.equal(attempts.filter(Boolean).length, 3);
  assert.equal(await second.consumeAttempt('hashed-name', 3, 1000, 2000), true);
  assert.equal(collections.get('auth-attempts')!.get('hashed-name:1')!.expires!.getTime(), 2000);
});

test('MongoDB initialization creates unique account, session and expiration indexes before serving data', async t => {
  const indexes: unknown[] = [];
  t.mock.method(MongoClient.prototype, 'connect', async function(this: MongoClient) { return this; });
  t.mock.method(MongoClient.prototype, 'db', () => ({collection(name: string) {
    return {
      async createIndex(keys: unknown, options: unknown) { indexes.push([name, keys, options]); },
      async findOne() { return null; },
    };
  }}));
  const store = mongoStore({MONGODB_URI: 'mongodb://127.0.0.1:27017'})!;
  assert.equal(await store.accounts.findUsername('driver'), null);
  assert.deepEqual(indexes, [
    ['scores', {score: -1, achieved: 1, _id: 1}, undefined],
    ['accounts', {usernameKey: 1}, {unique: true}],
    ['sessions', {expires: 1}, {expireAfterSeconds: 0}],
    ['sessions', {accountId: 1}, undefined],
    ['auth-attempts', {expires: 1}, {expireAfterSeconds: 0}],
  ]);
  await store.close();
});
