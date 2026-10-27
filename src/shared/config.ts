/** Public settings delivered to the browser through `/runtime-config.json`. */
export type RuntimeConfig = {coins: number | null};

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {coins: null};

const COINS_ENV_KEY = 'PISTA84_COINS';
const COINS_ERROR = 'PISTA84_COINS must be an integer greater than or equal to zero, or empty.';

export type EnvLike = Readonly<Record<string, unknown>>;

/**
 * Builds the public runtime config from environment variables.
 * An unset variable keeps the fallback, an empty one clears the override.
 */
export function publicConfig(
  env: EnvLike = {},
  fallback: RuntimeConfig = DEFAULT_RUNTIME_CONFIG,
): RuntimeConfig {
  const value = env[COINS_ENV_KEY];
  if (value === undefined) {
    return fallback;
  }
  if (String(value).trim() === '') {
    return {coins: null};
  }
  const coins = Number(value);
  if (!Number.isSafeInteger(coins) || coins < 0) {
    throw new Error(COINS_ERROR);
  }
  return {coins};
}
