import {createServer} from 'node:http';
import {rooms} from './_rooms.ts';
import {redisSocketStore} from '../src/server/redis-sockets.ts';
import {attachRoomSockets} from '../src/server/room-sockets.ts';

const server = createServer((_request, response) => {
  response.writeHead(426, {'content-type': 'text/plain', 'cache-control': 'no-store'});
  response.end('WebSocket connection required.');
});
attachRoomSockets(server, rooms, redisSocketStore(process.env));

export default server;
