import {redisRoomStore} from '../src/server/redis-rooms.ts';

/** Serverless instances must share rooms; never silently use instance memory. */
export const rooms = redisRoomStore(process.env);
export const roomsShared = rooms !== null;
