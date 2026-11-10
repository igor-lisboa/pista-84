import {randomBytes, randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import WebSocket from 'ws';

/**
 * End-to-end smoke test of the running Docker stack (`bash scripts/local.sh check`).
 * It talks to the real HTTP/WebSocket server backed by the Compose MongoDB and Redis,
 * using one throwaway account whose records are removed in `finally`. It refuses to run
 * against anything that is not a local service, and never loads `.env` files.
 */

const LOCAL_HOSTS = new Set(['mongo', 'redis', 'localhost', '127.0.0.1', '::1', '[::1]']);
const port = process.env.PORT || '4173';
const base = `http://127.0.0.1:${port}`;

function requireLocal(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run this through "bash scripts/local.sh check".`);
  const host = new URL(value).hostname;
  if (!LOCAL_HOSTS.has(host)) throw new Error(`${name} does not point to a local service; refusing to write probe data.`);
  return value;
}

type Json = Record<string, any>;

async function call(path: string, options: {method?: string; body?: unknown; cookie?: string; headers?: Record<string, string>} = {}): Promise<{status: number; body: Json; cookie: string | null}> {
  const headers: Record<string, string> = {...options.headers};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.cookie) headers.cookie = options.cookie;
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers,
    ...(options.body === undefined ? {} : {body: JSON.stringify(options.body)}),
  });
  const text = await response.text();
  let body: Json = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {text}; }
  const setCookie = response.headers.get('set-cookie');
  return {status: response.status, body, cookie: setCookie ? setCookie.split(';')[0]! : null};
}

const step = (name: string): void => console.log(`OK    ${name}`);

function open(role: 'host' | 'controller', room: string, token: string): Promise<{socket: WebSocket; messages: Json[]}> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/controller`);
    const messages: Json[] = [];
    const timer = setTimeout(() => reject(new Error(`${role} socket was not acknowledged`)), 5000);
    socket.on('open', () => socket.send(JSON.stringify({type: 'auth', room, role, token, session: randomUUID()})));
    socket.on('message', (data) => {
      const message = JSON.parse(String(data)) as Json;
      messages.push(message);
      if (message.type === 'ready') { clearTimeout(timer); resolve({socket, messages}); }
    });
    socket.on('error', reject);
    socket.on('close', (code) => { clearTimeout(timer); reject(new Error(`${role} socket closed with ${code}`)); });
  });
}

async function waitFor(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function check(): Promise<void> {
  const mongoUri = requireLocal('MONGODB_URI');
  requireLocal('REDIS_URL');
  const database = process.env.MONGODB_DATABASE || 'pista84';
  const mongo = new MongoClient(mongoUri, {serverSelectionTimeoutMS: 5000});
  const username = `smk-${randomBytes(4).toString('hex')}`;
  const password = `probe-${randomBytes(6).toString('hex')}`;
  let accountId = '';
  let roomId = '';
  let hostToken = '';
  const sockets: WebSocket[] = [];

  try {
    const health = await call('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.storage, 'mongodb');
    assert.equal(health.body.pairing, 'redis');
    step('health reports MongoDB storage and Redis pairing.');

    const config = await call('/runtime-config.json');
    assert.equal(config.status, 200);
    assert.ok('coins' in config.body && typeof config.body.progressTools === 'boolean');
    for (const asset of ['/', '/game.js', '/sw.js', '/manifest.webmanifest']) {
      assert.equal((await fetch(`${base}${asset}`)).status, 200, asset);
    }
    step('runtime config and static game assets are served.');

    assert.equal((await call('/api/score', {body: {playerId: randomUUID(), username: 'guest', score: 1, distance: 1}})).status, 401);
    assert.equal((await call('/api/progress', {headers: {'x-player-id': randomUUID()}})).status, 401);
    assert.equal((await call('/api/leaderboard')).status, 200);
    step('guests cannot publish scores or progress; the ranking is readable.');

    const signup = await call('/api/auth', {body: {action: 'signup', username, password}});
    assert.equal(signup.status, 200);
    assert.equal(signup.body.user.username, username);
    accountId = signup.body.user.id;
    const cookie = signup.cookie;
    assert.ok(cookie?.startsWith('pista84-session='));
    assert.equal((await call('/api/auth', {body: {action: 'signup', username, password}})).status, 409);
    assert.equal((await call('/api/auth', {body: {action: 'login', username, password: `${password}x`}})).status, 401);
    const login = await call('/api/auth', {body: {action: 'login', username, password}, cookie: cookie!});
    assert.equal(login.status, 200);
    const session = login.cookie!;
    assert.equal((await call('/api/auth', {cookie: session})).body.user.username, username);
    step('account signup, duplicate rejection, wrong password and login (MongoDB accounts and sessions).');

    const score = await call('/api/score', {body: {playerId: accountId, username, score: 1234, distance: 5678}, cookie: session});
    assert.equal(score.status, 200);
    const ranking = await call('/api/leaderboard?page=1&size=50', {cookie: session});
    assert.equal(ranking.status, 200);
    const mine = (ranking.body.entries as Json[]).find((entry) => entry.name === username);
    assert.ok(mine && mine.score === 1234 && mine.mine === true);
    step('score published under the account and visible on the leaderboard.');

    const save = {version: 2, coins: 10, owned: ['fusca'], selected: 'fusca', paints: ['original'], paint: 'original',
      playerId: accountId, username, updatedAt: Date.now()};
    const owner = {'x-player-id': accountId};
    const first = await call('/api/progress', {method: 'PUT', body: {save, revision: 0}, cookie: session, headers: owner});
    assert.equal(first.status, 200);
    assert.equal(first.body.revision, 1);
    assert.equal((await call('/api/progress', {method: 'PUT', body: {save, revision: 0}, cookie: session, headers: owner})).status, 409);
    const read = await call('/api/progress', {cookie: session, headers: owner});
    assert.equal(read.body.save.coins, 10);
    const device = randomUUID();
    const snapshot = await call(`/api/progress?device=${device}`, {method: 'PUT', body: {save: {...save, coins: 77}, revision: 0}, cookie: session, headers: owner});
    assert.equal(snapshot.status, 200);
    assert.equal((await call('/api/progress', {cookie: session, headers: owner})).body.save.coins, 10);
    assert.equal((await call(`/api/progress?device=${device}`, {cookie: session, headers: owner})).body.save.coins, 77);
    const merged = await call('/api/account', {method: 'PUT', body: {save}, cookie: session});
    assert.equal(merged.status, 200);
    step('progress revisions (409 on stale), device snapshot isolation and account reconciliation.');

    const offer = JSON.stringify({type: 'socket'});
    const room = await call('/api/rooms', {body: {offer}});
    assert.equal(room.status, 201);
    roomId = room.body.id;
    hostToken = room.body.hostToken;
    const joinToken = room.body.joinToken as string;
    const bearer = {authorization: `Bearer ${joinToken}`};
    assert.equal((await call(`/api/rooms/${roomId}`, {headers: bearer})).body.offer, offer);
    assert.equal((await call(`/api/rooms/${roomId}`, {body: {answer: offer}, headers: bearer})).status, 200);
    assert.equal((await call(`/api/rooms/${roomId}`, {body: {answer: offer}, headers: bearer})).status, 409);
    const host = await open('host', roomId, hostToken);
    const controller = await open('controller', roomId, joinToken);
    sockets.push(host.socket, controller.socket);
    controller.socket.send(JSON.stringify({type: 'input', input: {steer: 0.5, accelerate: true, brake: false, start: false, pause: false}}));
    await waitFor(() => host.messages.some((message) => message.type === 'input' && message.input?.accelerate === true), 'controller input on the host');
    step('pairing room, exclusive claim and WebSocket input delivered through Redis.');

    assert.equal((await call('/api/auth', {body: {action: 'logout'}, cookie: session})).status, 200);
    assert.equal((await call('/api/score', {body: {playerId: accountId, username, score: 1, distance: 1}, cookie: session})).status, 401);
    step('logout revokes the session.');
  } finally {
    for (const socket of sockets) socket.close();
    if (roomId && hostToken) {
      await call(`/api/rooms/${roomId}`, {method: 'DELETE', headers: {authorization: `Bearer ${hostToken}`}}).catch(() => undefined);
    }
    try {
      if (accountId) {
        await mongo.connect();
        const db = mongo.db(database);
        await db.collection('accounts').deleteOne({_id: accountId as never});
        await db.collection('sessions').deleteMany({accountId});
        for (const name of ['scores', 'backups', 'account-progress']) {
          await db.collection(name).deleteOne({_id: accountId as never});
        }
        await db.collection('device-backups').deleteMany({_id: {$regex: `^${accountId}:`} as never});
        console.log('OK    probe account and its records removed.');
      }
    } finally {
      await mongo.close();
    }
  }
}

try {
  await check();
  console.log('Local stack checks passed.');
} catch (error) {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
process.exit();
