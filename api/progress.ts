import {cloudProgress, storageUnavailable} from '../src/server/cloud.ts';
import {publicConfig} from '../src/shared/config.ts';
import {store} from './_store.ts';

const handler = (request: Request): Promise<Response> | Response =>
  store ? cloudProgress(request, store, publicConfig(process.env)) : storageUnavailable();

export const GET = handler;
export const PUT = handler;
