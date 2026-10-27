import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {signaling, memoryStore, d1Store} from '../src/server/signaling.ts';
import type {RoomStore} from '../src/server/signaling.ts';
import {d1Adapter} from './support/sqlite-d1.ts';

const ROOM_MIGRATIONS = ['../drizzle/0000_furry_marvex.sql', '../drizzle/0002_steep_roulette.sql'];
const ROOM_ID_LENGTH = 48;

interface RoomCredentials {
  id: string;
  hostToken: string;
  joinToken: string;
}

function roomRequest(path: string, method = 'GET', token?: string | null, body?: unknown): Request {
  return new Request(`http://localhost/api/rooms${path}`, {
    method,
    headers: {
      origin: 'http://localhost',
      ...(token ? {authorization: `Bearer ${token}`} : {}),
    },
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
}

async function createStore(mode: 'memory' | 'd1'): Promise<{store: RoomStore; close(): void}> {
  if (mode === 'memory') {
    return {store: memoryStore(), close() {}};
  }
  const db = new DatabaseSync(':memory:');
  for (const migration of ROOM_MIGRATIONS) {
    db.exec(await readFile(new URL(migration, import.meta.url), 'utf8'));
  }
  return {store: d1Store(d1Adapter(db)), close: () => db.close()};
}

for (const mode of ['memory', 'd1'] as const) {
  test(`${mode}: room auth, atomic answer, expiry and deletion`, async () => {
    const {store, close} = await createStore(mode);
    const call = async (path: string, method?: string, token?: string | null, body?: unknown) =>
      signaling(roomRequest(path, method, token, body), store);
    const status = async (...args: Parameters<typeof call>) => (await call(...args)).status;

    const create = await call('', 'POST', null, {offer: '{"type":"offer"}'});
    assert.equal(create.status, 201);
    const room = (await create.json()) as RoomCredentials;
    assert.equal(room.id.length, ROOM_ID_LENGTH);
    const path = `/${room.id}`;

    assert.equal(await status(path, 'GET', 'wrong'), 403);
    const offer = await (await call(path, 'GET', room.joinToken)).json();
    assert.equal(offer.offer, '{"type":"offer"}');
    assert.equal(offer.hostToken, undefined);

    assert.equal(await status(path, 'POST', room.hostToken, {answer: 'x'}), 403);
    assert.equal(await status(path, 'POST', room.joinToken, {answer: 'answer'}), 200);
    assert.equal(await status(path, 'POST', room.joinToken, {answer: 'replace'}), 409);
    assert.equal((await (await call(path, 'GET', room.hostToken)).json()).answer, 'answer');

    assert.equal(await status(`${path}/input`, 'POST', room.hostToken, {input: {steer: 1}}), 403);
    const controllerInput = {input: {steer: 99, accelerate: true, start: true}};
    assert.equal(await status(`${path}/input`, 'POST', room.joinToken, controllerInput), 200);
    const state = await (await call(path, 'GET', room.hostToken)).json();
    assert.equal(state.input.steer, 1);
    assert.equal(state.input.start, true);
    assert.equal(state.input.brake, false);
    assert.ok(state.inputTime > 0);

    assert.equal(await status(path, 'DELETE', room.joinToken), 403);
    assert.equal(await status(path, 'DELETE', room.hostToken), 200);
    assert.equal(await status(path, 'GET', room.hostToken), 410);

    const expiredId = 'a'.repeat(ROOM_ID_LENGTH);
    await store.create({
      id: expiredId,
      hostToken: 'h',
      joinToken: 'j',
      offer: 'x',
      answer: null,
      expires: Date.now() - 1,
    });
    assert.equal(await status(`/${expiredId}`, 'GET', 'h'), 410);

    close();
  });
}

test('signaling rejects cross-origin, oversized and invalid JSON requests', async () => {
  const store = memoryStore();
  const crossOrigin = new Request('http://localhost/api/rooms', {
    method: 'POST',
    headers: {origin: 'http://evil.test'},
    body: '{}',
  });
  const invalidJson = new Request('http://localhost/api/rooms', {method: 'POST', body: 'bad json'});

  assert.equal((await signaling(crossOrigin, store)).status, 403);
  assert.equal((await signaling(invalidJson, store)).status, 400);
  assert.equal((await signaling(roomRequest('', 'POST', null, {offer: 'x'.repeat(25_000)}), store)).status, 413);
  assert.equal((await signaling(roomRequest('', 'POST', null, {offer: 4}), store)).status, 400);
});
