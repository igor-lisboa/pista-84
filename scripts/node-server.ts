import http from 'node:http';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {networkInterfaces} from 'node:os';
import QRCode from 'qrcode';
import {runtimeConfig} from './env.ts';
import {signaling, memoryStore} from '../src/server/signaling.ts';
import {onlineHealth, storageUnavailable} from '../src/server/cloud.ts';
import {playerApi} from '../src/server/player-api.ts';
import {mongoStore} from '../src/server/mongo-store.ts';
import {redisRoomStore} from '../src/server/redis-rooms.ts';
import {redisSocketStore} from '../src/server/redis-sockets.ts';
import {devSocketStore} from '../src/server/dev-sockets.ts';
import {attachRoomSockets} from '../src/server/room-sockets.ts';
import {isProduction, requestOrigin, validateNodeConfig} from '../src/server/node-config.ts';

validateNodeConfig(process.env);
const production = isProduction(process.env);

const DEFAULT_PORT = 4173;
const MAX_API_BODY = 24_000;
const MAX_QR_TEXT = 2048;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const root = resolve('www');
const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
const roomStore = redisRoomStore(process.env) ?? (production ? null : memoryStore());
const playerStore = mongoStore(process.env);

function findHostIp(): string | undefined {
  return Object.values(networkInterfaces())
    .flat()
    .find((info) => info?.family === 'IPv4' && !info.internal)?.address;
}

const hostIp = production ? undefined : findHostIp();

function sendJson(res: ServerResponse, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(200, {'content-type': 'application/json', ...headers});
  res.end(JSON.stringify(body));
}

function sendStatus(res: ServerResponse, status: number, body?: string): void {
  res.writeHead(status);
  res.end(body);
}

/** Reads the request body as text, or returns null when it exceeds `limit`. */
async function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) {
      return null;
    }
  }
  return body;
}

async function handleRoomsApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const body = await readBody(req, MAX_API_BODY);
  if (body === null) {
    sendStatus(res, 413);
    return;
  }
  const method = req.method ?? 'GET';
  const hasBody = !['GET', 'HEAD'].includes(method);
  const request = new Request(url, {
    method,
    headers: req.headers as Record<string, string>,
    ...(hasBody ? {body} : {}),
  });
  const response = roomStore ? await signaling(request, roomStore) : storageUnavailable();
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}

async function handlePlayersApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const body = await readBody(req, MAX_API_BODY);
  if (body === null) {
    sendStatus(res, 413);
    return;
  }
  const method = req.method ?? 'GET';
  const request = new Request(url, {
    method,
    headers: req.headers as Record<string, string>,
    ...(['GET', 'HEAD'].includes(method) ? {} : {body}),
  });
  const response = playerStore ? await playerApi(request, playerStore, runtimeConfig) : storageUnavailable();
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}

async function handleQr(res: ServerResponse, url: URL): Promise<void> {
  const text = url.searchParams.get('text') || '';
  if (text.length > MAX_QR_TEXT) {
    sendStatus(res, 400);
    return;
  }
  const image = await QRCode.toBuffer(text, {
    width: 300,
    margin: 2,
    color: {dark: '#152824', light: '#f2eedf'},
  });
  res.writeHead(200, {'content-type': 'image/png', 'cache-control': 'no-store'});
  res.end(image);
}

async function serveStatic(res: ServerResponse, url: URL): Promise<void> {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const path = resolve(root, `.${decodeURIComponent(requested)}`);
  if (!path.startsWith(root + sep)) {
    sendStatus(res, 403);
    return;
  }
  const data = await readFile(path);
  res.writeHead(200, {
    'content-type': MIME_TYPES[extname(path)] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  res.end(data);
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = requestOrigin(req, process.env);
  const url = new URL(req.url ?? '/', origin);
  const {pathname} = url;
  if (pathname.startsWith('/api/rooms')) {
    await handleRoomsApi(req, res, url);
  } else if (['/api/progress', '/api/score', '/api/leaderboard', '/api/auth', '/api/account'].includes(pathname)) {
    await handlePlayersApi(req, res, url);
  } else if (pathname === '/runtime-config.json') {
    sendJson(res, runtimeConfig, {'cache-control': 'no-store'});
  } else if (pathname === '/network' && !production) {
    sendJson(res, {host: hostIp});
  } else if (pathname === '/health') {
    sendJson(res, {...onlineHealth(playerStore), storage: playerStore ? 'mongodb' : 'unconfigured', pairing: process.env.REDIS_URL ? 'redis' : 'memory'});
  } else if (pathname === '/qr') {
    await handleQr(res, url);
  } else {
    await serveStatic(res, url);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      sendStatus(res, 404, 'Not found');
    } else if (error instanceof URIError) {
      sendStatus(res, 400, 'Invalid path');
    } else {
      console.error('[http] request failed');
      sendStatus(res, 500, 'Internal server error');
    }
  }
});


let startupFailed = false;
function reportServerError(error: NodeJS.ErrnoException): void {
  // ws forwards HTTP listener errors too, so report each startup failure only once.
  if (startupFailed) return;
  startupFailed = true;
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing game server with Ctrl+C, or choose another PORT in .env.`);
    console.error(`If the game is already running, open http://localhost:${port}.`);
  } else {
    console.error('Could not start PISTA 84 listener.');
  }
  process.exitCode = 1;
}

server.on('error', reportServerError);
const relay = attachRoomSockets(server, roomStore,
  redisSocketStore(process.env) ?? (!production && roomStore ? devSocketStore(roomStore) : null));
relay.on('error', reportServerError);

server.listen(port, '0.0.0.0', () => {
  const address = server.address();
  const listeningPort = address && typeof address !== 'string' ? address.port : port;
  if (production) {
    console.log(`PISTA 84 listening on port ${listeningPort}`);
    return;
  }
  console.log(`PISTA 84 · Local: http://localhost:${listeningPort}`);
  if (hostIp) {
    console.log(`Phone on the same network: http://${hostIp}:${listeningPort}`);
  }
});
