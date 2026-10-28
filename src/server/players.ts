import {loadSave} from '../game/save.ts';
import type {SaveData} from '../game/save.ts';
import {isPlayerId, normalizeUsername} from '../game/username.ts';

/** One player as stored online; scores and the backup hang off the permanent GUID. */
export interface PlayerRecord {
  /** Current display name; the GUID key never changes, so renaming keeps every score. */
  name: string;
  bestScore: number;
  /** Best distance in metres. */
  bestDistance: number;
  updated: number;
  /** Optimistic-concurrency counter for the cloud backup. */
  revision: number;
  progress: SaveData | null;
}

/** The whole online state: every player, keyed by GUID. */
export type PlayersDoc = Record<string, PlayerRecord>;

/**
 * Where the players document lives. `update` runs `change` against the
 * freshest document and persists the result; a database-backed store can make
 * that atomic, the Global Config one is last-writer-wins (see docs/TECH-DEBT.md).
 */
export interface PlayerStore {
  read(): Promise<PlayersDoc>;
  update<T>(change: (doc: PlayersDoc) => T): Promise<T>;
}

/** Raised when the backing store cannot take more data. */
export class StoreFullError extends Error {}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  distance: number;
}

export interface ScoreSubmission {
  playerId: unknown;
  username: unknown;
  score: unknown;
  distance: unknown;
}

const MAX_SCORE = 10_000_000;
const MAX_DISTANCE_METRES = 10_000_000;
export const LEADERBOARD_LIMIT = 50;

export function memoryPlayerStore(initial: PlayersDoc = {}): PlayerStore {
  let doc = structuredClone(initial);
  return {
    async read() {
      return structuredClone(doc);
    },
    async update(change) {
      const draft = structuredClone(doc);
      const result = change(draft);
      doc = draft;
      return result;
    },
  };
}

const blankRecord = (name: string): PlayerRecord => ({
  name,
  bestScore: 0,
  bestDistance: 0,
  updated: 0,
  revision: 0,
  progress: null,
});

const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;

const ranked = (doc: PlayersDoc): [string, PlayerRecord][] =>
  Object.entries(doc)
    .filter(([, record]) => record.bestScore > 0)
    .sort(([, a], [, b]) => b.bestScore - a.bestScore || a.updated - b.updated);

const rankOf = (doc: PlayersDoc, playerId: string): number => ranked(doc).findIndex(([id]) => id === playerId) + 1;

/** Records a finished run. Returns `null` when the submission is malformed. */
export async function submitScore(store: PlayerStore, input: ScoreSubmission): Promise<{rank: number} | null> {
  const name = normalizeUsername(input.username);
  if (!isPlayerId(input.playerId) || name === null) return null;
  if (!isCount(input.score, MAX_SCORE) || !isCount(input.distance, MAX_DISTANCE_METRES)) return null;
  const playerId = input.playerId;
  const score = Math.floor(input.score);
  const distance = input.distance;

  return store.update((doc) => {
    const record = (doc[playerId] ??= blankRecord(name));
    record.name = name;
    record.bestScore = Math.max(record.bestScore, score);
    record.bestDistance = Math.max(record.bestDistance, distance);
    record.updated = Date.now();
    return {rank: rankOf(doc, playerId)};
  });
}

/** Top players by best score. GUIDs are never included. */
export async function leaderboard(store: PlayerStore, limit = LEADERBOARD_LIMIT): Promise<LeaderboardEntry[]> {
  const doc = await store.read();
  return ranked(doc)
    .slice(0, limit)
    .map(([, record], index) => ({
      rank: index + 1,
      name: record.name,
      score: record.bestScore,
      distance: record.bestDistance,
    }));
}

export async function readBackup(
  store: PlayerStore,
  playerId: string,
): Promise<{save: SaveData | null; revision: number}> {
  const record = (await store.read())[playerId];
  return {save: record?.progress ?? null, revision: record?.revision ?? 0};
}

/**
 * Saves a progress backup if `revision` still matches. Returns the new
 * revision, or `null` when another device saved first.
 */
export async function writeBackup(
  store: PlayerStore,
  playerId: string,
  save: unknown,
  revision: number,
): Promise<{revision: number; updated: number} | null> {
  const clean = loadSave({getItem: () => JSON.stringify(save)});
  // The key is the identity: a backup can never claim another player's GUID.
  clean.playerId = playerId;
  return store.update((doc) => {
    const current = doc[playerId]?.revision ?? 0;
    if (current !== revision) return null;
    const record = (doc[playerId] ??= blankRecord(clean.username ?? 'player'));
    if (clean.username) record.name = clean.username;
    // Same GUID on both sides: the highest score and distance always win.
    clean.bestScore = Math.max(clean.bestScore, record.bestScore);
    clean.best = Math.max(clean.best, record.bestDistance);
    record.bestScore = clean.bestScore;
    record.bestDistance = clean.best;
    record.progress = clean;
    record.revision = current + 1;
    record.updated = Date.now();
    return {revision: record.revision, updated: record.updated};
  });
}
