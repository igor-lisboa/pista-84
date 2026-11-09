import {loadSave} from './save.ts';
import type {SaveData} from './save.ts';

/** Replay-safe reconciliation: never add a balance twice after a lost response. */
export function mergeProgress(remote: SaveData | null, incoming: SaveData, playerId: string, username: string): SaveData {
  const local = loadSave({getItem: () => JSON.stringify(incoming)});
  const previous = remote ? loadSave({getItem: () => JSON.stringify(remote)}) : null;
  const latest = previous && previous.updatedAt > local.updatedAt ? previous : local;
  return {
    ...latest,
    playerId,
    username,
    // A guest merge preserves the larger wallet; later account snapshots retain spending.
    coins: previous && local.playerId === playerId ? latest.coins : Math.max(previous?.coins ?? 0, local.coins),
    best: Math.max(previous?.best ?? 0, local.best),
    bestScore: Math.max(previous?.bestScore ?? 0, local.bestScore),
    owned: [...new Set([...(previous?.owned ?? []), ...local.owned])],
    paints: [...new Set([...(previous?.paints ?? []), ...local.paints])],
    tutorialDone: !!previous?.tutorialDone || local.tutorialDone,
    history: [],
    createdAt: Math.min(previous?.createdAt ?? local.createdAt, local.createdAt),
    updatedAt: Math.max(previous?.updatedAt ?? 0, local.updatedAt),
  };
}

/**
 * Folds a save written by another tab (or a restore) into this tab's in-memory save before it writes,
 * so a late write such as the one on page exit never discards it. The later snapshot wins coins and
 * selections; records take the maximum and unlocks form a union. Identity, name and history stay ours.
 */
export function reconcileStoredSave(stored: SaveData, current: SaveData): SaveData {
  const latest = stored.updatedAt > current.updatedAt ? stored : current;
  return {
    ...latest,
    playerId: current.playerId,
    username: current.username,
    history: current.history,
    coins: latest.coins,
    best: Math.max(stored.best, current.best),
    bestScore: Math.max(stored.bestScore, current.bestScore),
    owned: [...new Set([...stored.owned, ...current.owned])],
    paints: [...new Set([...stored.paints, ...current.paints])],
    tutorialDone: stored.tutorialDone || current.tutorialDone,
    createdAt: Math.min(stored.createdAt, current.createdAt),
    updatedAt: Math.max(stored.updatedAt, current.updatedAt),
  };
}
