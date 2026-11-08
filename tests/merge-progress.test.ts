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
