/** Public settings delivered to the browser through `/runtime-config.json`. */
export type RuntimeConfig = {
  coins: number | null;
  /** Older cached configurations omit this setting and retain the visible tools. */
  progressTools?: boolean;
};

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {coins: null, progressTools: true};

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
  const flag = env.PISTA84_PROGRESS_TOOLS;
  let progressTools = fallback.progressTools ?? true;
  if (flag !== undefined && String(flag).trim() !== '') {
    const value = String(flag).trim().toLowerCase();
    if (value !== 'true' && value !== 'false') {
      throw new Error('PISTA84_PROGRESS_TOOLS must be true, false, or empty.');
    }
    progressTools = value === 'true';
  }
  const value = env[COINS_ENV_KEY];
  let coins = fallback.coins;
  if (value !== undefined) coins = String(value).trim() === '' ? null : Number(value);
  if (coins !== null && (!Number.isSafeInteger(coins) || coins < 0)) {
    throw new Error(COINS_ERROR);
  }
  return {coins, progressTools};
}
