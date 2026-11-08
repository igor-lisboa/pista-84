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
