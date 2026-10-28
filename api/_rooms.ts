import {blobRoomStore} from '../src/server/blob-rooms.ts';
import {memoryStore} from '../src/server/signaling.ts';

/**
 * Where phone-pairing rooms live. With the Blob store configured every
 * serverless instance shares them; without a token they sit in this instance's
 * memory, which only works while the main screen and the phone happen to reach
 * the same instance (see docs/TECH-DEBT.md, TD-02).
 */
const shared = blobRoomStore(process.env);

export const rooms = shared ?? memoryStore();
export const roomsShared = shared !== null;
