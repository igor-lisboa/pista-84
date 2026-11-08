import type {IncomingMessage} from 'node:http';

type Environment = Record<string, string | undefined>;

export function isProduction(env: Environment): boolean {
  return env.NODE_ENV === 'production' || Boolean(env.DYNO);
}

/** Fail before listening instead of offering volatile production pairing. */
export function validateNodeConfig(env: Environment): void {
  if (!isProduction(env)) return;
  const missing = ['MONGODB_URI', 'REDIS_URL'].filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing required config vars: ${missing.join(', ')}`);
}

/** Heroku terminates TLS at its router and forwards HTTP to the dyno. */
export function requestOrigin(request: IncomingMessage, env: Environment): string {
  if (env.PUBLIC_ORIGIN) return new URL(env.PUBLIC_ORIGIN).origin;
  const forwarded = request.headers['x-forwarded-proto'];
  const protocol = env.DYNO && forwarded === 'https' ? 'https' : 'http';
  return `${protocol}://${request.headers.host}`;
}
