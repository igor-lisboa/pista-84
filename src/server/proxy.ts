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
    for (const name of ['content-type', 'authorization', 'x-player-id']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (origin) headers.set('origin', backend.origin);
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
    const response = await fetch(target, {method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(10000)});
    return new Response(response.body, {status: response.status, headers: {
      'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store',
    }});
  } catch { return unavailable(); }
}
