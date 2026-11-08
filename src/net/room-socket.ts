import {newPlayerId} from '../game/username.ts';

interface Credentials {room: string; token: string; role: 'host' | 'controller'}

/** Reconnects the same session after network loss or a function lifetime limit. */
export class RoomSocket {
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private timeout?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private ready = false;
  private delay = 500;
  private readonly session = newPlayerId();
  private readonly receive: (message: Record<string, unknown>) => void;
  private readonly disconnected: (permanent: boolean) => void;

  constructor(receive: (message: Record<string, unknown>) => void, disconnected: (permanent: boolean) => void) {
    this.receive = receive;
    this.disconnected = disconnected;
  }

  connect(credentials: Credentials): void {
    if (this.stopped) return;
    const url = new URL('/api/controller', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.socket = new WebSocket(url);
    this.timeout = setTimeout(() => socket.close(4000, 'Connection timeout'), 8000);
    socket.onopen = () => socket.send(JSON.stringify({type: 'auth', ...credentials, session: this.session}));
    socket.onmessage = (event) => {
      if (this.stopped) return;
      try {
        const message = JSON.parse(event.data) as Record<string, unknown>;
        if (message.type === 'ready') {
          clearTimeout(this.timeout);
          this.ready = true;
          this.delay = 500;
        }
        this.receive(message);
      } catch { socket.close(1008, 'Invalid response'); }
    };
    socket.onerror = () => {}; // close schedules a bounded retry; no HTTP fallback.
    socket.onclose = (event) => {
      clearTimeout(this.timeout);
      this.ready = false;
      if (this.stopped) return;
      const permanent = event.code === 1008 || event.code === 1009;
      this.disconnected(permanent);
      if (permanent) { this.stopped = true; return; }
      this.retry = setTimeout(() => this.connect(credentials), this.delay);
      this.delay = Math.min(this.delay * 2, 10_000);
    };
  }

  send(message: unknown): boolean {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 4096) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.stopped = true;
    this.ready = false;
    clearTimeout(this.retry);
    clearTimeout(this.timeout);
    this.socket?.close();
  }
}
