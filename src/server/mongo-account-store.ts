import type {Db} from 'mongodb';
import type {Account, AccountStore} from './accounts.ts';

interface AccountRecord extends Account {_id: string}
interface SessionRecord {_id: string; accountId: string; expires: Date}
interface AttemptRecord {_id: string; count: number; expires: Date}

/** The unique username and TTL indexes are installed by mongo-store.ts. */
export function mongoAccountStore(database: () => Promise<Db>): AccountStore {
  return {
    async findUsername(usernameKey) {
      const db = await database();
      return db.collection<AccountRecord>('accounts').findOne({usernameKey});
    },
    async findId(id) {
      const db = await database();
      return db.collection<AccountRecord>('accounts').findOne({_id: id});
    },
    async create(account) {
      const db = await database();
      try {
        await db.collection<AccountRecord>('accounts').insertOne({_id: account.id, ...account});
        return true;
      } catch (error) {
        if ((error as {code?: number}).code === 11000) return false;
        throw error;
      }
    },
    async createSession(hash, accountId, expires) {
      const db = await database();
      await db.collection<SessionRecord>('sessions').insertOne({_id: hash, accountId, expires});
    },
    async session(hash, now) {
      const db = await database();
      const session = await db.collection<SessionRecord>('sessions').findOne({_id: hash, expires: {$gt: now}});
      return session ? db.collection<AccountRecord>('accounts').findOne({_id: session.accountId}) : null;
    },
    async deleteSession(hash) {
      const db = await database();
      await db.collection<SessionRecord>('sessions').deleteOne({_id: hash});
    },
    async consumeAttempt(key, limit, windowMs, now) {
      const db = await database();
      const attempts = db.collection<AttemptRecord>('auth-attempts');
      // Fixed-window key avoids upsert races when resetting an expired bucket.
      const bucket = Math.floor(now / windowMs);
      const filter = {_id: `${key}:${bucket}`};
      const update = {
        $inc: {count: 1}, $setOnInsert: {expires: new Date((bucket + 1) * windowMs)},
      };
      let record: AttemptRecord | null;
      try {
        record = await attempts.findOneAndUpdate(filter, update, {upsert: true, returnDocument: 'after'});
      } catch (error) {
        // A competing instance may have inserted the new window's unique key.
        if ((error as {code?: number}).code !== 11000) throw error;
        record = await attempts.findOneAndUpdate(filter, update, {returnDocument: 'after'});
      }
      return record !== null && record.count <= limit;
    },
  };
}
