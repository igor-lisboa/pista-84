import {mongoStore} from '../src/server/mongo-store.ts';

/** No volatile fallback: cloud saves are acknowledged only by MongoDB. */
export const store = mongoStore(process.env);
