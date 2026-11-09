import type {AccountStore} from './accounts.ts';
import {submitScore} from './players.ts';
import type {PlayerStore, ScoreRow, ScoresDoc} from './players.ts';

/** Same normalisation as account usernames: NFKC, trimmed, lower case. */
const nameKey = (name: string): string => name.normalize('NFKC').trim().toLowerCase();

/**
 * Moves a guest's ranking row onto the account before the guest row is deleted, so a score that was
 * higher than the account's (for example from a reset device) is never lost. Only a row with the account's
 * own name is touched: a GUID alone must not be enough to delete someone else's ranking row.
 */
export async function absorbGuestScore(
  store: PlayerStore,
  accountId: string,
  username: string,
  guestId: string,
): Promise<void> {
  const [guest] = await store.read<ScoresDoc>('scores', [], guestId);
  if (!guest || nameKey(guest[1]) !== nameKey(username)) return;
  await submitScore(store, {playerId: accountId, username, score: guest[2], distance: guest[3]});
  await store.removeScore(guestId);
}

/** How often a server instance may rescan the ranking for leftovers. */
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = 0;

/**
 * Removes guest ranking rows that duplicate a registered pilot. Before accounts existed, a pilot's
 * scores were stored under a guest GUID; after signup the same run appeared again under the account
 * GUID, so the leaderboard listed one pilot twice. A guest row is removed only when it has the account
 * name and is not better than the account row, which already holds the best result.
 * Returns how many rows were removed.
 */
export async function retireShadowScores(
  store: PlayerStore,
  accounts: AccountStore,
  now = Date.now(),
): Promise<number> {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return 0;
  lastCleanup = now;

  const rows = await store.read<ScoresDoc>('scores', []);
  const byName = new Map<string, ScoreRow[]>();
  for (const row of rows) {
    const key = nameKey(row[1]);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }

  let removed = 0;
  for (const [key, sameName] of byName) {
    if (sameName.length < 2) continue;
    const account = await accounts.findUsername(key);
    if (!account) continue;
    const accountRow = sameName.find((row) => row[0] === account.id);
    if (!accountRow) continue;
    for (const row of sameName) {
      const shadow = row[0] !== account.id && row[2] <= accountRow[2] && row[3] <= accountRow[3];
      if (!shadow) continue;
      await store.removeScore(row[0]);
      removed += 1;
    }
  }
  return removed;
}

/** For tests: forget the last scan so the next call runs immediately. */
export function resetScoreCleanupClock(): void {
  lastCleanup = 0;
}
