import { isPlayerId, newPlayerId, normalizeUsername } from './username.ts';
import { CARS, DEFAULT_CAR_ID, DEFAULT_PAINT_ID, PAINTS } from './cars.ts';

export const SAVE_KEY = 'pista84';

export interface SaveData {
  version: 2;
  coins: number;
  /** Best distance in metres. */
  best: number;
  bestScore: number;
  owned: string[];
  selected: string;
  paints: string[];
  paint: string;
  sound: boolean;
  /** Chosen UI language, or `null` to follow the browser. */
  lang: string | null;
  /** Leaderboard name chosen on first launch, or `null` until the player picks one. */
  username: string | null;
  /** Permanent GUID that scores are attached to; the username may change, this never does. */
  playerId: string;
}

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BalanceConfig {
  readonly coins: number | null;
}

const nonNegative = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;

const keepKnown = (ids: unknown, known: readonly string[]): string[] =>
  Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && known.includes(id)) : [];

export function defaultSave(): SaveData {
  return {
    version: 2,
    coins: 0,
    best: 0,
    bestScore: 0,
    owned: [DEFAULT_CAR_ID],
    selected: DEFAULT_CAR_ID,
    paints: [DEFAULT_PAINT_ID],
    paint: DEFAULT_PAINT_ID,
    sound: true,
    lang: null,
    username: null,
    playerId: newPlayerId(),
  };
}

/**
 * Reads and sanitises saved progress. Corrupt or hostile data falls back to
 * defaults; a configured balance overrides whatever coins were stored.
 */
export function loadSave(storage: Pick<SaveStorage, 'getItem'>, config: BalanceConfig = { coins: null }): SaveData {
  const fallback = defaultSave();
  const override = config.coins !== null && Number.isSafeInteger(config.coins) && config.coins >= 0 ? config.coins : null;
  if (override !== null) fallback.coins = override;

  try {
    const raw: unknown = JSON.parse(storage.getItem(SAVE_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return fallback;
    const saved = raw as Record<string, unknown>;

    const owned = [...new Set([DEFAULT_CAR_ID, ...keepKnown(saved.owned, CARS.map((car) => car.id))])];
    const paints = [...new Set([DEFAULT_PAINT_ID, ...keepKnown(saved.paints, PAINTS.map((paint) => paint.id))])];
    const selected = typeof saved.selected === 'string' && owned.includes(saved.selected) ? saved.selected : DEFAULT_CAR_ID;
    const paint = typeof saved.paint === 'string' && paints.includes(saved.paint) ? saved.paint : DEFAULT_PAINT_ID;

    return {
      ...fallback,
      coins: override ?? Math.floor(nonNegative(saved.coins)),
      best: nonNegative(saved.best),
      bestScore: Math.floor(nonNegative(saved.bestScore)),
      owned,
      selected,
      paints,
      paint,
      sound: saved.sound !== false,
      lang: typeof saved.lang === 'string' ? saved.lang : null,
      username: normalizeUsername(saved.username),
      playerId: isPlayerId(saved.playerId) ? saved.playerId : fallback.playerId,
    };
  } catch {
    return fallback;
  }
}

/**
 * Applies an imported or restored save over the current one. Everything is
 * replaced, name and GUID included, with two exceptions: a file that carries no
 * identity (older exports) keeps the current one, and when the GUID is the same
 * the highest score and distance of the two are kept.
 */
export function importSave(current: SaveData, serialized: string, config: BalanceConfig = { coins: null }): SaveData {
  const imported = loadSave({ getItem: () => serialized }, config);
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (parsed && typeof parsed === 'object') raw = parsed as Record<string, unknown>;
  } catch {
    // loadSave already fell back to defaults.
  }
  if (!isPlayerId(raw.playerId)) imported.playerId = current.playerId;
  if (normalizeUsername(raw.username) === null) imported.username = current.username;
  if (imported.playerId === current.playerId) {
    imported.bestScore = Math.max(imported.bestScore, current.bestScore);
    imported.best = Math.max(imported.best, current.best);
  }
  return imported;
}
