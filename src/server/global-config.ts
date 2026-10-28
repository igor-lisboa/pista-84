import {createClient} from '@vercel/global-config';
import {StoreFullError} from './players.ts';
import type {PlayerStore, StoreKey} from './players.ts';

const API = 'https://api.vercel.com/v1/edge-config';
const DEFAULT_MAX_BYTES = 8_000;

/** Global Config item names, one per document (see `StoreKey`). */
const ITEM: Record<StoreKey, string> = {scores: 'scores', backups: 'backups'};

export type GlobalConfigEnv = {
  /** Connection string Vercel injects, e.g. `https://edge-config.vercel.com/ecfg_xxx?token=yyy`. */
  GLOBAL_CONFIG?: string;
  /** Vercel API token with write access; Global Config cannot be written with the read token. */
  VERCEL_API_TOKEN?: string;
  VERCEL_TEAM_ID?: string;
  /** Refuse writes of a document above this many bytes (plan limits: roughly 8 KB hobby, 64 KB pro). */
  GLOBAL_CONFIG_MAX_BYTES?: string;
};

const configIdOf = (connection: string): string => new URL(connection).pathname.split('/').filter(Boolean).pop() ?? '';

/**
 * Keeps each document in its own Global Config item. Reads go through the fast
 * edge SDK; read-modify-write cycles re-read through the management API so they
 * do not start from a stale edge copy, and unchanged documents are never
 * written back. Returns `null` when the connection string or write token is
 * not configured.
 *
 * TECH DEBT: whole-document rewrites, last writer wins, tiny size cap. See
 * docs/TECH-DEBT.md before putting real traffic on this.
 */
export function globalConfigStore(env: GlobalConfigEnv): PlayerStore | null {
  const connection = env.GLOBAL_CONFIG;
  const token = env.VERCEL_API_TOKEN;
  if (!connection || !token) return null;

  const client = createClient(connection);
  const configId = configIdOf(connection);
  const maxBytes = Number(env.GLOBAL_CONFIG_MAX_BYTES) || DEFAULT_MAX_BYTES;
  const team = env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}` : '';
  const headers = {authorization: `Bearer ${token}`, 'content-type': 'application/json'};

  async function readFresh<T>(key: StoreKey, empty: T): Promise<T> {
    const response = await fetch(`${API}/${configId}/item/${ITEM[key]}${team}`, {headers});
    if (response.status === 404) return empty;
    if (!response.ok) throw new Error(`Global Config read failed (${response.status}).`);
    const body = (await response.json()) as {value?: T} | T | null;
    const value = body && typeof body === 'object' && !Array.isArray(body) && 'value' in body ? body.value : body;
    return (value ?? empty) as T;
  }

  return {
    async read<T>(key: StoreKey, empty: T) {
      return ((await client.get<T>(ITEM[key])) ?? empty) as T;
    },
    async update<T, R>(key: StoreKey, empty: T, change: (doc: T) => R) {
      const doc = await readFresh(key, empty);
      const snapshot = JSON.stringify(doc);
      const result = change(doc);
      const next = JSON.stringify(doc);
      if (next === snapshot) return result;
      if (next.length > maxBytes) throw new StoreFullError('The online storage is full.');
      const response = await fetch(`${API}/${configId}/items${team}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({items: [{operation: 'upsert', key: ITEM[key], value: doc}]}),
      });
      if (!response.ok) throw new Error(`Global Config write failed (${response.status}).`);
      return result;
    },
  };
}
