import {DEFAULT_RUNTIME_CONFIG, publicConfig} from '../src/shared/config.ts';
import type {RuntimeConfig} from '../src/shared/config.ts';
import {proxyApi} from '../src/server/proxy.ts';
import {assets} from './generated-assets.ts';

declare const __PISTA_CONFIG__: RuntimeConfig | undefined;
type Env = Record<string, string | undefined> & { API_ORIGIN?: string; PISTA84_COINS?: string };

/** Edge hosting serves assets and proxies APIs to the Node MongoDB/Redis backend. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const {pathname} = new URL(request.url);
    const config = publicConfig(env, typeof __PISTA_CONFIG__ === 'undefined' ? DEFAULT_RUNTIME_CONFIG : __PISTA_CONFIG__);
    if (pathname === '/runtime-config.json') return Response.json(config, {headers: {'cache-control': 'no-store'}});
    if (pathname.startsWith('/api/') || pathname === '/health') return proxyApi(request, env.API_ORIGIN);
    const file = assets[pathname === '/' ? '/index.html' : pathname];
    if (!file) return new Response('Not found', {status: 404});
    const body = file.binary ? Uint8Array.from(atob(file.body), (char) => char.charCodeAt(0)) : file.body;
    return new Response(body, {headers: {
      'content-type': file.type, 'x-content-type-options': 'nosniff',
      'cache-control': pathname === '/sw.js' ? 'no-cache' : 'private, max-age=0, must-revalidate',
    }});
  },
};
