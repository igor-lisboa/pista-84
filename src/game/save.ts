import type { DistanceUnit } from './units.ts';
import { isPlayerId, newPlayerId, normalizeUsername } from './username.ts';
import { CARS, DEFAULT_CAR_ID, DEFAULT_PAINT_ID, PAINTS } from './cars.ts';

export const SAVE_KEY = 'pista84';

/** A player this device has retired; kept so earlier scores are never lost from view. */
export interface PastPlayer {
  playerId: string;
  username: string | null;
  bestScore: number;
  /** Best distance in metres. */
  best: number;
  /** When the player was retired (ms since epoch). */
  retired: number;
}

export const HISTORY_LIMIT = 20;

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
  /** Players this device used before, newest last. */
  history: PastPlayer[];
  /** Unit for distances and speeds; kilometres unless the player picks miles. */
  units: DistanceUnit;
  /** Whether the how-to-play tutorial was finished or skipped by this player. */
  tutorialDone: boolean;
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

function readHistory(value: unknown): PastPlayer[] {
  if (!Array.isArray(value)) return [];
  const past: PastPlayer[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    if (!isPlayerId(item.playerId)) continue;
    past.push({
      playerId: item.playerId,
      username: normalizeUsername(item.username),
      bestScore: Math.floor(nonNegative(item.bestScore)),
      best: nonNegative(item.best),
      retired: nonNegative(item.retired),
    });
  }
  return past.slice(-HISTORY_LIMIT);
}

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
    history: [],
    units: 'km',
    tutorialDone: false,
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
      history: readHistory(saved.history),
      units: saved.units === 'mi' ? 'mi' : 'km',
      tutorialDone: saved.tutorialDone === true,
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
  if (!Array.isArray(raw.history)) imported.history = current.history;
  if (raw.units !== 'km' && raw.units !== 'mi') imported.units = current.units;
  if (typeof raw.tutorialDone !== 'boolean') imported.tutorialDone = current.tutorialDone;
  if (imported.playerId === current.playerId) {
    imported.bestScore = Math.max(imported.bestScore, current.bestScore);
    imported.best = Math.max(imported.best, current.best);
  }
  return imported;
}

/**
 * Starts over as a brand-new player: fresh GUID, no name, starting garage and
 * zero coins. Device preferences (language, sound) carry over and the retired
 * player goes into `history`. Their scores stay online under the old GUID.
 */
export function startNewPlayer(current: SaveData, config: BalanceConfig = { coins: null }, now = Date.now()): SaveData {
  const fresh = loadSave({ getItem: () => '{}' }, config);
  fresh.lang = current.lang;
  fresh.sound = current.sound;
  fresh.units = current.units;
  const retired: PastPlayer[] =
    current.username !== null || current.bestScore > 0
      ? [{ playerId: current.playerId, username: current.username, bestScore: current.bestScore, best: current.best, retired: now }]
      : [];
  fresh.history = [...current.history, ...retired].slice(-HISTORY_LIMIT);
  return fresh;
}
