import {DEFAULT_RUNTIME_CONFIG, publicConfig} from '../src/shared/config.ts';
import type {RuntimeConfig} from '../src/shared/config.ts';
import {signaling, d1Store} from '../src/server/signaling.ts';
import {cloudProgress, leaderboardApi, onlineHealth, storageUnavailable} from '../src/server/cloud.ts';
import {blobStore} from '../src/server/blob-store.ts';
import type {BlobEnv} from '../src/server/blob-store.ts';
import type {D1Like} from '../src/server/d1.ts';
import {assets} from './generated-assets.ts';

/** Replaced by esbuild `define` with the build-time public config. */
declare const __PISTA_CONFIG__: RuntimeConfig | undefined;

type Env = BlobEnv & {
  DB: D1Like;
  PISTA84_COINS?: string;
};

const NOT_FOUND = 'Not found';

function buildTimeConfig(): RuntimeConfig {
  return typeof __PISTA_CONFIG__ === 'undefined' ? DEFAULT_RUNTIME_CONFIG : __PISTA_CONFIG__;
}

function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function serveAsset(pathname: string): Response {
  const file = assets[pathname === '/' ? '/index.html' : pathname];
  if (!file) {
    return new Response(NOT_FOUND, {status: 404});
  }
  const body = file.binary ? decodeBase64(file.body) : file.body;
  return new Response(body, {
    headers: {
      'content-type': file.type,
      'x-content-type-options': 'nosniff',
      'cache-control': pathname === '/sw.js' ? 'no-cache' : 'private, max-age=0, must-revalidate',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const {pathname} = new URL(request.url);
    const config = publicConfig(env, buildTimeConfig());
    if (pathname === '/runtime-config.json') {
      return Response.json(config, {headers: {'cache-control': 'no-store'}});
    }
    if (pathname.startsWith('/api/rooms')) {
      return signaling(request, d1Store(env.DB));
    }
    const players = blobStore(env);
    if (pathname === '/api/progress') {
      return players ? cloudProgress(request, players, config) : storageUnavailable();
    }
    if (pathname === '/api/leaderboard' || pathname === '/api/score') {
      return players ? leaderboardApi(request, players) : storageUnavailable();
    }
    if (pathname === '/health') {
      return Response.json({...onlineHealth(players), transport: 'webrtc'});
    }
    return serveAsset(pathname);
  },
};
