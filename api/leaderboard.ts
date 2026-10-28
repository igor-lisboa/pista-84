import {leaderboardApi, storageUnavailable} from '../src/server/cloud.ts';
import {store} from './_store.ts';

export const GET = (request: Request): Promise<Response> | Response =>
  store ? leaderboardApi(request, store) : storageUnavailable();
