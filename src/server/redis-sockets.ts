import {createClient} from 'redis';
import {redisConnection} from './redis.ts';
import type {RedisEnv} from './redis.ts';
import {PRESENCE_TTL_MS} from './socket-store.ts';
import type {SocketStore, SocketLease, RoomEvent} from './socket-store.ts';

const CLAIM = `
local ttl = math.min(redis.call('PTTL', KEYS[1]), tonumber(ARGV[3]))
if ttl <= 0 then return 0 end
local previous = redis.call('GET', KEYS[2])
if previous and cjson.decode(previous).session ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'PX', ttl)
return 1`;
const RENEW = `
local ttl = math.min(redis.call('PTTL', KEYS[1]), tonumber(ARGV[2]))
if ttl <= 0 or redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
redis.call('PEXPIRE', KEYS[2], ttl)
return 1`;
const RELEASE = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[2])
redis.call('PUBLISH', KEYS[4], ARGV[2])
return 1`;
const INPUT = `
local ttl = math.min(redis.call('PTTL', KEYS[1]), 2000)
if ttl <= 0 or redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
if redis.call('HEXISTS', KEYS[1], 'answer') == 0 then return 0 end
redis.call('SET', KEYS[3], ARGV[2], 'PX', ttl)
redis.call('PUBLISH', KEYS[4], ARGV[3])
return 1`;

const channel = (room: string) => `pista84:room:{${room}}:events`;
const keys = (lease: SocketLease) => [
  `pista84:room:{${lease.room}}`, `pista84:room:{${lease.room}}:${lease.role}`,
  `pista84:room:{${lease.room}}:input`, channel(lease.room),
];
const owner = ({session, connection}: SocketLease) => JSON.stringify({session, connection});

/** One command pool and one subscriber per function instance; no Redis polling. */
export function redisSocketStore(env: RedisEnv): SocketStore | null {
  const commands = redisConnection(env);
  if (!commands || !env.REDIS_URL) return null;
  const subscriber = createClient({url: env.REDIS_URL, disableOfflineQueue: true,
    socket: {connectTimeout: 5000, reconnectStrategy: false}});
  const failures = new Set<() => void>();
  subscriber.on('error', () => { for (const failed of failures) failed(); });
  let connecting: Promise<unknown> | undefined;
  const run = (script: string, lease: SocketLease, args: string[]) =>
    commands.sendCommand(['EVAL', script, '4', ...keys(lease), ...args]);
  return {
    async claim(lease) { return await run(CLAIM, lease, [lease.session, owner(lease), String(PRESENCE_TTL_MS)]) === 1; },
    async renew(lease) { return await run(RENEW, lease, [owner(lease), String(PRESENCE_TTL_MS)]) === 1; },
    async release(lease) {
      await run(RELEASE, lease, [owner(lease), JSON.stringify({type: 'disconnected', role: lease.role})]);
    },
    async input(lease, input) {
      if (lease.role !== 'controller') return false;
      const time = Date.now();
      return await run(INPUT, lease, [owner(lease), JSON.stringify({input: JSON.stringify(input), time}),
        JSON.stringify({type: 'input', input, time})]) === 1;
    },
    async subscribe(room, receive, failed) {
      if (!subscriber.isReady) {
        connecting ??= subscriber.connect().finally(() => { connecting = undefined; });
        await connecting;
      }
      const listener = (raw: string) => {
        try { receive(JSON.parse(raw) as RoomEvent); } catch { failed(); }
      };
      failures.add(failed);
      try { await subscriber.subscribe(channel(room), listener); }
      catch (error) { failures.delete(failed); throw error; }
      return async () => {
        failures.delete(failed);
        if (subscriber.isReady) await subscriber.unsubscribe(channel(room), listener);
      };
    },
    async close() {
      if (subscriber.isOpen) subscriber.destroy();
      await commands.close();
    },
  };
}
