export interface Account {
  id: string;
  username: string;
  usernameKey: string;
  passwordHash: string;
  createdAt: number;
}

export interface AccountUser {
  id: string;
  username: string;
}

export interface AccountStore {
  findUsername(key: string): Promise<Account | null>;
  findId(id: string): Promise<Account | null>;
  /** Unique username conflicts return false, including concurrent registrations. */
  create(account: Account): Promise<boolean>;
  createSession(hash: string, accountId: string, expires: Date): Promise<void>;
  session(hash: string, now: Date): Promise<Account | null>;
  deleteSession(hash: string): Promise<void>;
  /** Atomic, shared across all Node instances. */
  consumeAttempt(key: string, limit: number, windowMs: number, now: number): Promise<boolean>;
}

export const accountUser = (account: Account): AccountUser => ({id: account.id, username: account.username});
