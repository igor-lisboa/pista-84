import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicConfig} from '../src/shared/config.ts';

const INVALID_BALANCES = ['-1', 'NaN', 'Infinity', '2.5', '9007199254740992'];

test('public config accepts zero, ignores unrelated secrets and validates balances', () => {
  assert.deepEqual(publicConfig({PISTA84_COINS: '10000', DB_TOKEN: 'private'}), {coins: 10000, progressTools: true});
  assert.deepEqual(publicConfig({PISTA84_COINS: '0'}), {coins: 0, progressTools: true});
  assert.deepEqual(publicConfig({PISTA84_COINS: ''}, {coins: 12}), {coins: null, progressTools: true});
  assert.deepEqual(publicConfig({}, {coins: 12}), {coins: 12, progressTools: true});
  for (const value of INVALID_BALANCES) {
    assert.throws(() => publicConfig({PISTA84_COINS: value}), /PISTA84_COINS/);
  }
});

test('garage progress tools flag is allowlisted, validated and independent of balance overrides', () => {
  assert.deepEqual(publicConfig({PISTA84_PROGRESS_TOOLS: 'false', MONGODB_URI: 'private'}), {coins: null, progressTools: false});
  assert.deepEqual(publicConfig({PISTA84_PROGRESS_TOOLS: ' TRUE ', PISTA84_COINS: '0'}), {coins: 0, progressTools: true});
  const fallback = {coins: 12, progressTools: false};
  assert.deepEqual(publicConfig({}, fallback), fallback);
  assert.deepEqual(publicConfig({PISTA84_COINS: '', PISTA84_PROGRESS_TOOLS: ''}, fallback), {coins: null, progressTools: false});
  for (const value of ['0', '1', 'yes', 'disabled']) {
    assert.throws(() => publicConfig({PISTA84_PROGRESS_TOOLS: value}), /PISTA84_PROGRESS_TOOLS/);
  }
});
