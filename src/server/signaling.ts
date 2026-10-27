// Shared by the Node preview and the Cloudflare Worker. No gameplay data is stored.
import type {D1Like} from './d1.ts';

export interface RemoteInput {
  steer: number;
  accelerate: boolean;
  brake: boolean;
  start: boolean;
  pause: boolean;
}

export interface Room {
  id: string;
  hostToken: string;
  joinToken: string;
  offer: string;
  answer: string | null;
  expires: number;
  /** JSON-encoded {@link RemoteInput}. */
  input?: string | null;
  inputTime?: number;
}

export interface RoomStore {
  create(room: Room): Promise<void>;
  get(id: string): Promise<Room | null | undefined>;
  answer(id: string, answer: string): Promise<boolean>;
  remove(id: string): Promise<void>;
  input(id: string, input: RemoteInput, time: number): Promise<void>;
}

const ROOM_ROUTE = /^\/api\/rooms(?:\/([a-f0-9]{48}))?(\/input)?$/;
const ROOM_TTL_MS = 10 * 60 * 1000;
const MAX_ROOMS_IN_MEMORY = 500;
const MAX_SDP_LENGTH = 20_000;
const MAX_SDP_BODY = 24_000;
const MAX_INPUT_BODY = 1_000;
const MIN_INPUT_INTERVAL_MS = 70;
const TOKEN_BYTES = 24;
const ALLOWED_METHODS = ['GET', 'POST', 'DELETE'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json', 'cache-control': 'no-store'},
  });
}

function fail(message: string, status: number): Response {
  return json({error: message}, status);
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Coerces untrusted controller input into a well-formed command. */
export function sanitizeInput(raw: unknown): RemoteInput {
  const input = (raw ?? {}) as Record<string, unknown>;
  const steer = input.steer;
  return {
    steer: typeof steer === 'number' && Number.isFinite(steer) ? Math.max(-1, Math.min(1, steer)) : 0,
    accelerate: input.accelerate === true,
    brake: input.brake === true,
    start: input.start === true,
    pause: input.pause === true,
  };
}

async function createRoom(request: Request, store: RoomStore): Promise<Response> {
  const body = await request.text();
  if (body.length > MAX_SDP_BODY) {
    return fail('Offer too large.', 413);
  }
  const {offer} = JSON.parse(body) as {offer?: unknown};
  if (typeof offer !== 'string' || offer.length > MAX_SDP_LENGTH) {
    return fail('Invalid offer.', 400);
  }
  const id = randomToken();
  const hostToken = randomToken();
  const joinToken = randomToken();
  const expires = Date.now() + ROOM_TTL_MS;
  await store.create({id, hostToken, joinToken, offer, answer: null, expires});
  return json({id, hostToken, joinToken, expires}, 201);
}

async function postInput(request: Request, store: RoomStore, room: Room, isHost: boolean): Promise<Response> {
  if (request.method !== 'POST' || isHost || !room.answer) {
    return fail('Controller not authorized.', 403);
  }
  const body = await request.text();
  if (body.length > MAX_INPUT_BODY) {
    return fail('Command too large.', 413);
  }
  const data = JSON.parse(body) as {input?: unknown};
  const now = Date.now();
  if (room.inputTime && now - room.inputTime < MIN_INPUT_INTERVAL_MS) {
    return json({ok: true, throttled: true});
  }
  await store.input(room.id, sanitizeInput(data.input), now);
  return json({ok: true});
}

function describeRoom(room: Room, isHost: boolean): Response {
  if (isHost) {
    return json({
      answer: room.answer,
      expires: room.expires,
      input: room.input ? JSON.parse(room.input) : null,
      inputTime: room.inputTime || 0,
    });
  }
  return json({offer: room.offer, answered: !!room.answer, expires: room.expires});
}

async function postAnswer(request: Request, store: RoomStore, id: string): Promise<Response> {
  const body = await request.text();
  if (body.length > MAX_SDP_BODY) {
    return fail('Answer too large.', 413);
  }
  const {answer} = JSON.parse(body) as {answer?: unknown};
  if (typeof answer !== 'string' || answer.length > MAX_SDP_LENGTH) {
    return fail('Invalid answer.', 400);
  }
  const accepted = await store.answer(id, answer);
  return accepted ? json({ok: true}) : fail('Room already occupied. Generate a new QR code.', 409);
}

async function handleExistingRoom(
  request: Request,
  store: RoomStore,
  id: string,
  isInputRoute: boolean,
): Promise<Response> {
  const authorization = request.headers.get('authorization')?.replace(/^Bearer /, '');
  const room = await store.get(id);
  if (!room || room.expires < Date.now()) {
    return fail('Room expired. Generate a new QR code.', 410);
  }
  const isHost = authorization === room.hostToken;
  const isController = authorization === room.joinToken;
  if (!isHost && !isController) {
    return fail('Invalid code.', 403);
  }
  if (isInputRoute) {
    return postInput(request, store, room, isHost);
  }
  if (request.method === 'GET') {
    return describeRoom(room, isHost);
  }
  if (request.method === 'DELETE') {
    if (!isHost) {
      return fail('Only the main screen can close the room.', 403);
    }
    await store.remove(id);
    return json({ok: true});
  }
  if (isHost) {
    return fail('The main screen cannot answer its own offer.', 403);
  }
  return postAnswer(request, store, id);
}

export async function signaling(request: Request, store: RoomStore): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(ROOM_ROUTE);
  if (!match) {
    return fail('Invalid route.', 404);
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    return fail('Invalid origin.', 403);
  }
  if (!ALLOWED_METHODS.includes(request.method)) {
    return fail('Invalid method.', 405);
  }
  try {
    const id = match[1];
    if (request.method === 'POST' && !id) {
      return await createRoom(request, store);
    }
    if (!id) {
      return fail('Room not found.', 404);
    }
    return await handleExistingRoom(request, store, id, Boolean(match[2]));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail('Invalid JSON.', 400);
    }
    console.error('signaling failure', error instanceof Error ? error.name : 'unknown');
    return fail('Service temporarily unavailable.', 503);
  }
}

interface RoomRow {
  id: string;
  host_token: string;
  join_token: string;
  offer: string;
  answer: string | null;
  expires: number;
  input: string | null;
  input_time: number;
}

function roomFromRow(row: RoomRow): Room {
  return {
    id: row.id,
    hostToken: row.host_token,
    joinToken: row.join_token,
    offer: row.offer,
    answer: row.answer,
    expires: row.expires,
    input: row.input,
    inputTime: row.input_time,
  };
}

export function d1Store(db: D1Like): RoomStore {
  return {
    async create(room) {
      await db.prepare('DELETE FROM control_rooms WHERE expires < ?').bind(Date.now()).run();
      await db
        .prepare('INSERT INTO control_rooms (id, host_token, join_token, offer, expires) VALUES (?, ?, ?, ?, ?)')
        .bind(room.id, room.hostToken, room.joinToken, room.offer, room.expires)
        .run();
    },
    async get(id) {
      const row = await db.prepare('SELECT * FROM control_rooms WHERE id = ?').bind(id).first<RoomRow>();
      return row ? roomFromRow(row) : null;
    },
    async answer(id, answer) {
      const result = await db
        .prepare('UPDATE control_rooms SET answer = ? WHERE id = ? AND answer IS NULL')
        .bind(answer, id)
        .run();
      return result.meta.changes === 1;
    },
    async remove(id) {
      await db.prepare('DELETE FROM control_rooms WHERE id = ?').bind(id).run();
    },
    async input(id, input, time) {
      await db
        .prepare('UPDATE control_rooms SET input = ?, input_time = ? WHERE id = ?')
        .bind(JSON.stringify(input), time, id)
        .run();
    },
  };
}

export function memoryStore(): RoomStore {
  const rooms = new Map<string, Room>();
  return {
    async create(room) {
      for (const [id, existing] of rooms) {
        if (existing.expires < Date.now()) {
          rooms.delete(id);
        }
      }
      if (rooms.size >= MAX_ROOMS_IN_MEMORY) {
        throw new Error('Capacity');
      }
      rooms.set(room.id, room);
    },
    async get(id) {
      return rooms.get(id);
    },
    async answer(id, answer) {
      const room = rooms.get(id);
      if (!room || room.answer) {
        return false;
      }
      room.answer = answer;
      return true;
    },
    async remove(id) {
      rooms.delete(id);
    },
    async input(id, input, time) {
      const room = rooms.get(id);
      if (room) {
        room.input = JSON.stringify(input);
        room.inputTime = time;
      }
    },
  };
}
