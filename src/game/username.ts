export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;

/** Lower-case a–z and digits, with single `_` or `-` separators between them. */
const USERNAME_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

/** Names that could be mistaken for the game's own staff or system accounts. */
const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin', 'administrator', 'root', 'system', 'moderator', 'support', 'staff', 'pista84', 'null', 'undefined',
]);

/**
 * Returns the player name in its canonical form when it is valid, otherwise `null`.
 *
 * Rules: 3–16 characters; lower-case letters a–z, digits, `_` and `-` only (no spaces,
 * accents or other symbols); it starts and ends with a letter or digit; `_` and `-`
 * never appear twice in a row; reserved names are refused. Upper-case input is
 * lower-cased and surrounding whitespace is trimmed.
 */
export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFKC').trim().toLowerCase();
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return null;
  if (!USERNAME_PATTERN.test(name) || RESERVED_USERNAMES.has(name)) return null;
  return name;
}

/**
 * Cleans text while the player types: lower-cases it, drops accents (`João` → `joao`)
 * and removes spaces and every other disallowed character, then caps the length.
 * The result still has to pass `normalizeUsername` (for example the start/end rules).
 */
export function sanitizeUsernameInput(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, USERNAME_MAX);
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
