import type {Account, AccountStore} from '../../src/server/accounts.ts';

/** Atomic isolated double. Application deployments always use MongoDB. */
export function memoryAccountStore(): AccountStore {
  const accounts = new Map<string, Account>();
  const sessions = new Map<string, {accountId: string; expires: Date}>();
  const attempts = new Map<string, number>();
  return {
    async findUsername(key) { return structuredClone([...accounts.values()].find(account => account.usernameKey === key) ?? null); },
    async findId(id) { return structuredClone(accounts.get(id) ?? null); },
    async create(account) {
      if (accounts.has(account.id) || [...accounts.values()].some(value => value.usernameKey === account.usernameKey)) return false;
      accounts.set(account.id, structuredClone(account));
      return true;
    },
    async createSession(hash, accountId, expires) { sessions.set(hash, {accountId, expires}); },
    async session(hash, now) {
      const session = sessions.get(hash);
      return session && session.expires > now ? structuredClone(accounts.get(session.accountId) ?? null) : null;
    },
    async deleteSession(hash) { sessions.delete(hash); },
    async consumeAttempt(key, limit, windowMs, now) {
      const bucket = `${key}:${Math.floor(now / windowMs)}`;
      const count = (attempts.get(bucket) ?? 0) + 1;
      attempts.set(bucket, count);
      return count <= limit;
    },
  };
}
