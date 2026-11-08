import {loadSave} from '../game/save.ts';
import type {SaveData} from '../game/save.ts';
import {isPlayerId, normalizeUsername} from '../game/username.ts';
import {compareScores, pagination, leaderboardEntry} from './leaderboard.ts';

/**
 * Online data is split into scores and backups, keyed by permanent player GUID:
 *
 * - `scores`: one compact, always-sorted row per player. Every finished run
 *   touches only this, and the leaderboard reads only this.
 * - `backups`: the heavy per-player save files. Only the explicit cloud backup
 *   button touches it.
 *
 * Rows hang off the permanent GUID, so renaming never loses a score.
 */
export type StoreKey = 'scores' | 'backups' | 'device-backups';

/**
 * `playerId` scopes a read/update to one player. Score callbacks receive a
 * zero/one-row array; backup callbacks receive a zero/one-entry object.
 * Callbacks may be retried and must have no external side effects.
 */
export interface PlayerStore {
  read<T>(key: StoreKey, empty: T, playerId?: string): Promise<T>;
  update<T, R>(key: StoreKey, empty: T, change: (doc: T) => R, playerId: string): Promise<R>;
  rank(playerId: string): Promise<number>;
  leaderboard?(options: {page?: number; size?: number; playerId?: string | null}): Promise<LeaderboardPage>;
}

/** Raised when the backing store cannot take more data. */
export class StoreFullError extends Error {}

/**
 * `[guid, name, bestScore, bestDistanceMetres, achievedAt, createdAt, updatedAt]` — arrays keep the JSON
 * small. `achievedAt` is when the best score was set (the tie-break), `createdAt` the first submission and
 * `updatedAt` the last change. Rows written before the last two existed lack them.
 */
export type ScoreRow = [
  id: string,
  name: string,
  score: number,
  distance: number,
  achieved: number,
  created?: number,
  updated?: number,
];
/** Sorted best-first: higher score, then whoever got there earlier. */
export type ScoresDoc = ScoreRow[];

export interface Backup {
  revision: number;
  /** First backup of this player; absent on backups written before it was recorded. */
  created?: number;
  updated: number;
  save: SaveData;
}
export type BackupsDoc = Record<string, Backup>;

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  distance: number;
  /** True for the caller's own row. */
  mine: boolean;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  page: number;
  pages: number;
  size: number;
  total: number;
}

export interface ScoreSubmission {
  playerId: unknown;
  username: unknown;
  score: unknown;
  distance: unknown;
}

const MAX_SCORE = 10_000_000;
const MAX_DISTANCE_METRES = 10_000_000;
const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;

/** Puts `row` where it belongs in an already sorted list and returns its 1-based rank. */
function insertSorted(rows: ScoresDoc, row: ScoreRow): number {
  let index = rows.findIndex((other) => compareScores(row, other) < 0);
  if (index < 0) index = rows.length;
  rows.splice(index, 0, row);
  return index + 1;
}

/** Records a finished run. Returns `null` when the submission is malformed. */
export async function submitScore(store: PlayerStore, input: ScoreSubmission): Promise<{rank: number} | null> {
  const name = normalizeUsername(input.username);
  if (!isPlayerId(input.playerId) || name === null) return null;
  if (!isCount(input.score, MAX_SCORE) || !isCount(input.distance, MAX_DISTANCE_METRES)) return null;
  const playerId = input.playerId;
  const score = Math.floor(input.score);
  const distance = input.distance;
  if (score === 0) return {rank: 0};

  await store.update<ScoresDoc, void>('scores', [], (rows) => {
    const at = rows.findIndex((row) => row[0] === playerId);
    const [existing] = at >= 0 ? rows.splice(at, 1) : [];
    const now = Date.now();
    const improved = !existing || score > existing[2];
    const changed = improved || name !== existing[1] || distance > existing[3];
    const row: ScoreRow = [
      playerId,
      name,
      Math.max(score, existing?.[2] ?? 0),
      Math.max(distance, existing?.[3] ?? 0),
      // The tie-break clock only moves when the best score does.
      improved ? now : existing![4],
      existing?.[5] ?? existing?.[4] ?? now,
      // An identical resubmission leaves the row untouched, so nothing is written.
      changed ? now : (existing![6] ?? existing![4]),
    ];
    insertSorted(rows, row);
  }, playerId);
  return {rank: await store.rank(playerId)};
}

/** One page of the ranking. GUIDs are never included; `playerId` only marks the caller's row. */
export async function leaderboardPage(
  store: PlayerStore,
  options: {page?: number; size?: number; playerId?: string | null} = {},
): Promise<LeaderboardPage> {
  if (store.leaderboard) return store.leaderboard(options);
  const rows = await store.read<ScoresDoc>('scores', []);
  const paging = pagination(rows.length, options);
  const entries = rows.slice(paging.start, paging.start + paging.size).map((row, index) =>
    leaderboardEntry(row, paging.start + index + 1, options.playerId));
  const {page, pages, size, total} = paging;
  return {entries, page, pages, size, total};
}

export async function readBackup(
  store: PlayerStore,
  playerId: string,
  deviceId?: string,
): Promise<{save: SaveData | null; revision: number}> {
  const id = deviceId ? `${playerId}:${deviceId}` : playerId;
  const key = deviceId ? 'device-backups' : 'backups';
  const backup = (await store.read<BackupsDoc>(key, {}, id))[id];
  return {save: backup?.save ?? null, revision: backup?.revision ?? 0};
}

/**
 * Saves a progress backup if `revision` still matches. Returns the new
 * revision, or `null` when another device saved first. The same GUID keeps its
 * highest score, which is also published to the ranking.
 */
export async function writeBackup(
  store: PlayerStore,
  playerId: string,
  save: unknown,
  revision: number,
  deviceId?: string,
): Promise<{revision: number; updated: number} | null> {
  const clean = loadSave({getItem: () => JSON.stringify(save)});
  // The key is the identity: a backup can never claim another player's GUID.
  clean.playerId = playerId;
  const ranked = (await store.read<ScoresDoc>('scores', [], playerId))[0];
  if (ranked) {
    clean.bestScore = Math.max(clean.bestScore, ranked[2]);
    clean.best = Math.max(clean.best, ranked[3]);
  }

  const id = deviceId ? `${playerId}:${deviceId}` : playerId;
  const key = deviceId ? 'device-backups' : 'backups';
  const result = await store.update<BackupsDoc, {revision: number; updated: number} | null>(key, {}, (doc) => {
    const previous = doc[id];
    const current = previous?.revision ?? 0;
    if (current !== revision) return null;
    // A stale tab on this device must not replace newer offline progress.
    if (deviceId && previous && clean.updatedAt < previous.save.updatedAt) return null;
    const updated = Date.now();
    doc[id] = {revision: current + 1, created: previous?.created ?? previous?.updated ?? updated, updated, save: clean};
    return {revision: current + 1, updated};
  }, id);
  if (result && clean.username && clean.bestScore > 0) {
    await submitScore(store, {playerId, username: clean.username, score: clean.bestScore, distance: clean.best});
  }
  return result;
}
