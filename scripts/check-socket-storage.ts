import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {redisSocketStore} from '../src/server/redis-sockets.ts';
import type {RoomStore} from '../src/server/signaling.ts';
import type {RedisCommands} from '../src/server/redis.ts';
import type {RoomEvent, SocketLease} from '../src/server/socket-store.ts';

/** Separate adapters exercise delivery between distinct function instances. */
export async function checkSocketStorage(rooms: RoomStore, redis: RedisCommands): Promise<void> {
  const hostStore = redisSocketStore(process.env)!;
  const phoneStore = redisSocketStore(process.env)!;
  const id = randomBytes(24).toString('hex');
  const lease: SocketLease = {room: id, role: 'controller', session: randomUUID(), connection: randomUUID()};
  let unsubscribe: (() => Promise<void>) | undefined;
  try {
    await rooms.create({id, hostToken: 'probe-host', joinToken: 'probe-phone', offer: 'socket', answer: null, expires: Date.now() + 60_000});
    await rooms.answer(id, 'socket');
    const events: RoomEvent[] = [];
    let failed = false;
    unsubscribe = await hostStore.subscribe(id, event => events.push(event), () => { failed = true; });
    assert.equal(await phoneStore.claim(lease), true);
    assert.equal(await hostStore.claim({...lease, session: randomUUID(), connection: randomUUID()}), false);
    assert.equal(await phoneStore.renew(lease), true);
    const ttl = Number(await redis.sendCommand(['PTTL', `pista84:room:{${id}}:controller`]));
    assert.ok(ttl > 0 && ttl <= 15_000);
    const input = {steer: 0.5, accelerate: true, brake: false, start: true, pause: false};
    assert.equal(await phoneStore.input(lease, input), true);
    const deadline = Date.now() + 5000;
    while (!events.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(failed, false);
    assert.equal(events[0]?.type, 'input');
    assert.deepEqual(JSON.parse((await rooms.get(id))!.input!), input);
    const inputTTL = Number(await redis.sendCommand(['PTTL', `pista84:room:{${id}}:input`]));
    assert.ok(inputTTL > 0 && inputTTL <= 2000);
    const resumed = {...lease, connection: randomUUID()};
    assert.equal(await hostStore.claim(resumed), true);
    assert.equal(await phoneStore.input(lease, input), false, 'replaced sockets cannot publish');
    await phoneStore.release(lease);
    assert.equal(await hostStore.renew(resumed), true, 'old cleanup must not delete the new connection');
    await hostStore.release(resumed);
    assert.equal(await redis.sendCommand(['EXISTS', `pista84:room:{${id}}:controller`]), 0);
    await rooms.remove(id);
    assert.equal(await hostStore.claim(resumed), false);
    assert.equal(await hostStore.input(resumed, input), false);
    console.log('OK    Redis sockets: cross-instance Pub/Sub, exclusive presence, TTLs, reconnect and cleanup.');
  } finally {
    const cleanup = await Promise.allSettled([
      unsubscribe?.(), rooms.remove(id),
      redis.sendCommand(['DEL', `pista84:room:{${id}}:controller`, `pista84:room:{${id}}:host`]),
    ]);
    await Promise.allSettled([hostStore.close(), phoneStore.close()]);
    if (cleanup.some(result => result.status === 'rejected')) throw new Error('Socket probe cleanup was incomplete.');
  }
}
