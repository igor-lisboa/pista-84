import {signaling} from '../src/server/signaling.ts';
import {rooms} from './_rooms.ts';
import {json} from '../src/server/cloud.ts';
import type {RoomStore} from '../src/server/signaling.ts';

/**
 * Redis pairing rooms expire after ten minutes. Vercel rewrites nested
 * routes to this function as `?route=<rest>`.
 */

/** Rebuilds the real room path whether Vercel hands over the original URL or the rewritten one. */
export function createRoomsHandler(rooms: RoomStore | null) {
  return async function handler(request: Request): Promise<Response> {
    if (!rooms) return json({error: 'Controller storage is not configured.'}, 503);
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
  };
}

const handler = createRoomsHandler(rooms);
export const GET = handler;
export const POST = handler;
export const DELETE = handler;
