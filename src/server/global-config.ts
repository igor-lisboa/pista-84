import {createClient} from '@vercel/global-config';
import {StoreFullError} from './players.ts';
import type {PlayerStore, PlayersDoc} from './players.ts';

/** Key inside Global Config that holds the single JSON document for every player. */
export const PLAYERS_KEY = 'players';
const DEFAULT_MAX_BYTES = 8_000;
const API = 'https://api.vercel.com/v1/edge-config';

export type GlobalConfigEnv = {
  /** Connection string Vercel injects, e.g. `https://edge-config.vercel.com/ecfg_xxx?token=yyy`. */
  GLOBAL_CONFIG?: string;
  /** Vercel API token with write access; Global Config cannot be written with the read token. */
  VERCEL_API_TOKEN?: string;
  VERCEL_TEAM_ID?: string;
  /** Refuse writes above this many bytes (plan limits: roughly 8 KB hobby, 64 KB pro). */
  GLOBAL_CONFIG_MAX_BYTES?: string;
};

const configIdOf = (connection: string): string => new URL(connection).pathname.split('/').filter(Boolean).pop() ?? '';

/**
 * Stores every player in one Global Config item. Reads go through the fast
 * edge SDK; read-modify-write cycles re-read through the management API so
 * they do not start from a stale edge copy. Returns `null` when the
 * connection string or write token is not configured.
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

  async function readFresh(): Promise<PlayersDoc> {
    const response = await fetch(`${API}/${configId}/item/${PLAYERS_KEY}${team}`, {headers});
    if (response.status === 404) return {};
    if (!response.ok) throw new Error(`Global Config read failed (${response.status}).`);
    const body = (await response.json()) as {value?: PlayersDoc} | PlayersDoc | null;
    const value = body && typeof body === 'object' && 'value' in body ? body.value : body;
    return value && typeof value === 'object' ? (value as PlayersDoc) : {};
  }

  return {
    async read() {
      return ((await client.get<PlayersDoc>(PLAYERS_KEY)) ?? {}) as PlayersDoc;
    },
    async update(change) {
      const doc = await readFresh();
      const result = change(doc);
      if (JSON.stringify(doc).length > maxBytes) throw new StoreFullError('The online storage is full.');
      const response = await fetch(`${API}/${configId}/items${team}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({items: [{operation: 'upsert', key: PLAYERS_KEY, value: doc}]}),
      });
      if (!response.ok) throw new Error(`Global Config write failed (${response.status}).`);
      return result;
    },
  };
}
