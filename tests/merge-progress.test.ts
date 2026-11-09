import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeProgress} from '../src/game/merge-progress.ts';
import {defaultSave} from '../src/game/save.ts';

test('guest reconciliation is idempotent and preserves unlocks, records and earliest creation', () => {
  const remote = {...defaultSave(1000), coins: 600, bestScore: 900, owned: ['fusca', 'gol'], updatedAt: 4000};
  const guest = {...defaultSave(2000), coins: 800, best: 1000, paints: ['original', 'scarlet'], updatedAt: 3000};
  const merged = mergeProgress(remote, guest, remote.playerId, 'Driver');
  assert.equal(merged.coins, 800);
  assert.equal(merged.bestScore, 900);
  assert.equal(merged.best, 1000);
  assert.equal(merged.createdAt, 1000);
  assert.deepEqual(mergeProgress(merged, guest, remote.playerId, 'Driver'), merged);
});

test('later account spending survives retries and older snapshots from another device', () => {
  const remote = {...defaultSave(1000), coins: 600};
  const spent = {...remote, coins: 50, owned: ['fusca', 'gol'], updatedAt: 3000};
  const merged = mergeProgress(remote, spent, remote.playerId, 'Driver');
  assert.equal(merged.coins, 50);
  assert.equal(mergeProgress(merged, remote, remote.playerId, 'Driver').coins, 50);
});

test('a newer save written elsewhere survives this tab\'s late write', async () => {
  const {reconcileStoredSave} = await import('../src/game/merge-progress.ts');
  const current = {...defaultSave(1000), coins: 0, owned: ['fusca'], bestScore: 50, updatedAt: 2000, username: 'Mine'};
  const stored = {...defaultSave(1000), coins: 900, owned: ['fusca', 'gol'], bestScore: 700, best: 40, updatedAt: 3000, username: 'Other'};
  const merged = reconcileStoredSave(stored, current);
  assert.equal(merged.coins, 900, 'the later snapshot wins the wallet');
  assert.deepEqual(merged.owned, ['fusca', 'gol']);
  assert.equal(merged.bestScore, 700);
  assert.equal(merged.best, 40);
  assert.equal(merged.username, 'Mine', 'identity stays with this tab');
  assert.equal(merged.updatedAt, 3000);
  const older = reconcileStoredSave({...stored, updatedAt: 1500}, current);
  assert.equal(older.coins, 0, 'an older stored copy never overrides this tab');
  assert.deepEqual(older.owned, ['fusca', 'gol'], 'but its unlocks are still kept');
});
