import {roomApi} from './room-api.ts';
import {RoomSocket} from './room-socket.ts';

export interface RemoteInput {
  steer: number;
  accelerate: boolean;
  brake: boolean;
  start: boolean;
  pause: boolean;
}
export type RemoteState = 'waiting' | 'connected' | 'disconnected' | 'error';
export interface RoomInfo {id: string; hostToken: string; joinToken: string; expires: number}
export interface RemoteOptions {
  onStatus?: (state: RemoteState, detail?: string) => void;
  onInput?: (input: Partial<RemoteInput>) => void;
}

export function cleanInput(input: Partial<RemoteInput> = {}): RemoteInput {
  return {
    steer: typeof input.steer === 'number' && Number.isFinite(input.steer) ? Math.max(-1, Math.min(1, input.steer)) : 0,
    accelerate: input.accelerate === true, brake: input.brake === true,
    start: input.start === true, pause: input.pause === true,
  };
}

/** Pair once over HTTP, then send live commands through the shared socket relay. */
export class RemoteConnection {
  state: RemoteState = 'waiting';
  room?: RoomInfo;
  private closed = false;
  private controller = false;
  private lastSent = '';
  private lastSendAt = 0;
  private readonly socket: RoomSocket;
  private readonly onStatus: NonNullable<RemoteOptions['onStatus']>;
  private readonly onInput: NonNullable<RemoteOptions['onInput']>;

  constructor({onStatus = () => {}, onInput = () => {}}: RemoteOptions = {}) {
    this.onStatus = onStatus;
    this.onInput = onInput;
    this.socket = new RoomSocket((message) => {
      if (message.type === 'ready' && this.controller) {
        this.lastSent = '';
        this.setStatus('connected');
      } else if (message.type === 'input' && !this.controller) {
        this.setStatus('connected');
        this.onInput(cleanInput(message.input as Partial<RemoteInput>));
      } else if (message.type === 'disconnected') {
        this.setStatus('disconnected');
        this.onInput({});
      }
    }, (permanent) => {
      this.setStatus(permanent ? 'error' : 'disconnected');
      this.onInput({});
    });
  }

  private setStatus(state: RemoteState): void {
    if (this.closed || this.state === state) return;
    this.state = state;
    this.onStatus(state);
  }

  async host(): Promise<RoomInfo> {
    this.room = await roomApi<RoomInfo>('', null, 'POST', {offer: '{"type":"socket"}'});
    if (this.closed) {
      await roomApi(`/${this.room.id}`, this.room.hostToken, 'DELETE');
      throw new Error('Pairing cancelled.');
    }
    this.socket.connect({room: this.room.id, token: this.room.hostToken, role: 'host'});
    return this.room;
  }

  async join(id: string, token: string): Promise<void> {
    const room = await roomApi<{answered: boolean}>(`/${id}`, token);
    if (room.answered) throw new Error('This QR code was already used. Generate a new one on the main screen.');
    if (this.closed) return;
    await roomApi(`/${id}`, token, 'POST', {answer: '{"type":"socket"}'});
    if (this.closed) return;
    this.controller = true;
    this.socket.connect({room: id, token, role: 'controller'});
  }

  /** Changes go immediately; unchanged input has a 500 ms safety heartbeat. */
  send(input: Partial<RemoteInput>): void {
    if (this.closed || !this.controller) return;
    const clean = cleanInput(input);
    const serialized = JSON.stringify(clean);
    const now = performance.now();
    if (serialized === this.lastSent && now - this.lastSendAt < 500) return;
    if (!this.socket.send({type: 'input', input: clean})) return;
    this.lastSent = serialized;
    this.lastSendAt = now;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.socket.close();
    if (this.room) {
      try { await roomApi(`/${this.room.id}`, this.room.hostToken, 'DELETE'); }
      catch { /* Redis expires the room even if the closing request fails. */ }
    }
  }
}
