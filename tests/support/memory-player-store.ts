import type {PlayerStore, StoreKey, ScoresDoc, BackupsDoc} from '../../src/server/players.ts';
import {compareScores} from '../../src/server/leaderboard.ts';

/** Isolated test storage. Never used by the application runtime. */
export function memoryPlayerStore(): PlayerStore {
  const docs = new Map<StoreKey, unknown>();
  const read = <T>(key: StoreKey, empty: T, playerId?: string): T => {
    const doc = docs.get(key);
    if (!playerId) return structuredClone((doc as T | undefined) ?? empty);
    if (key === 'scores') {
      const rows = (doc as ScoresDoc | undefined) ?? [];
      return structuredClone(rows.filter((row) => row[0] === playerId)) as T;
    }
    const backup = (doc as BackupsDoc | undefined)?.[playerId];
    return structuredClone(backup ? {[playerId]: backup} : empty) as T;
  };
  return {
    async read<T>(key: StoreKey, empty: T, playerId?: string) { return read(key, empty, playerId); },
    async update<T, R>(key: StoreKey, empty: T, change: (doc: T) => R, playerId: string) {
      const draft = read<T>(key, empty, playerId);
      const result = change(draft);
      if (key === 'scores') {
        const rows = ((docs.get(key) ?? []) as ScoresDoc).filter((row) => row[0] !== playerId);
        rows.push(...draft as ScoresDoc);
        rows.sort(compareScores);
        docs.set(key, rows);
      } else {
        docs.set(key, {...docs.get(key) as BackupsDoc, ...draft as BackupsDoc});
      }
      return result;
    },
    async rank(playerId) {
      return ((docs.get('scores') ?? []) as ScoresDoc).findIndex((row) => row[0] === playerId) + 1;
    },
    async removeScore(playerId) {
      docs.set('scores', ((docs.get('scores') ?? []) as ScoresDoc).filter((row) => row[0] !== playerId));
    },
  };
}

