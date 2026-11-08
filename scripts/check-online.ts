import './env.ts';
import {randomBytes, randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import {mongoStore} from '../src/server/mongo-store.ts';
import {readBackup, submitScore, writeBackup} from '../src/server/players.ts';
import {redisConnection} from '../src/server/redis.ts';
import {redisRoomStore} from '../src/server/redis-rooms.ts';

let stage = 'configuration';

/** Unique, removable probes exercise real writes without touching existing players. */
async function check(): Promise<void> {
  const store = mongoStore(process.env);
  const redis = redisConnection(process.env);
  if (!store || !redis) throw new Error('Set MONGODB_URI and REDIS_URL.');
  const cleanup = new MongoClient(process.env.MONGODB_URI!, {serverSelectionTimeoutMS: 5000});
  const rooms = redisRoomStore({}, redis)!;
  const playerId = randomUUID();
  const deviceId = randomUUID();
  const id = randomBytes(24).toString('hex');
  try {
    stage = 'MongoDB writes';
    const submitted = await submitScore(store, {playerId, username: 'write-check', score: 1, distance: 1});
    assert.ok(submitted && submitted.rank > 0);
    const save = {owned: ['fusca'], coins: 1};
    assert.ok(await writeBackup(store, playerId, save, 0));
    assert.equal(await writeBackup(store, playerId, save, 0), null);
    assert.equal((await readBackup(store, playerId)).save?.coins, 1);
    assert.ok(await writeBackup(store, playerId, {...save, coins: 42}, 0, deviceId));
    assert.equal((await readBackup(store, playerId, deviceId)).save?.coins, 42);
    assert.equal((await readBackup(store, playerId)).save?.coins, 1);
    console.log('OK    MongoDB: score, manual/device backup round-trips, isolation and revision conflict.');

    stage = 'Redis connection';
    assert.equal(await redis.sendCommand(['PING']), 'PONG');
    stage = 'Redis room creation';
    await rooms.create({id, hostToken: 'h', joinToken: 'j', offer: 'check', answer: null, expires: Date.now() + 60_000});
    stage = 'Redis claims';
    const claims = await Promise.all([rooms.answer(id, 'a'), rooms.answer(id, 'b')]);
    assert.equal(claims.filter(Boolean).length, 1);
    stage = 'Redis controller input';
    const time = Date.now();
    await rooms.input(id, {steer: 0.5, accelerate: true, brake: false, start: false, pause: false}, time);
    assert.equal((await rooms.get(id))?.inputTime, time);
    stage = 'Redis room TTL';
    const roomTTL = Number(await redis.sendCommand(['PTTL', `pista84:room:{${id}}`]));
    const inputTTL = Number(await redis.sendCommand(['PTTL', `pista84:room:{${id}}:input`]));
    assert.ok(roomTTL > 0 && roomTTL <= 60_000);
    stage = 'Redis input TTL';
    assert.ok(inputTTL > 0 && inputTTL <= 2000);
    stage = 'Redis input expiry';
    await new Promise((resolve) => setTimeout(resolve, 2100));
    assert.equal((await rooms.get(id))?.input, undefined);
    stage = 'Redis deletion';
    await rooms.remove(id);
    assert.equal(await rooms.get(id), null);
    assert.equal(await rooms.answer(id, 'late'), false);
    await rooms.input(id, {steer: 0, accelerate: true, brake: false, start: false, pause: false}, Date.now());
    assert.equal(await redis.sendCommand(['EXISTS', `pista84:room:{${id}}:input`]), 0);
    console.log('OK    Redis: exclusive answer, controller input, TTLs and deletion.');
  } finally {
    const db = cleanup.db(process.env.MONGODB_DATABASE || 'pista84');
    const results = await Promise.allSettled([
      db.collection<{_id: string}>('scores').deleteOne({_id: playerId}),
      db.collection<{_id: string}>('backups').deleteOne({_id: playerId}),
      db.collection<{_id: string}>('device-backups').deleteOne({_id: `${playerId}:${deviceId}`}),
      rooms.remove(id),
    ]);
    await Promise.allSettled([cleanup.close(), store.close(), redis.close()]);
    if (results.some((result) => result.status === 'rejected')) throw new Error('Probe cleanup was incomplete.');
  }
}

try { await check(); }
catch (error) {
  // Never print a driver error or connection URI with credentials.
  const code = (error as {code?: unknown}).code;
  console.error(`FAIL  ${stage} (${error instanceof Error ? error.name : 'unknown'}${typeof code === 'string' && /^[A-Z_]+$/.test(code) ? `, ${code}` : ''}). Verify credentials, network access and permissions.`);
  process.exitCode = 1;
}
