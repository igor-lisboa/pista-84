import {test} from 'node:test';
import assert from 'node:assert/strict';
import {redisRoomStore} from '../src/server/redis-rooms.ts';
import {signaling} from '../src/server/signaling.ts';

test('Redis pairing has no implicit memory fallback', () => {
  assert.equal(redisRoomStore({}), null);
});

test('malformed Redis configuration returns 503 rather than crashing API imports', async () => {
  const store = redisRoomStore({REDIS_URL: 'invalid'})!;
  const response = await signaling(new Request('https://game.test/api/rooms', {
    method: 'POST', body: JSON.stringify({offer: 'test'}),
  }), store);
  assert.equal(response.status, 503);
});
