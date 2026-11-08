import {createClient} from 'redis';

export interface RedisEnv { REDIS_URL?: string }
export interface RedisCommands {
  sendCommand(args: string[]): Promise<unknown>;
}

/** A lazy, reused connection; failed initial connections can be retried next request. */
export function redisConnection(env: RedisEnv): (RedisCommands & {close(): Promise<void>}) | null {
  if (!env.REDIS_URL) return null;
  const url = env.REDIS_URL;
  let client: ReturnType<typeof createClient> | undefined;
  let connecting: Promise<unknown> | undefined;
  return {
    async sendCommand(args) {
      if (!client) {
        client = createClient({url, disableOfflineQueue: true,
          socket: {connectTimeout: 5000, reconnectStrategy: false}});
        // Do not log connection errors: driver messages can contain credentials/hosts.
        client.on('error', () => {});
      }
      if (!client.isReady) {
        connecting ??= client.connect().finally(() => { connecting = undefined; });
        await connecting;
      }
      return client.sendCommand(args);
    },
    async close() { if (client?.isOpen) client.destroy(); },
  };
}
