/** TCP database drivers run on Node, never in the browser-targeted Worker. */
export async function proxyApi(request: Request, configuredOrigin?: string): Promise<Response> {
  const unavailable = () => Response.json({error: 'Online backend is unavailable.'}, {
    status: 503, headers: {'cache-control': 'no-store'},
  });
  if (!configuredOrigin) return unavailable();
  try {
    const source = new URL(request.url);
    const backend = new URL(configuredOrigin);
    if (backend.protocol !== 'https:' || backend.origin === source.origin) return unavailable();
    const origin = request.headers.get('origin');
    if (origin && origin !== source.origin) return Response.json({error: 'Invalid origin.'}, {status: 403});
    const target = new URL(source.pathname + source.search, backend.origin);
    const headers = new Headers();
    for (const name of ['content-type', 'authorization', 'x-player-id', 'sec-fetch-site']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const sessionCookies = request.headers.get('cookie')?.split(';').map(value => value.trim())
      .filter(value => /^(?:__Host-)?pista84-session=/.test(value));
    if (sessionCookies?.length) headers.set('cookie', sessionCookies.join('; '));
    if (origin) headers.set('origin', backend.origin);
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      headers.set('upgrade', 'websocket');
      // Return the platform's upgrade response intact, including its socket handle.
      return await fetch(target, {method: 'GET', headers, redirect: 'manual'});
    }
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
    const response = await fetch(target, {method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(10000)});
    const responseHeaders = new Headers({
      'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store',
    });
    for (const value of response.headers.getSetCookie()) responseHeaders.append('set-cookie', value);
    const retry = response.headers.get('retry-after');
    if (retry) responseHeaders.set('retry-after', retry);
    return new Response(response.body, {status: response.status, headers: responseHeaders});
  } catch { return unavailable(); }
}
