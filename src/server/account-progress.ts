import {mergeProgress} from '../game/merge-progress.ts';
import {loadSave} from '../game/save.ts';
import type {SaveData} from '../game/save.ts';
import type {AccountUser} from './accounts.ts';
import {submitScore} from './players.ts';
import type {BackupsDoc, PlayerStore, ScoresDoc} from './players.ts';

/** Separate from manual backups and device snapshots; CAS retries merge competing devices. */
export async function syncAccountProgress(store: PlayerStore, user: AccountUser, incoming: unknown): Promise<SaveData> {
  const local = loadSave({getItem: () => JSON.stringify(incoming)});
  const ranked = (await store.read<ScoresDoc>('scores', [], user.id))[0];
  if (ranked) {
    local.bestScore = Math.max(local.bestScore, ranked[2]);
    local.best = Math.max(local.best, ranked[3]);
  }
  const save = await store.update<BackupsDoc, SaveData>('account-progress', {}, (doc) => {
    const previous = doc[user.id];
    const merged = mergeProgress(previous?.save ?? null, local, user.id, user.username);
    const now = Date.now();
    doc[user.id] = {revision: (previous?.revision ?? 0) + 1,
      created: previous?.created ?? now, updated: now, save: merged};
    return merged;
  }, user.id);
  await submitScore(store, {playerId: user.id, username: user.username, score: save.bestScore, distance: save.best});
  return save;
}
