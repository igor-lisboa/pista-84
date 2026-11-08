import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {memoryStore} from '../src/server/signaling.ts';
import {devSocketStore} from '../src/server/dev-sockets.ts';
import {attachRoomSockets} from '../src/server/room-sockets.ts';
import type {SocketRole} from '../src/server/socket-store.ts';

test('sockets authenticate, relay commands, reject duplicate controllers and resume the same session', {timeout: 10_000}, async (t) => {
  const rooms = memoryStore();
  const store = devSocketStore(rooms);
  const id = 'a'.repeat(48);
  await rooms.create({id, hostToken: 'host', joinToken: 'join', offer: 'socket', answer: 'socket', expires: Date.now() + 60_000});
  const server = createServer();
  const wss = attachRoomSockets(server, rooms, store);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `ws://127.0.0.1:${(server.address() as {port: number}).port}/api/controller`;
  const clients: WebSocket[] = [];
  t.after(async () => {
    for (const socket of clients) socket.terminate();
    for (const socket of wss.clients) socket.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  async function connect(role: SocketRole, token: string, session = randomUUID()) {
    const socket = new WebSocket(url);
    clients.push(socket);
    await once(socket, 'open');
    const outcome = Promise.race([
      once(socket, 'message').then(([data]) => JSON.parse(String(data))),
      once(socket, 'close').then(([code]) => ({code})),
    ]);
    socket.send(JSON.stringify({type: 'auth', room: id, role, token, session}));
    return {socket, result: await outcome, session};
  }
  assert.equal((await connect('host', 'wrong')).result.code, 1008);
  const host = await connect('host', 'host');
  assert.equal(host.result.type, 'ready');
  const controller = await connect('controller', 'join');
  assert.equal(controller.result.type, 'ready');
  assert.equal((await connect('controller', 'join')).result.code, 1008);
  const message = once(host.socket, 'message');
  controller.socket.send(JSON.stringify({type: 'input', input: {steer: 9, start: true, brake: true}}));
  const input = JSON.parse(String((await message)[0])).input;
  assert.equal(input.steer, 1);
  assert.equal(input.start, true);
  assert.equal(input.brake, true);

  const resumed = await connect('controller', 'join', controller.session);
  assert.equal(resumed.result.type, 'ready');
  const replaced = once(controller.socket, 'close');
  await new Promise(resolve => setTimeout(resolve, 30));
  controller.socket.send(JSON.stringify({type: 'input', input: {accelerate: true}}));
  assert.equal((await replaced)[0], 1008);
  const next = once(host.socket, 'message');
  resumed.socket.send(JSON.stringify({type: 'input', input: {pause: true}}));
  assert.equal(JSON.parse(String((await next)[0])).input.pause, true);
  const disconnected = once(host.socket, 'message');
  resumed.socket.close();
  assert.equal(JSON.parse(String((await disconnected)[0])).type, 'disconnected');

  const hostClosed = once(host.socket, 'close');
  host.socket.send(JSON.stringify({type: 'input', input: {}}));
  assert.equal((await hostClosed)[0], 1008, 'hosts cannot send controller commands');
});

test('socket upgrades reject cross-origin requests and missing Redis configuration', {timeout: 5000}, async (t) => {
  for (const configured of [true, false]) {
    const server = createServer();
    const rooms = memoryStore();
    attachRoomSockets(server, configured ? rooms : null, configured ? devSocketStore(rooms) : null);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => { server.close(); });
    const socket = new WebSocket(`ws://127.0.0.1:${(server.address() as {port: number}).port}/api/controller`,
      configured ? {origin: 'https://evil.test'} : {});
    const [error] = await once(socket, 'error');
    assert.match(error.message, /403/);
  }
});

test('expired or deleted rooms cannot renew socket presence or publish input', async () => {
  const rooms = memoryStore();
  const store = devSocketStore(rooms);
  const id = 'b'.repeat(48);
  const lease = {room: id, role: 'controller' as const, session: randomUUID(), connection: randomUUID()};
  const room = {id, hostToken: 'host', joinToken: 'join', offer: 'socket', answer: 'socket', expires: Date.now() + 60_000};
  await rooms.create(room);
  assert.equal(await store.claim(lease), true);
  room.expires = Date.now() - 1;
  assert.equal(await store.renew(lease), false);
  assert.equal(await store.input(lease, {steer: 0, accelerate: true, brake: false, start: false, pause: false}), false);
  await rooms.remove(id);
  assert.equal(await store.claim(lease), false);
  await store.close();
});
