import {storageUnavailable} from '../src/server/cloud.ts';
import {playerApi} from '../src/server/player-api.ts';
import {publicConfig} from '../src/shared/config.ts';
import {store} from './_store.ts';

export const PUT = (request: Request): Promise<Response> | Response =>
  store ? playerApi(request, store, publicConfig(process.env)) : storageUnavailable();
