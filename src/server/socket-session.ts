import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {sanitizeInput} from './signaling.ts';
import type {RoomStore} from './signaling.ts';
import type {SocketStore, SocketLease} from './socket-store.ts';

/** Authenticates one socket and bounds its lifetime, input rate and output buffer. */
export function socketSession(socket: WebSocket, rooms: RoomStore, store: SocketStore): void {
  let lease: SocketLease | undefined;
  let unsubscribe: (() => Promise<void>) | undefined;
  let authenticating = false;
  let ready = false;
  let writing = false;
  let renewing = false;
  let alive = true;
  let lastInput = 0;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const fail = () => socket.close(1011, 'Controller service unavailable');
  const send = (message: unknown) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 16_384) { socket.close(1013, 'Slow connection'); return; }
    socket.send(JSON.stringify(message));
  };
  const cleanup = async () => {
    const stop = unsubscribe;
    unsubscribe = undefined;
    await Promise.allSettled([stop?.(), lease && store.release(lease)]);
  };
  const authTimeout = setTimeout(() => socket.close(1008, 'Authentication required'), 8000);
  const heartbeat = setInterval(() => {
    if (!ready || renewing || !lease) return;
    if (!alive) { socket.terminate(); return; }
    alive = false;
    socket.ping();
    renewing = true;
    void store.renew(lease).then((ok) => {
      if (!ok) socket.close(1008, 'Room expired or connection replaced');
    }).catch(fail).finally(() => { renewing = false; });
  }, 5000);
  socket.on('pong', () => { alive = true; });
  socket.on('error', () => {});
  socket.on('close', () => {
    ready = false;
    clearTimeout(authTimeout);
    clearTimeout(expiry);
    clearInterval(heartbeat);
    void cleanup();
  });

  async function authenticate(message: Record<string, unknown>): Promise<void> {
    authenticating = true;
    const {room: id, token, session, role} = message;
    if (typeof id !== 'string' || !/^[a-f0-9]{48}$/.test(id) ||
        typeof session !== 'string' || !/^[a-f0-9-]{36}$/.test(session) ||
        (role !== 'host' && role !== 'controller')) {
      socket.close(1008, 'Invalid authentication'); return;
    }
    const room = await rooms.get(id);
    if (!room || room.expires <= Date.now() || token !== (role === 'host' ? room.hostToken : room.joinToken) ||
        (role === 'controller' && !room.answer)) {
      socket.close(1008, 'Invalid or expired room'); return;
    }
    lease = {room: id, role, session, connection: randomUUID()};
    if (!await store.claim(lease)) { socket.close(1008, 'Room already occupied'); return; }
    unsubscribe = await store.subscribe(id, (event) => {
      if (event.type === 'input' && role === 'host' && Date.now() - event.time < 1800) send(event);
      if (event.type === 'disconnected' && event.role !== role) send(event);
    }, fail);
    if (socket.readyState !== WebSocket.OPEN) { await cleanup(); return; }
    clearTimeout(authTimeout);
    expiry = setTimeout(() => socket.close(1008, 'Room expired'), Math.max(1, room.expires - Date.now()));
    ready = true;
    send({type: 'ready'});
  }

  socket.on('message', (raw, binary) => {
    try {
      if (binary) { socket.close(1008, 'Text messages required'); return; }
      const message = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (!ready) {
        if (authenticating || message.type !== 'auth') { socket.close(1008, 'Authentication required'); return; }
        void authenticate(message).catch(fail);
        return;
      }
      if (message.type !== 'input' || lease?.role !== 'controller') { socket.close(1008, 'Invalid command'); return; }
      if (writing || Date.now() - lastInput < 25) return;
      writing = true;
      lastInput = Date.now();
      void store.input(lease, sanitizeInput(message.input)).then((ok) => {
        if (!ok) socket.close(1008, 'Room expired or connection replaced');
      }).catch(fail).finally(() => { writing = false; });
    } catch { socket.close(1008, 'Invalid message'); }
  });
}
