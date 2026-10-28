import {memoryStore, signaling} from '../src/server/signaling.ts';

/**
 * Phone-as-controller pairing. Rooms live in this function instance's memory:
 * they last ten minutes, change many times a second and hold no gameplay data,
 * so they do not belong in the Blob store (every change would cost an operation
 * of its quota). Serverless functions do not share memory, so `vercel.json`
 * rewrites every `/api/rooms/**` route to this single file, as `?route=<rest>`.
 * See docs/TECH-DEBT.md (TD-02) for what that costs.
 */
const rooms = memoryStore();

/** Rebuilds the real room path whether Vercel hands over the original URL or the rewritten one. */
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = url.searchParams.get('route');
  url.searchParams.delete('route');
  if (raw !== null) {
    const route = raw.trim().replace(/^\/+|\/+$/g, '');
    url.pathname = route ? `/api/rooms/${route}` : '/api/rooms';
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return signaling(
    new Request(url, {
      method: request.method,
      headers: request.headers,
      ...(hasBody ? {body: await request.text()} : {}),
    }),
    rooms,
  );
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
