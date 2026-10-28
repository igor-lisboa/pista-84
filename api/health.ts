import {json, onlineHealth} from '../src/server/cloud.ts';
import {store} from './_store.ts';

export const GET = (): Response => json(onlineHealth(store));
