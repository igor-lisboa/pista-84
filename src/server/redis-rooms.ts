import {redisConnection} from './redis.ts';
import type {RedisCommands, RedisEnv} from './redis.ts';
import type {Room, RoomStore} from './signaling.ts';

/** Redis scripts keep claims and expiry checks atomic across server instances. */
const CREATE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], 'base', ARGV[1])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1`;
const ANSWER = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
return redis.call('HSETNX', KEYS[1], 'answer', ARGV[1])`;
const READ = `
local base = redis.call('HGET', KEYS[1], 'base')
if not base then return nil end
return {base, redis.call('HGET', KEYS[1], 'answer'), redis.call('GET', KEYS[2])}`;
const INPUT = `
if redis.call('HEXISTS', KEYS[1], 'answer') == 0 then return 0 end
local previous = redis.call('GET', KEYS[2])
if previous and tonumber(cjson.decode(previous).time) >= tonumber(ARGV[2]) then return 0 end
local ttl = math.min(redis.call('PTTL', KEYS[1]), tonumber(ARGV[3]))
if ttl <= 0 then return 0 end
redis.call('SET', KEYS[2], ARGV[1], 'PX', ttl)
return 1`;

export const INPUT_TTL_MS = 2000;
// Hash tags place both keys in the same Redis Cluster slot for atomic scripts.
const keys = (id: string) => [`pista84:room:{${id}}`, `pista84:room:{${id}}:input`];

export function redisRoomStore(env: RedisEnv, injected?: RedisCommands): RoomStore | null {
  const redis = injected ?? redisConnection(env);
  if (!redis) return null;
  const run = (script: string, roomKeys: string[], args: string[]) =>
    redis.sendCommand(['EVAL', script, String(roomKeys.length), ...roomKeys, ...args]);
  return {
    async create(room) {
      const ttl = room.expires - Date.now();
      if (ttl <= 0) throw new Error('Room expired.');
      const {input: _input, inputTime: _time, answer: _answer, ...base} = room;
      // Relative TTL avoids extending keys when the app and Redis clocks differ.
      if (await run(CREATE, [keys(room.id)[0]!], [JSON.stringify(base), String(ttl)]) !== 1) {
        throw new Error('Room already exists.');
      }
    },
    async get(id) {
      const storedRoom = await run(READ, keys(id), []) as (string | null)[] | null;
      if (!storedRoom) return null;
      const [base, answer, stored] = storedRoom;
      if (!base) return null;
      const room: Room = {...JSON.parse(base), answer: answer ?? null};
      if (room.expires <= Date.now()) return null;
      if (stored) {
        const {input, time} = JSON.parse(stored) as {input: string; time: number};
        room.input = input;
        room.inputTime = time;
      }
      return room;
    },
    async answer(id, answer) { return await run(ANSWER, [keys(id)[0]!], [answer]) === 1; },
    async remove(id) { await redis.sendCommand(['DEL', ...keys(id)]); },
    async input(id, input, time) {
      await run(INPUT, keys(id), [JSON.stringify({input: JSON.stringify(input), time}), String(time), String(INPUT_TTL_MS)]);
    },
  };
}
