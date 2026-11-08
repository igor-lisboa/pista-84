import {MongoClient} from 'mongodb';
import type {Db} from 'mongodb';
import {mongoPlayerStore} from './mongo-player-store.ts';
import type {PlayerRecord} from './mongo-player-store.ts';
import type {PlayerStore} from './players.ts';

export interface MongoEnv {
  MONGODB_URI?: string;
  MONGODB_DATABASE?: string;
}

/** Owns connection lifetime and index setup; queries live in mongo-player-store.ts. */
export function mongoStore(env: MongoEnv): (PlayerStore & {close(): Promise<void>}) | null {
  const uri = env.MONGODB_URI;
  if (!uri) return null;

  let client: MongoClient | undefined;
  let connecting: Promise<Db> | undefined;

  async function connect(): Promise<Db> {
    // Parse credentials on the first request, so invalid settings become a guarded 503.
    client ??= new MongoClient(uri!, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      waitQueueTimeoutMS: 5000,
      writeConcern: {w: 'majority', wtimeoutMS: 5000},
    });
    await client.connect();
    const database = client.db(env.MONGODB_DATABASE || 'pista84');
    await database.collection('scores').createIndex({score: -1, achieved: 1, _id: 1});
    return database;
  }

  function database(): Promise<Db> {
    if (!connecting) {
      connecting = connect().catch((error: unknown) => {
        connecting = undefined;
        throw error;
      });
    }
    return connecting;
  }

  const store = mongoPlayerStore(async (key) => {
    const db = await database();
    return db.collection<PlayerRecord>(key);
  });

  return {
    ...store,
    async close() {
      await client?.close();
    },
  };
}
