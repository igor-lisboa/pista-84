export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;

const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]+$/u;

/**
 * Returns the trimmed player name when it is valid for the leaderboard
 * (3–16 letters, digits, `_`, `.` or `-`), otherwise `null`.
 */
export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  const length = [...name].length;
  return length >= USERNAME_MIN && length <= USERNAME_MAX && USERNAME_PATTERN.test(name) ? name : null;
}

const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Whether `value` is a well-formed player GUID (UUID v4). */
export const isPlayerId = (value: unknown): value is string =>
  typeof value === 'string' && PLAYER_ID_PATTERN.test(value);

/**
 * Creates the permanent GUID that scores are attached to, so the visible
 * username can change without losing them. `randomUUID` only exists in secure
 * contexts, hence the `getRandomValues` fallback.
 */
export function newPlayerId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
