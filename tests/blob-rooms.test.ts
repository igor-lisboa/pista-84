import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BlobError} from '@vercel/blob';
import type {GetBlobResult} from '@vercel/blob';
import {blobRoomStore} from '../src/server/blob-rooms.ts';
import type {BlobRoomApi} from '../src/server/blob-rooms.ts';
import {signaling} from '../src/server/signaling.ts';
import type {RoomStore} from '../src/server/signaling.ts';

const ENV = {BLOB_STORAGE_READ_WRITE_TOKEN: 'rw-token', BLOB_STORAGE_STORE_ID: 'store_test'};
const ORIGIN = 'https://pista.test';

/** An in-memory Blob: overwrite rules, deletes and listing, with a count of every billed call. */
function fakeBlob(now: () => number = Date.now) {
  const files = new Map<string, {body: string; uploadedAt: Date}>();
  const calls = {get: 0, put: 0, del: 0, list: 0};
  const api: BlobRoomApi = {
    async get(pathname) {
      calls.get += 1;
      const file = files.get(pathname);
      if (!file) return null;
      return {statusCode: 200, stream: new Response(file.body).body!, headers: new Headers(), blob: {etag: '"e"', pathname}} as unknown as GetBlobResult;
    },
    async put(pathname, body, options) {
      calls.put += 1;
      assert.equal(options.access, 'private');
      assert.equal(options.token, 'rw-token');
      if (files.has(pathname) && !options.allowOverwrite) throw new BlobError('Vercel Blob: This blob already exists');
      files.set(pathname, {body, uploadedAt: new Date(now())});
      return {pathname};
    },
    async del(pathnames) {
      calls.del += 1;
      for (const pathname of pathnames) files.delete(pathname);
    },
    async list({prefix}) {
      calls.list += 1;
      return {blobs: [...files].filter(([pathname]) => pathname.startsWith(prefix)).map(([pathname, file]) => ({pathname, uploadedAt: file.uploadedAt}))};
    },
  };
  return {api, files, calls};
}

const call = (store: RoomStore, method: string, path: string, token?: string, body?: unknown) =>
  signaling(
    new Request(`${ORIGIN}/api/rooms${path}`, {
      method,
      headers: {origin: ORIGIN, ...(token ? {authorization: `Bearer ${token}`} : {})},
      ...(body ? {body: JSON.stringify(body)} : {}),
    }),
    store,
  ).then(async (response) => ({status: response.status, data: (await response.json()) as Record<string, any>}));

const noSweep = {random: () => 1};

test('without a Blob token there is no shared room store', () => {
  assert.equal(blobRoomStore({}), null);
  assert.notEqual(blobRoomStore({BLOB_READ_WRITE_TOKEN: 'x'}), null);
});

test('a room created on one serverless instance can be joined from another', async () => {
  const blob = fakeBlob();
  // Two stores = two function instances that share nothing but the Blob store.
  const instanceA = blobRoomStore(ENV, blob.api, noSweep)!;
  const instanceB = blobRoomStore(ENV, blob.api, noSweep)!;

  const created = await call(instanceA, 'POST', '', undefined, {offer: '{"type":"relay"}'});
  assert.equal(created.status, 201);
  const {id, hostToken, joinToken} = created.data as {id: string; hostToken: string; joinToken: string};

  // The phone's requests land on the other instance: before this fix that was "Room expired".
  const offer = await call(instanceB, 'GET', `/${id}`, joinToken);
  assert.equal(offer.status, 200);
  assert.equal(offer.data.offer, '{"type":"relay"}');
  assert.equal((await call(instanceB, 'POST', `/${id}`, joinToken, {answer: '{"type":"relay"}'})).status, 200);
  assert.equal((await call(instanceA, 'POST', `/${id}`, joinToken, {answer: 'again'})).status, 409, 'only one phone per room');

  assert.equal((await call(instanceA, 'GET', `/${id}`, hostToken)).data.answer, '{"type":"relay"}');
  assert.equal((await call(instanceB, 'POST', `/${id}/input`, joinToken, {input: {steer: 0.5, accelerate: true}})).status, 200);
  const seen = await call(instanceA, 'GET', `/${id}`, hostToken);
  assert.deepEqual(seen.data.input, {steer: 0.5, accelerate: true, brake: false, start: false, pause: false});
  assert.ok(seen.data.inputTime > 0);

  assert.equal((await call(instanceB, 'GET', `/${id}`, 'wrong')).status, 403);
  assert.equal((await call(instanceB, 'DELETE', `/${id}`, joinToken)).status, 403);
  assert.equal((await call(instanceA, 'DELETE', `/${id}`, hostToken)).status, 200);
  assert.equal(blob.files.size, 0, 'closing the room removes every object');
});

test('polling a paired room costs one read and never writes', async () => {
  const blob = fakeBlob();
  const store = blobRoomStore(ENV, blob.api, noSweep)!;
  const created = await call(store, 'POST', '', undefined, {offer: 'x'});
  const {id, hostToken, joinToken} = created.data as {id: string; hostToken: string; joinToken: string};
  await call(store, 'POST', `/${id}`, joinToken, {answer: 'y'});
  await call(store, 'GET', `/${id}`, hostToken); // learns the answered room

  const writesBefore = blob.calls.put + blob.calls.del;
  blob.calls.get = 0;
  for (let poll = 0; poll < 10; poll += 1) await call(store, 'GET', `/${id}`, hostToken);
  assert.equal(blob.calls.get, 10, 'one input read per poll, nothing else');
  assert.equal(blob.calls.put + blob.calls.del, writesBefore, 'polling never writes');
});

test('a closed room is gone for every instance within a few seconds', async () => {
  const blob = fakeBlob();
  let clock = 1_000;
  const options = {now: () => clock, random: () => 1};
  const instanceA = blobRoomStore(ENV, blob.api, options)!;
  const instanceB = blobRoomStore(ENV, blob.api, options)!;
  const created = await call(instanceA, 'POST', '', undefined, {offer: 'x'});
  const {id, hostToken, joinToken} = created.data as {id: string; hostToken: string; joinToken: string};
  await call(instanceB, 'POST', `/${id}`, joinToken, {answer: 'y'});
  await call(instanceB, 'GET', `/${id}`, joinToken);

  await call(instanceA, 'DELETE', `/${id}`, hostToken);
  clock += 6_000; // past what instance B remembers
  assert.equal((await call(instanceB, 'GET', `/${id}`, joinToken)).status, 410);
});

test('holding a steady command does not write it ten times a second', async () => {
  const blob = fakeBlob();
  let clock = 1_000;
  const store = blobRoomStore(ENV, blob.api, {now: () => clock, random: () => 1})!;
  const created = await call(store, 'POST', '', undefined, {offer: 'x'});
  const {id, joinToken} = created.data as {id: string; joinToken: string};
  await call(store, 'POST', `/${id}`, joinToken, {answer: 'y'});

  const putsBefore = blob.calls.put;
  const send = async (input: object) => {
    clock += 100;
    // signaling throttles to 70 ms by the stored inputTime, which the fake clock cannot drive, so call the store directly
    await store.input(id, {steer: 0, accelerate: false, brake: false, start: false, pause: false, ...input}, clock);
  };
  for (let i = 0; i < 8; i += 1) await send({accelerate: true}); // 800 ms of the same pedal
  assert.equal(blob.calls.put - putsBefore, 1);
  await send({accelerate: true}); // refreshed after 0.8 s so the main screen knows the phone is alive
  assert.equal(blob.calls.put - putsBefore, 2);
  await send({accelerate: true, steer: 1}); // a real change is written at once
  assert.equal(blob.calls.put - putsBefore, 3);
});

test('abandoned rooms are swept up when a new room is created', async () => {
  let clock = Date.now();
  const blob = fakeBlob(() => clock);
  const store = blobRoomStore(ENV, blob.api, {now: () => clock, random: () => 0})!; // always sweep
  const old = await call(store, 'POST', '', undefined, {offer: 'old'});
  assert.equal(old.status, 201);
  clock += 16 * 60 * 1000;
  const fresh = await call(store, 'POST', '', undefined, {offer: 'new'});
  assert.equal(fresh.status, 201);
  const ids = [...blob.files.keys()].map((pathname) => pathname.split('/')[2]);
  assert.ok(!ids.includes((old.data as {id: string}).id), 'the abandoned room was deleted');
  assert.ok(ids.includes((fresh.data as {id: string}).id), 'the new room is kept');
});

test('a Blob outage is a 503 for the pairing request, never a crash', async () => {
  const down: BlobRoomApi = {
    get: () => Promise.reject(new Error('network down')),
    put: () => Promise.reject(new Error('network down')),
    del: () => Promise.reject(new Error('network down')),
    list: () => Promise.reject(new Error('network down')),
  };
  const store = blobRoomStore(ENV, down, noSweep)!;
  assert.equal((await call(store, 'POST', '', undefined, {offer: 'x'})).status, 503);
});
