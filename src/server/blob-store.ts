import {BlobError, BlobPreconditionFailedError, get, put} from '@vercel/blob';
import type {GetBlobResult, GetCommandOptions, PutCommandOptions} from '@vercel/blob';
import {StoreFullError} from './players.ts';
import type {PlayerStore, StoreKey} from './players.ts';

/** One private JSON blob per document (see `StoreKey`). */
const PATHNAME: Record<StoreKey, string> = {
  scores: 'pista84/scores.json',
  backups: 'pista84/backups.json',
};

/** A document is re-uploaded whole on every change, so keep it well inside what one request can carry. */
const MAX_DOCUMENT_BYTES = 4_000_000;
/** How many times a write is retried after another writer got in first. */
const MAX_ATTEMPTS = 8;
/** Reads are served from memory this long, which spares simple operations on the free plan. */
const DEFAULT_READ_CACHE_MS = 10_000;

export type BlobEnv = {
  /** Read-write token of the Blob store; the store was created with the `BLOB_STORAGE` prefix. */
  BLOB_STORAGE_READ_WRITE_TOKEN?: string;
  BLOB_STORAGE_STORE_ID?: string;
  /** Names Vercel uses when a store is connected without a custom prefix. */
  BLOB_READ_WRITE_TOKEN?: string;
  BLOB_STORE_ID?: string;
};

/** The two Blob calls the store needs; a fake stands in for them in tests. */
export interface BlobApi {
  get(pathname: string, options: GetCommandOptions): Promise<GetBlobResult | null>;
  put(pathname: string, body: string, options: PutCommandOptions): Promise<unknown>;
}

export interface BlobStoreOptions {
  readCacheMs?: number;
  now?: () => number;
  /** Pause before retrying a lost write race; tests make it instant. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Another writer got in first. The service reports that as a stale ETag, as an
 * already-existing blob, or (for writes in flight at the same moment) as a
 * generic error about a conflicting operation.
 */
const isWriteConflict = (error: unknown): boolean =>
  error instanceof BlobPreconditionFailedError ||
  (error instanceof BlobError && /already exists|conditional request cannot succeed|conflicting operation/i.test(error.message));

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keeps each document in its own private Vercel Blob. Changes are conditional
 * on the blob's ETag and retried, so two writers can never silently overwrite
 * each other; unchanged documents are never uploaded. Returns `null` when no
 * token is configured.
 *
 * TECH DEBT: whole-document rewrites that cost one write operation each. See
 * docs/TECH-DEBT.md before putting real traffic on this.
 */
export function blobStore(
  env: BlobEnv,
  api: BlobApi = {get, put},
  {readCacheMs = DEFAULT_READ_CACHE_MS, now = Date.now, sleep = pause}: BlobStoreOptions = {},
): PlayerStore | null {
  const token = env.BLOB_STORAGE_READ_WRITE_TOKEN || env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const storeId = env.BLOB_STORAGE_STORE_ID || env.BLOB_STORE_ID;
  const credentials = {token, ...(storeId ? {storeId} : {})};
  const cache = new Map<StoreKey, {doc: unknown; at: number}>();

  /** The newest copy straight from storage, with the ETag a conditional write needs. */
  async function load<T>(key: StoreKey): Promise<{doc: T; etag: string} | null> {
    const result = await api.get(PATHNAME[key], {access: 'private', useCache: false, ...credentials});
    if (!result || result.statusCode !== 200) return null;
    return {doc: JSON.parse(await new Response(result.stream).text()) as T, etag: result.blob.etag};
  }

  return {
    async read<T>(key: StoreKey, empty: T) {
      const cached = cache.get(key);
      if (cached && now() - cached.at < readCacheMs) return cached.doc as T;
      const result = await api.get(PATHNAME[key], {access: 'private', ...credentials});
      const doc =
        result && result.statusCode === 200 ? (JSON.parse(await new Response(result.stream).text()) as T) : empty;
      cache.set(key, {doc, at: now()});
      return doc;
    },

    async update<T, R>(key: StoreKey, empty: T, change: (doc: T) => R) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const current = await load<T>(key);
        const doc = current?.doc ?? (JSON.parse(JSON.stringify(empty)) as T);
        const snapshot = JSON.stringify(doc);
        const result = change(doc);
        const next = JSON.stringify(doc);
        if (next === snapshot) return result;
        if (next.length > MAX_DOCUMENT_BYTES) throw new StoreFullError('The online storage is full.');
        try {
          await api.put(PATHNAME[key], next, {
            access: 'private',
            contentType: 'application/json',
            // Only overwrite the exact version this change was computed from.
            ...(current ? {ifMatch: current.etag} : {}),
            cacheControlMaxAge: 60,
            ...credentials,
          });
        } catch (error) {
          // Someone else wrote (or created the blob) first: recompute from their version,
          // after a random pause so simultaneous writers stop colliding in lockstep.
          if (!isWriteConflict(error)) throw error;
          await sleep(Math.random() * 80 * (attempt + 1));
          continue;
        }
        cache.set(key, {doc, at: now()});
        return result;
      }
      throw new Error('Online storage is busy: too many simultaneous writes.');
    },
  };
}
