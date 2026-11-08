import type {RoomStore} from './signaling.ts';
import {PRESENCE_TTL_MS} from './socket-store.ts';
import type {SocketStore, SocketLease, RoomEvent} from './socket-store.ts';

/** Isolated local development only. Production must use redisSocketStore. */
export function devSocketStore(rooms: RoomStore): SocketStore {
  const leases = new Map<string, {lease: SocketLease; expires: number}>();
  const listeners = new Map<string, Set<(event: RoomEvent) => void>>();
  const key = (lease: SocketLease) => `${lease.room}:${lease.role}`;
  const owned = (lease: SocketLease) => {
    const current = leases.get(key(lease));
    return current && current.expires > Date.now() && current.lease.connection === lease.connection;
  };
  const publish = (room: string, event: RoomEvent) => { for (const listener of listeners.get(room) ?? []) listener(event); };
  return {
    async claim(lease) {
      const room = await rooms.get(lease.room);
      const current = leases.get(key(lease));
      if (!room || room.expires <= Date.now()) return false;
      if (current && current.expires > Date.now() && current.lease.session !== lease.session) return false;
      leases.set(key(lease), {lease, expires: Math.min(room.expires, Date.now() + PRESENCE_TTL_MS)});
      return true;
    },
    async renew(lease) {
      if (!owned(lease)) return false;
      return this.claim(lease);
    },
    async release(lease) {
      if (!owned(lease)) return;
      leases.delete(key(lease));
      publish(lease.room, {type: 'disconnected', role: lease.role});
    },
    async input(lease, input) {
      const room = await rooms.get(lease.room);
      if (lease.role !== 'controller' || !owned(lease) || !room?.answer || room.expires <= Date.now()) return false;
      const time = Date.now();
      await rooms.input(lease.room, input, time);
      publish(lease.room, {type: 'input', input, time});
      return true;
    },
    async subscribe(room, receive) {
      const group = listeners.get(room) ?? new Set();
      group.add(receive);
      listeners.set(room, group);
      return async () => { group.delete(receive); if (!group.size) listeners.delete(room); };
    },
    async close() { leases.clear(); listeners.clear(); },
  };
}
