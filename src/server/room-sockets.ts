import type {Server} from 'node:http';
import {WebSocketServer} from 'ws';
import type {RoomStore} from './signaling.ts';
import type {SocketStore} from './socket-store.ts';
import {socketSession} from './socket-session.ts';

/** Same adapter for Node development and the Vercel WebSocket function. */
export function attachRoomSockets(server: Server, rooms: RoomStore | null, store: SocketStore | null): WebSocketServer {
  const sockets = new WebSocketServer({noServer: true, maxPayload: 1024});
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const origin = request.headers.origin;
    let validOrigin = !origin;
    try { if (origin) validOrigin = new URL(origin).host === request.headers.host; } catch { /* Reject malformed origins. */ }
    if (url.pathname !== '/api/controller' || !validOrigin || !rooms || !store) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => socketSession(ws, rooms, store));
  });
  server.on('close', () => { sockets.close(); void store?.close(); });
  return sockets;
}
