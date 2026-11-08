import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proxyApi} from '../src/server/proxy.ts';

test('edge proxy preserves the WebSocket upgrade response', async (t) => {
  const upgrade = new Response(null);
  t.mock.method(globalThis, 'fetch', async (_url: URL, options: RequestInit) => {
    assert.equal(new Headers(options.headers).get('upgrade'), 'websocket');
    return upgrade;
  });
  const response = await proxyApi(new Request('https://game.test/api/controller', {
    headers: {upgrade: 'websocket', origin: 'https://game.test'},
  }), 'https://backend.test');
  assert.equal(response, upgrade, 'do not discard the platform socket handle');
});

test('edge API proxy fails closed without a distinct HTTPS backend', async () => {
  const request = new Request('https://game.test/api/progress');
  for (const origin of [undefined, 'http://backend.test', 'https://game.test', 'invalid']) {
    assert.equal((await proxyApi(request, origin)).status, 503);
  }
});

test('edge API proxy preserves origin checks and only forwards API credentials', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    calls++;
    assert.equal(String(url), 'https://backend.test/api/progress');
    const headers = new Headers(options.headers);
    assert.equal(headers.get('origin'), 'https://backend.test');
    assert.equal(headers.get('x-player-id'), 'test-player');
    assert.equal(headers.get('cookie'), null);
    assert.equal(options.body, '{"revision":1}');
    return Response.json({revision: 2});
  });
  const request = (origin: string) => new Request('https://game.test/api/progress', {
    method: 'PUT', headers: {origin, 'x-player-id': 'test-player', cookie: 'private-cookie'}, body: '{"revision":1}',
  });
  assert.equal((await proxyApi(request('https://evil.test'), 'https://backend.test')).status, 403);
  assert.equal(calls, 0);
  const response = await proxyApi(request('https://game.test'), 'https://backend.test');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {revision: 2});
  assert.equal(calls, 1);
});
