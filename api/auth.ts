import {storageUnavailable} from '../src/server/cloud.ts';
import {playerApi} from '../src/server/player-api.ts';
import {store} from './_store.ts';

const handler = (request: Request): Promise<Response> | Response =>
  store ? playerApi(request, store) : storageUnavailable();
export const GET = handler;
export const POST = handler;
