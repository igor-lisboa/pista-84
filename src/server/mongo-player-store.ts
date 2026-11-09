import type {Collection} from 'mongodb';
import type {LeaderboardPage, PlayerStore, ScoresDoc, StoreKey} from './players.ts';
import {pagination, leaderboardEntry} from './leaderboard.ts';

export interface PlayerRecord {
  _id: string;
  version: number;
  value: unknown;
  score?: number;
  achieved?: number;
}

const MAX_WRITE_ATTEMPTS = 12;

/** Per-player compare-and-swap; unrelated players never contend on one document. */
export function mongoPlayerStore(collection: (key: StoreKey) => Promise<Collection<PlayerRecord>>): PlayerStore {
  const order = {score: -1, achieved: 1, _id: 1} as const;
  return {
    async read<T>(key: StoreKey, empty: T, playerId?: string): Promise<T> {
      const records = await collection(key);
      if (playerId) return ((await records.findOne({_id: playerId}))?.value as T | undefined) ?? structuredClone(empty);
      if (key !== 'scores') throw new Error('Backup reads require a player id.');
      return (await records.find().sort(order).toArray()).flatMap((doc) => doc.value as ScoresDoc) as T;
    },
    async update<T, R>(key: StoreKey, empty: T, change: (doc: T) => R, playerId: string): Promise<R> {
      if (!playerId) throw new Error('Writes require a player id.');
      const records = await collection(key);
      for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
        const current = await records.findOne({_id: playerId});
        const value = structuredClone((current?.value as T | undefined) ?? empty);
        const before = JSON.stringify(value);
        const result = change(value);
        if (JSON.stringify(value) === before) return result;
        const row = key === 'scores' ? (value as ScoresDoc)[0] : undefined;
        const next: PlayerRecord = {_id: playerId, version: (current?.version ?? 0) + 1, value,
          ...(row ? {score: row[2], achieved: row[4]} : {})};
        if (current) {
          if ((await records.replaceOne({_id: playerId, version: current.version}, next)).matchedCount) return result;
        } else {
          try {
            await records.insertOne(next);
            return result;
          } catch (error) {
            // Another instance may have inserted this player's first record.
            if ((error as {code?: number}).code !== 11000) throw error;
          }
        }
      }
      throw new Error('Online storage is busy.');
    },
    async rank(playerId) {
      const records = await collection('scores');
      const row = await records.findOne({_id: playerId});
      if (!row) return 0;
      return 1 + await records.countDocuments({$or: [
        {score: {$gt: row.score}},
        {score: row.score, achieved: {$lt: row.achieved}},
        {score: row.score, achieved: row.achieved, _id: {$lt: playerId}},
      ]});
    },
    async removeScore(playerId: string): Promise<void> {
      await (await collection('scores')).deleteOne({_id: playerId});
    },
    async leaderboard(options): Promise<LeaderboardPage> {
      const records = await collection('scores');
      const total = await records.countDocuments();
      const {page, pages, size, start} = pagination(total, options);
      const rows = await records.find().sort(order).skip(start).limit(size).toArray();
      const entries = rows.map((doc, index) => {
        const row = (doc.value as ScoresDoc)[0]!;
        return leaderboardEntry(row, start + index + 1, options.playerId);
      });
      return {entries, page, pages, size, total};
    },
  };
}
