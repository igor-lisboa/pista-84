import {json, onlineHealth} from '../src/server/cloud.ts';
import {roomsShared} from './_rooms.ts';
import {store} from './_store.ts';

export const GET = (): Response => json({...onlineHealth(store), storage: store ? 'mongodb' : 'unconfigured', pairing: roomsShared ? 'redis' : 'unconfigured'});
