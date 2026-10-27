// Minimal service-worker typings (the `webworker` lib conflicts with DOM).
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface ServiceWorkerScope {
  skipWaiting(): Promise<void>;
  clients: {claim(): Promise<void>};
  location: Location;
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
}

const scope = self as unknown as ServiceWorkerScope;

const CACHE_PREFIX = 'pista84-';
const CACHE = `${CACHE_PREFIX}v10`;
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/assets/vehicle-atlas-v1.png',
  '/assets/vehicle-turns-v2.png',
  '/app.js',
  '/runtime-config.json',
];

function shouldHandle(request: Request): URL | null {
  const url = new URL(request.url);
  const isForeign = url.origin !== scope.location.origin;
  const isDynamic = url.pathname.startsWith('/api/') || url.pathname === '/relay';
  if (isForeign || request.method !== 'GET' || isDynamic || !ASSETS.includes(url.pathname)) {
    return null;
  }
  return url;
}

async function precache(): Promise<void> {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS);
  await scope.skipWaiting();
}

async function dropOldCaches(): Promise<void> {
  const keys = await caches.keys();
  const stale = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE);
  await Promise.all(stale.map((key) => caches.delete(key)));
  await scope.clients.claim();
}

/** Network first; falls back to the cached copy when offline. */
async function networkFirst(request: Request, url: URL): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaqueredirect') {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
    }
    return response;
  } catch {
    const cached = await caches.match(url.pathname);
    return cached ?? Response.error();
  }
}

scope.addEventListener('install', (event) => event.waitUntil(precache()));
scope.addEventListener('activate', (event) => event.waitUntil(dropOldCaches()));
scope.addEventListener('fetch', (event) => {
  const url = shouldHandle(event.request);
  if (url) {
    event.respondWith(networkFirst(event.request, url));
  }
});
