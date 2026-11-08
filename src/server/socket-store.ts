import type {RemoteInput} from './signaling.ts';

export type SocketRole = 'host' | 'controller';
export interface SocketLease {
  room: string;
  role: SocketRole;
  session: string;
  connection: string;
}
export type RoomEvent = {type: 'input'; input: RemoteInput; time: number} | {type: 'disconnected'; role: SocketRole};
export const PRESENCE_TTL_MS = 15_000;

/** Presence is shared; actual WebSocket handles stay in the accepting process. */
export interface SocketStore {
  claim(lease: SocketLease): Promise<boolean>;
  renew(lease: SocketLease): Promise<boolean>;
  release(lease: SocketLease): Promise<void>;
  input(lease: SocketLease, input: RemoteInput): Promise<boolean>;
  subscribe(room: string, receive: (event: RoomEvent) => void, failed: () => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
}
