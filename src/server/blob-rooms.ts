import {BlobError, del, get, list, put} from '@vercel/blob';
import type {BlobEnv, BlobApi} from './blob-store.ts';
import type {RemoteInput, Room, RoomStore} from './signaling.ts';

/** The Blob calls pairing needs on top of `BlobApi`; a fake stands in for them in tests. */
export interface BlobRoomApi extends BlobApi {
  del(pathnames: string[], options: {token?: string; storeId?: string}): Promise<void>;
  list(options: {
    prefix: string;
    limit?: number;
    token?: string;
    storeId?: string;
  }): Promise<{blobs: {pathname: string; uploadedAt: Date}[]}>;
}

export interface BlobRoomOptions {
  now?: () => number;
  random?: () => number;
}

const ROOT = 'pista84/rooms';
/** How long an instance trusts what it read about a room, so a poll costs one read instead of three. */
const KNOWN_ROOM_MS = 5_000;
/** An unchanged command is not written again for this long (the main screen treats ~1.8 s of silence as a lost phone). */
const INPUT_REFRESH_MS = 800;
/** Chance that creating a room also sweeps up abandoned ones, and how old a room must be to count as abandoned. */
const SWEEP_CHANCE = 0.1;
const SWEEP_AGE_MS = 15 * 60 * 1000;

interface RoomBase {
  id: string;
  hostToken: string;
  joinToken: string;
  offer: string;
  expires: number;
}

interface StoredInput {
  input: string;
  time: number;
}

const alreadyExists = (error: unknown): boolean => error instanceof BlobError && /already exists/i.test(error.message);

/**
 * Pairing rooms in private Vercel Blobs, so every serverless instance sees the
 * same room (an in-memory room is lost whenever the phone's request lands on a
 * different instance). A room is three small objects: the fixed part (tokens,
 * offer), the answer (created once without overwrite, so exactly one phone can
 * take the room) and the latest controller command.
 *
 * Every Blob call is a billed operation, so the store spares them: fixed parts
 * are remembered for a few seconds, an unchanged command is not rewritten, and
 * the phone only talks to the server while the direct channel is down.
 * Returns `null` when no Blob token is configured.
 */
export function blobRoomStore(
  env: BlobEnv,
  api: BlobRoomApi = {get, put, del, list} as BlobRoomApi,
  {now = Date.now, random = Math.random}: BlobRoomOptions = {},
): RoomStore | null {
  const token = env.BLOB_STORAGE_READ_WRITE_TOKEN || env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const storeId = env.BLOB_STORAGE_STORE_ID || env.BLOB_STORE_ID;
  const credentials = {token, ...(storeId ? {storeId} : {})};

  const path = (id: string, part: 'base' | 'answer' | 'input') => `${ROOT}/${id}/${part}.json`;

  async function read<T>(pathname: string): Promise<T | null> {
    const result = await api.get(pathname, {access: 'private', useCache: false, ...credentials});
    if (!result || result.statusCode !== 200) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  }

  async function write(pathname: string, value: unknown, overwrite: boolean): Promise<void> {
    await api.put(pathname, JSON.stringify(value), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: overwrite,
      cacheControlMaxAge: 60,
      ...credentials,
    });
  }

  /** What this instance last learned about a room; the answer is only kept once it exists. */
  const known = new Map<string, {base: RoomBase; answer: string | null; at: number}>();
  const lastInput = new Map<string, {payload: string; time: number}>();

  /** Deletes rooms nobody closed. Best effort: a failed sweep must never fail a pairing. */
  async function sweep(): Promise<void> {
    try {
      const {blobs} = await api.list({prefix: `${ROOT}/`, limit: 300, ...credentials});
      const stale = blobs.filter((blob) => now() - blob.uploadedAt.getTime() > SWEEP_AGE_MS).map((blob) => blob.pathname);
      if (stale.length > 0) await api.del(stale, credentials);
    } catch {
      // Left for the next sweep.
    }
  }

  return {
    async create(room) {
      const {id, hostToken, joinToken, offer, expires} = room;
      await write(path(id, 'base'), {id, hostToken, joinToken, offer, expires} satisfies RoomBase, false);
      if (random() < SWEEP_CHANCE) await sweep();
    },

    async get(id) {
      const hit = known.get(id);
      const fresh = hit !== undefined && now() - hit.at < KNOWN_ROOM_MS;
      const base = fresh ? hit.base : await read<RoomBase>(path(id, 'base'));
      if (!base) {
        known.delete(id);
        return null;
      }
      const answer = hit?.answer ?? (await read<string>(path(id, 'answer')));
      const stored = await read<StoredInput>(path(id, 'input'));
      known.set(id, {base, answer, at: fresh ? hit.at : now()});

      const room: Room = {...base, answer};
      if (stored) {
        room.input = stored.input;
        room.inputTime = stored.time;
      }
      return room;
    },

    /** The answer is created without overwrite: if two phones race, only one write succeeds. */
    async answer(id, answer) {
      try {
        await write(path(id, 'answer'), answer, false);
        known.delete(id);
        return true;
      } catch (error) {
        if (alreadyExists(error)) return false;
        throw error;
      }
    },

    async remove(id) {
      known.delete(id);
      lastInput.delete(id);
      await api.del([path(id, 'base'), path(id, 'answer'), path(id, 'input')], credentials);
    },

    async input(id, input: RemoteInput, time) {
      const payload = JSON.stringify(input);
      const last = lastInput.get(id);
      // Holding a button or the wheel steady sends the same command ten times a second: write it once, then refresh.
      if (last && last.payload === payload && time - last.time < INPUT_REFRESH_MS) return;
      lastInput.set(id, {payload, time});
      await write(path(id, 'input'), {input: payload, time} satisfies StoredInput, true);
    },
  };
}
