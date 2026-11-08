import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProgressSync} from '../src/net/progress-sync.ts';
import {defaultSave} from '../src/game/save.ts';
import {cloudProgress} from '../src/server/cloud.ts';
import {readBackup, writeBackup} from '../src/server/players.ts';
import {memoryPlayerStore} from './support/memory-player-store.ts';

function storage() {
  const values = new Map<string, string>();
  return {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }};
}

test('existing local progress uploads without a score/name and survives client restart', async () => {
  const local = storage();
  const store = memoryPlayerStore();
  let online = false;
  let puts = 0;
  const request: typeof fetch = async (url, options) => {
    if (!online) throw new Error('offline');
    if (options?.method === 'PUT') puts++;
    return cloudProgress(new Request(`https://game.test${url}`, options), store);
  };
  const save = {...defaultSave(), coins: 875, owned: ['fusca', 'gol'], selected: 'gol'};
  const first = new ProgressSync(local, request);
  first.queue(save);
  await first.flush();
  online = true;
  const restarted = new ProgressSync(local, request);
  await restarted.flush();
  const device = local.getItem('pista84.device')!;
  const backup = await readBackup(store, save.playerId, device);
  assert.equal(backup.save?.coins, 875);
  assert.deepEqual(backup.save?.owned, ['fusca', 'gol']);
  assert.equal(backup.save?.username, null);
  restarted.queue(save);
  await restarted.flush();
  assert.equal(puts, 1, 'unchanged saves do not upload repeatedly');
});

test('device snapshots preserve manual backups and other devices; stale writes conflict', async () => {
  const store = memoryPlayerStore();
  const save = defaultSave(1000);
  const deviceA = crypto.randomUUID(), deviceB = crypto.randomUUID();
  await writeBackup(store, save.playerId, {...save, coins: 900}, 0);
  await writeBackup(store, save.playerId, {...save, coins: 100}, 0, deviceA);
  await writeBackup(store, save.playerId, {...save, coins: 200}, 0, deviceB);
  assert.equal((await readBackup(store, save.playerId)).save?.coins, 900);
  assert.equal((await readBackup(store, save.playerId, deviceA)).save?.coins, 100);
  assert.equal((await readBackup(store, save.playerId, deviceB)).save?.coins, 200);
  assert.equal(await writeBackup(store, save.playerId, {...save, updatedAt: 999}, 1, deviceA), null);
  assert.equal(await writeBackup(store, save.playerId, save, 0, deviceA), null);
});

test('changes queued during upload and retired player saves are retained', async () => {
  const store = memoryPlayerStore();
  const local = storage();
  const oldPlayer = defaultSave(1000), newPlayer = defaultSave(2000);
  let sync: ProgressSync;
  let changed = false;
  const request: typeof fetch = async (url, options) => {
    if (options?.method === 'PUT' && !changed) {
      changed = true;
      sync.queue({...oldPlayer, coins: 50, updatedAt: 3000});
      sync.queue(newPlayer);
    }
    return cloudProgress(new Request(`https://game.test${url}`, options), store);
  };
  sync = new ProgressSync(local, request);
  sync.queue(oldPlayer);
  await sync.flush();
  await sync.flush();
  const device = local.getItem('pista84.device')!;
  assert.equal((await readBackup(store, oldPlayer.playerId, device)).save?.coins, 50);
  assert.equal((await readBackup(store, newPlayer.playerId, device)).save?.playerId, newPlayer.playerId);
});

test('failed writes and revision conflicts stay queued for retry', async () => {
  const local = storage();
  let status = 503;
  const sync = new ProgressSync(local, async (_url, options) =>
    options?.method === 'PUT' ? new Response('{}', {status}) : Response.json({revision: 0}));
  sync.queue(defaultSave());
  await sync.flush();
  assert.notEqual(local.getItem('pista84.progress-outbox'), '{}');
  status = 409;
  await sync.flush();
  assert.notEqual(local.getItem('pista84.progress-outbox'), '{}');
  status = 200;
  await sync.flush();
  assert.equal(local.getItem('pista84.progress-outbox'), '{}');
});

test('invalid device IDs are rejected by the API', async () => {
  const save = defaultSave();
  const response = await cloudProgress(new Request('https://game.test/api/progress?device=invalid', {
    headers: {'x-player-id': save.playerId},
  }), memoryPlayerStore());
  assert.equal(response.status, 400);
});

test('reconnecting during a failed request retries without waiting for the timer', async () => {
  const local = storage();
  let rejectOffline!: (reason: Error) => void;
  let attempts = 0;
  const sync = new ProgressSync(local, async (_url, options) => {
    if (++attempts === 1) return new Promise<Response>((_resolve, reject) => { rejectOffline = reject; });
    return Response.json(options?.method === 'PUT' ? {revision: 1} : {revision: 0});
  });
  sync.queue(defaultSave());
  const firstAttempt = sync.flush();
  await sync.flush(); // The browser's online event arrives before the first request fails.
  rejectOffline(new Error('offline'));
  await firstAttempt;
  assert.equal(attempts, 3);
  assert.equal(local.getItem('pista84.progress-outbox'), '{}');
});
