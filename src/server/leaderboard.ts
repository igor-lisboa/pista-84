import type {LeaderboardEntry, ScoreRow} from './players.ts';

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;

export interface PageOptions {
  page?: number;
  size?: number;
  playerId?: string | null;
}

/** Shared rules keep test storage and MongoDB pagination consistent. */
export function pagination(total: number, options: PageOptions) {
  const requestedSize = Math.floor(options.size ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedSize));
  const pages = Math.max(1, Math.ceil(total / size));
  const requestedPage = Math.floor(options.page ?? 1) || 1;
  const page = Math.min(pages, Math.max(1, requestedPage));
  return {page, pages, size, total, start: (page - 1) * size};
}

export function compareScores(a: ScoreRow, b: ScoreRow): number {
  const scoreOrder = b[2] - a[2];
  if (scoreOrder !== 0) return scoreOrder;
  const achievementOrder = a[4] - b[4];
  if (achievementOrder !== 0) return achievementOrder;
  if (a[0] === b[0]) return 0;
  return a[0] < b[0] ? -1 : 1;
}

/** Public responses expose only the caller's own-row marker, never player IDs. */
export function leaderboardEntry(row: ScoreRow, rank: number, playerId?: string | null): LeaderboardEntry {
  const [id, name, score, distance] = row;
  return {rank, name, score, distance, mine: id === playerId};
}
