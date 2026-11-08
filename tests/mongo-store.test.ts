import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Collection} from 'mongodb';
import {mongoStore} from '../src/server/mongo-store.ts';
import {mongoPlayerStore} from '../src/server/mongo-player-store.ts';
import {leaderboardPage, readBackup, submitScore, writeBackup} from '../src/server/players.ts';
import type {ScoresDoc} from '../src/server/players.ts';
import type {BackupsDoc} from '../src/server/players.ts';
import {syncAccountProgress} from '../src/server/account-progress.ts';
import {defaultSave} from '../src/game/save.ts';

type Doc = {_id: string; version: number; value: unknown; score?: number; achieved?: number};
type Query = Record<string, any>;

// Minimal isolated database with atomic unique inserts and version-filtered replacements.
// Reads yield copies so two adapters can exercise genuine stale-read write races.
class Records {
  docs = new Map<string, Doc>();
  writes = 0;
  matches(doc: Doc, query: Query): boolean {
    return Object.entries(query).every(([field, expected]) => {
      if (field === '$or') return expected.some((part: Query) => this.matches(doc, part));
      const actual = (doc as unknown as Query)[field];
      if (expected && typeof expected === 'object') {
        if ('$gt' in expected) return actual > expected.$gt;
        if ('$lt' in expected) return actual < expected.$lt;
      }
      return actual === expected;
    });
  }
  async findOne(query: Query) { return structuredClone([...this.docs.values()].find((doc) => this.matches(doc, query)) ?? null); }
  async insertOne(doc: Doc) {
    if (this.docs.has(doc._id)) throw Object.assign(new Error('Duplicate'), {code: 11000});
    this.docs.set(doc._id, structuredClone(doc)); this.writes++;
  }
  async replaceOne(query: Query, doc: Doc) {
    const current = this.docs.get(doc._id);
    if (!current || !this.matches(current, query)) return {matchedCount: 0};
    this.docs.set(doc._id, structuredClone(doc)); this.writes++;
    return {matchedCount: 1};
  }
  async countDocuments(query: Query = {}) { return [...this.docs.values()].filter((doc) => this.matches(doc, query)).length; }
  find() {
    let rows = structuredClone([...this.docs.values()]);
    const cursor = {
      sort(order: Record<string, number>) {
        rows.sort((a, b) => {
          for (const [field, direction] of Object.entries(order)) {
            const left = (a as unknown as Query)[field], right = (b as unknown as Query)[field];
            if (left !== right) return (left < right ? -1 : 1) * direction;
          }
          return 0;
        }); return cursor;
      },
      skip(n: number) { rows = rows.slice(n); return cursor; },
      limit(n: number) { rows = rows.slice(0, n); return cursor; },
      async toArray() { return rows; },
    };
    return cursor;
  }
}

const ALICE = '6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b';
const BOB = '7a2d3b4f-8c5e-4f60-9b8c-1d2e3f4a5b6c';
function setup() {
  const records = {scores: new Records(), backups: new Records(), 'device-backups': new Records(), 'account-progress': new Records()};
  const adapter = () => mongoPlayerStore(async (key) => records[key] as unknown as Collection<Doc>);
  return {records, first: adapter(), second: adapter()};
}
const score = (playerId: string, value: number) => ({playerId, username: 'Driver', score: value, distance: value / 10});

test('MongoDB is unconfigured without a URI and never substitutes volatile storage', () => {
  assert.equal(mongoStore({}), null);
});

test('concurrent account reconciliations preserve unlocks and records without touching manual backups', async () => {
  const {first, second, records} = setup();
  const user = {id: ALICE, username: 'Alice'};
  const guestA = {...defaultSave(1000), coins: 500, bestScore: 9000, owned: ['fusca', 'gol']};
  const guestB = {...defaultSave(2000), coins: 900, best: 7000, paints: ['original', 'scarlet']};
  await Promise.all([syncAccountProgress(first, user, guestA), syncAccountProgress(second, user, guestB)]);
  const merged = (await first.read<BackupsDoc>('account-progress', {}, ALICE))[ALICE]!.save;
  assert.equal(merged.bestScore, 9000);
  assert.equal(merged.best, 7000);
  assert.equal(merged.coins, 900);
  assert.ok(merged.owned.includes('gol'));
  assert.ok(merged.paints.includes('scarlet'));
  assert.equal(records.backups.docs.size, 0);
  assert.equal(records['device-backups'].docs.size, 0);
});

test('malformed MongoDB configuration fails on requests rather than crashing API imports', async () => {
  const store = mongoStore({MONGODB_URI: 'invalid'})!;
  await assert.rejects(() => store.read('scores', []));
  await store.close();
});

test('two MongoDB adapters preserve concurrent score maxima and isolate players', async () => {
  const {records, first, second} = setup();
  await Promise.all([
    submitScore(first, score(ALICE, 900)), submitScore(second, score(ALICE, 100)),
    submitScore(second, score(BOB, 500)),
  ]);
  assert.equal(records.scores.docs.size, 2);
  assert.equal(records.backups.docs.size, 0);
  assert.equal((await first.read<ScoresDoc>('scores', [], ALICE))[0]![2], 900);
  assert.equal(await first.rank(ALICE), 1);
  assert.equal(await second.rank(BOB), 2);
  const writes = records.scores.writes;
  await submitScore(first, score(ALICE, 900));
  assert.equal(records.scores.writes, writes, 'identical submission must not write');
});

test('concurrent first backups accept exactly one writer and reject stale revisions', async () => {
  const {records, first, second} = setup();
  const save = {owned: ['fusca'], coins: 20};
  const results = await Promise.all([writeBackup(first, ALICE, save, 0), writeBackup(second, ALICE, {...save, coins: 30}, 0)]);
  assert.equal(results.filter(Boolean).length, 1);
  const backup = await readBackup(first, ALICE);
  assert.equal(backup.revision, 1);
  assert.ok([20, 30].includes(backup.save!.coins));
  assert.equal((await readBackup(second, BOB)).save, null);
  assert.equal(records.backups.docs.size, 1);
  assert.ok(await writeBackup(second, ALICE, save, 1));
  assert.equal(await writeBackup(first, ALICE, save, 1), null);
});

test('indexed leaderboard paging returns ranks without exposing player GUIDs', async () => {
  const {first} = setup();
  await submitScore(first, score(ALICE, 500));
  await submitScore(first, score(BOB, 900));
  const page = await leaderboardPage(first, {size: 1, page: 2, playerId: ALICE});
  assert.equal(page.total, 2);
  assert.equal(page.pages, 2);
  assert.equal(page.entries[0]!.rank, 2);
  assert.equal(page.entries[0]!.mine, true);
  assert.equal(JSON.stringify(page).includes(ALICE), false);
});

test('MongoDB propagates non-conflict failures without acknowledging a save', async () => {
  const records = new Records();
  records.insertOne = async () => { throw new Error('Database offline'); };
  const store = mongoPlayerStore(async () => records as unknown as Collection<Doc>);
  await assert.rejects(() => submitScore(store, score(ALICE, 100)), /Database offline/);
  assert.equal(records.docs.size, 0);
});
