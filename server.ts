import http from 'node:http';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {networkInterfaces} from 'node:os';
import {randomBytes} from 'node:crypto';
import {WebSocketServer, WebSocket} from 'ws';
import QRCode from 'qrcode';
import {runtimeConfig} from './scripts/env.ts';
import {signaling, memoryStore, sanitizeInput} from './src/server/signaling.ts';

const DEFAULT_PORT = 4173;
const MAX_API_BODY = 24_000;
const MAX_QR_TEXT = 2048;
const MAX_RELAY_PAYLOAD = 1024;
const RELAY_PATH = '/relay';
const RELAY_ROOM_TTL_MS = 60 * 60 * 1000;
const RELAY_MIN_INPUT_INTERVAL_MS = 25;
const WS_POLICY_VIOLATION = 1008;

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
const port = Number(process.env.PORT) || DEFAULT_PORT;
const roomStore = memoryStore();

function findHostIp(): string | undefined {
  return Object.values(networkInterfaces())
    .flat()
    .find((info) => info?.family === 'IPv4' && !info.internal)?.address;
}

const hostIp = findHostIp();

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
  const response = await signaling(request, roomStore);
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
  const origin = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
  const url = new URL(req.url ?? '/', origin);
  const {pathname} = url;
  if (pathname.startsWith('/api/rooms')) {
    await handleRoomsApi(req, res, url);
  } else if (pathname === '/runtime-config.json') {
    sendJson(res, runtimeConfig, {'cache-control': 'no-store'});
  } else if (pathname === '/network') {
    sendJson(res, {host: hostIp});
  } else if (pathname === '/health') {
    sendJson(res, {ok: true});
  } else if (pathname === '/qr') {
    await handleQr(res, url);
  } else {
    await serveStatic(res, url);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch {
    sendStatus(res, 404, 'Not found');
  }
});

// --- WebSocket relay (host screen <-> controller) -------------------------------------------

type RelayRole = 'host' | 'controller';

interface RelayRoom {
  host: WebSocket;
  token: string;
  controller: WebSocket | null;
  created: number;
}

type ClientMessage =
  | {type: 'host'}
  | {type: 'join'; room: string; token: string}
  | {type: 'input'; input?: unknown};

type ServerMessage =
  | {type: 'room'; room: string; token: string; host: string | undefined}
  | {type: 'connected'}
  | {type: 'disconnected'}
  | {type: 'error'; message: string}
  | {type: 'input'; input: {steer: number; accelerate: boolean; brake: boolean}};

const relayRooms = new Map<string, RelayRoom>();

function sendMessage(socket: WebSocket | null | undefined, message: ServerMessage): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function isAllowedOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function attachRelay(wss: WebSocketServer): void {
  wss.on('connection', (socket, req) => {
    if (!isAllowedOrigin(req)) {
      socket.close(WS_POLICY_VIOLATION, 'Origin rejected');
      return;
    }
    handleRelayClient(socket);
  });
}

function handleRelayClient(socket: WebSocket): void {
  let roomId = '';
  let role: RelayRole | undefined;
  let lastInputAt = 0;

  const registerHost = (): void => {
    roomId = randomBytes(4).toString('hex').toUpperCase();
    const token = randomBytes(18).toString('hex');
    relayRooms.set(roomId, {host: socket, token, controller: null, created: Date.now()});
    role = 'host';
    sendMessage(socket, {type: 'room', room: roomId, token, host: hostIp});
  };

  const registerController = (message: {room: string; token: string}): void => {
    const room = relayRooms.get(message.room);
    const unusable =
      !room ||
      room.token !== message.token ||
      room.controller ||
      Date.now() - room.created > RELAY_ROOM_TTL_MS;
    if (unusable) {
      sendMessage(socket, {type: 'error', message: 'Room expired, occupied or invalid code.'});
      socket.close();
      return;
    }
    role = 'controller';
    roomId = message.room;
    room.controller = socket;
    sendMessage(socket, {type: 'connected'});
    sendMessage(room.host, {type: 'connected'});
  };

  const forwardInput = (rawInput: unknown): void => {
    const now = Date.now();
    if (now - lastInputAt < RELAY_MIN_INPUT_INTERVAL_MS) {
      return;
    }
    lastInputAt = now;
    const room = relayRooms.get(roomId);
    if (!room) {
      return;
    }
    const {steer, accelerate, brake} = sanitizeInput(rawInput);
    sendMessage(room.host, {type: 'input', input: {steer, accelerate, brake}});
  };

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as ClientMessage;
      if (message.type === 'host' && !role) {
        registerHost();
      } else if (message.type === 'join' && !role) {
        registerController(message);
      } else if (message.type === 'input' && role === 'controller') {
        forwardInput(message.input);
      }
    } catch {
      socket.close(WS_POLICY_VIOLATION, 'Invalid message');
    }
  });

  socket.on('close', () => {
    const room = relayRooms.get(roomId);
    if (!room) {
      return;
    }
    if (role === 'host') {
      sendMessage(room.controller, {type: 'disconnected'});
      room.controller?.close();
      relayRooms.delete(roomId);
    } else {
      room.controller = null;
      sendMessage(room.host, {type: 'disconnected'});
    }
  });

  socket.on('error', () => {});
}

attachRelay(new WebSocketServer({server, path: RELAY_PATH, maxPayload: MAX_RELAY_PAYLOAD}));

server.listen(port, '0.0.0.0', () => {
  console.log(`PISTA 84 · Local: http://localhost:${port}`);
  if (hostIp) {
    console.log(`Phone on the same network: http://${hostIp}:${port}`);
  }
});
