import {storageUnavailable} from '../src/server/cloud.ts';
import {playerApi} from '../src/server/player-api.ts';
import {store} from './_store.ts';

export const GET = (request: Request): Promise<Response> | Response =>
  store ? playerApi(request, store) : storageUnavailable();
