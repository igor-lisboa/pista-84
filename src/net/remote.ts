// Browser client for the phone-as-controller feature: WebRTC with an HTTPS relay fallback.

export interface RemoteInput {
  steer: number;
  accelerate: boolean;
  brake: boolean;
  start: boolean;
  pause: boolean;
}

export type RemoteState = 'waiting' | 'connected' | 'disconnected' | 'error';

export interface RoomInfo {
  id: string;
  hostToken: string;
  joinToken: string;
  expires: number;
}

export interface RemoteOptions {
  onStatus?: (state: RemoteState, detail?: string) => void;
  onInput?: (input: Partial<RemoteInput>) => void;
  forceRelay?: boolean;
}

interface HostRoomState {
  answer: string | null;
  expires: number;
  input: Partial<RemoteInput> | null;
  inputTime: number;
}

interface JoinRoomState {
  offer: string;
  answered: boolean;
  expires: number;
}

type HttpMethod = 'GET' | 'POST' | 'DELETE';

const ICE_CONFIG: RTCConfiguration = {iceServers: [{urls: 'stun:stun.cloudflare.com:3478'}]};
const RELAY_SIGNAL = '{"type":"relay"}';
const DATA_CHANNEL_LABEL = 'pista84';

const ICE_GATHER_TIMEOUT_MS = 3500;
const API_TIMEOUT_MS = 8000;
const POLL_BEFORE_ANSWER_MS = 450;
const POLL_AFTER_ANSWER_MS = 110;
const INPUT_STALE_MS = 1800;
const SEND_INTERVAL_DIRECT_MS = 500;
const SEND_INTERVAL_RELAY_MS = 100;

const STATUS_DIRECT = 'Direct connection';
const STATUS_COMPAT = 'Compatibility connection';

function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        finish();
      }
    };
    const timer = setTimeout(finish, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

async function api<T>(path: string, token: string | null, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), API_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {'content-type': 'application/json'};
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const response = await fetch(`/api/rooms${path}`, {
      method,
      signal: abort.signal,
      cache: 'no-store',
      credentials: 'same-origin',
      headers,
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Sign in to this browser and open the controller link again.');
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not pair.');
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

function isSafari(): boolean {
  return /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);
}

/** Normalises any untrusted input into a complete, clamped command. */
export function cleanInput(input: Partial<RemoteInput> = {}): RemoteInput {
  const steer = input.steer;
  return {
    steer: typeof steer === 'number' && Number.isFinite(steer) ? Math.max(-1, Math.min(1, steer)) : 0,
    accelerate: input.accelerate === true,
    brake: input.brake === true,
    start: input.start === true,
    pause: input.pause === true,
  };
}

export class RemoteConnection {
  state: RemoteState = 'waiting';
  room?: RoomInfo;

  private readonly onStatus: NonNullable<RemoteOptions['onStatus']>;
  private readonly onInput: NonNullable<RemoteOptions['onInput']>;
  private readonly forceRelay: boolean;
  private closed = false;
  private pc: RTCPeerConnection | null = null;
  private channel?: RTCDataChannel;
  private joined?: {id: string; token: string};
  private pollTimer?: ReturnType<typeof setTimeout>;
  private answered = false;
  private lastInputTime = 0;
  private lastInputAt = 0;
  private sending = false;
  private lastSendAt = 0;

  constructor({onStatus = () => {}, onInput = () => {}, forceRelay = false}: RemoteOptions = {}) {
    this.onStatus = onStatus;
    this.onInput = onInput;
    this.forceRelay =
      forceRelay || new URLSearchParams(location.search).get('transport') === 'relay' || isSafari();
    if (!this.forceRelay && window.RTCPeerConnection) {
      try {
        this.pc = new RTCPeerConnection(ICE_CONFIG);
      } catch {
        this.pc = null;
      }
    }
  }

  private setStatus(state: RemoteState, detail?: string): void {
    if (this.closed || this.state === state) {
      return;
    }
    this.state = state;
    this.onStatus(state, detail);
  }

  private get channelOpen(): boolean {
    return this.channel?.readyState === 'open';
  }

  private attach(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => this.setStatus('connected', STATUS_DIRECT);
    channel.onclose = () => {
      if (!this.closed) {
        this.setStatus('connected', STATUS_COMPAT);
      }
    };
    channel.onmessage = (event: MessageEvent<string>) => this.handleChannelMessage(event.data);
  }

  private handleChannelMessage(raw: string): void {
    try {
      const message = JSON.parse(raw);
      if (message.type === 'input') {
        this.onInput(cleanInput(message.input));
      }
    } catch {
      // Ignore malformed packets.
    }
  }

  private discardPeer(): void {
    this.pc?.close();
    this.pc = null;
  }

  /** Creates the room and returns its credentials; resolves once the QR can be shown. */
  async host(): Promise<RoomInfo> {
    const offer = await this.createOffer();
    if (this.closed) {
      throw new Error('Pairing cancelled.');
    }
    this.room = await api<RoomInfo>('', null, 'POST', {offer});
    void this.pollHost();
    return this.room;
  }

  private async createOffer(): Promise<string> {
    if (!this.pc) {
      return RELAY_SIGNAL;
    }
    try {
      this.attach(this.pc.createDataChannel(DATA_CHANNEL_LABEL, {ordered: false, maxRetransmits: 0}));
      await this.pc.setLocalDescription(await this.pc.createOffer());
      await waitForIce(this.pc);
      return JSON.stringify(this.pc.localDescription);
    } catch {
      this.discardPeer();
      return RELAY_SIGNAL;
    }
  }

  private async applyAnswer(rawAnswer: string): Promise<void> {
    const answer = JSON.parse(rawAnswer);
    if (answer.type === 'relay' || !this.pc) {
      return;
    }
    try {
      await this.pc.setRemoteDescription(answer);
    } catch {
      // Falls back to the HTTPS relay.
    }
  }

  private async pollHost(): Promise<void> {
    if (this.closed || !this.room) {
      return;
    }
    try {
      const room = await api<HostRoomState>(`/${this.room.id}`, this.room.hostToken);
      if (this.closed) {
        return;
      }
      if (room.answer && !this.answered) {
        this.answered = true;
        await this.applyAnswer(room.answer);
      }
      this.handleRelayedInput(room);
      this.expireStaleInput();
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : undefined);
    }
    if (!this.closed) {
      const delay = this.answered ? POLL_AFTER_ANSWER_MS : POLL_BEFORE_ANSWER_MS;
      this.pollTimer = setTimeout(() => void this.pollHost(), delay);
    }
  }

  private handleRelayedInput(room: HostRoomState): void {
    if (!room.inputTime || room.inputTime === this.lastInputTime) {
      return;
    }
    this.lastInputTime = room.inputTime;
    this.lastInputAt = performance.now();
    this.setStatus('connected', this.channelOpen ? STATUS_DIRECT : STATUS_COMPAT);
    if (!this.channelOpen) {
      this.onInput(cleanInput(room.input ?? {}));
    }
  }

  private expireStaleInput(): void {
    const stale = this.lastInputAt && performance.now() - this.lastInputAt > INPUT_STALE_MS;
    if (stale && !this.channelOpen) {
      this.setStatus('disconnected');
      this.onInput({});
    }
  }

  /** Joins an existing room from the controller (phone) side. */
  async join(id: string, token: string): Promise<void> {
    const room = await api<JoinRoomState>(`/${id}`, token);
    if (room.answered) {
      throw new Error('This QR code was already used. Generate a new one on the main screen.');
    }
    const answer = await this.createAnswer(JSON.parse(room.offer));
    if (this.closed) {
      return;
    }
    await api(`/${id}`, token, 'POST', {answer});
    this.joined = {id, token};
    // An acknowledged input proves the HTTPS compatibility path works before showing connected.
    await api(`/${id}/input`, token, 'POST', {input: {steer: 0, accelerate: false, brake: false}});
    this.setStatus('connected', STATUS_COMPAT);
  }

  private async createAnswer(offer: RTCSessionDescriptionInit): Promise<string> {
    if (offer.type === ('relay' as string) || !this.pc) {
      return RELAY_SIGNAL;
    }
    try {
      this.pc.ondatachannel = (event) => this.attach(event.channel);
      await this.pc.setRemoteDescription(offer);
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      await waitForIce(this.pc);
      return JSON.stringify(this.pc.localDescription);
    } catch {
      this.discardPeer();
      return RELAY_SIGNAL;
    }
  }

  /** Sends a command over WebRTC (when open) and a throttled HTTPS heartbeat. */
  send(input: Partial<RemoteInput>): void {
    if (this.closed || !this.joined) {
      return;
    }
    const clean = cleanInput(input);
    if (this.channelOpen) {
      this.sendOverChannel(clean);
    }
    // Keep a low-rate HTTPS heartbeat even on WebRTC; upgrade failures never strand Safari.
    const interval = this.channelOpen ? SEND_INTERVAL_DIRECT_MS : SEND_INTERVAL_RELAY_MS;
    if (this.sending || performance.now() - this.lastSendAt < interval) {
      return;
    }
    this.sending = true;
    this.lastSendAt = performance.now();
    const {id, token} = this.joined;
    api(`/${id}/input`, token, 'POST', {input: clean})
      .then(() => this.setStatus('connected'))
      .catch((error: unknown) => this.setStatus('error', error instanceof Error ? error.message : undefined))
      .finally(() => {
        this.sending = false;
      });
  }

  private sendOverChannel(input: RemoteInput): void {
    try {
      this.channel?.send(JSON.stringify({type: 'input', input}));
    } catch {
      // The HTTPS heartbeat still carries the command.
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    clearTimeout(this.pollTimer);
    this.channel?.close();
    this.pc?.close();
    if (this.room) {
      try {
        await api(`/${this.room.id}`, this.room.hostToken, 'DELETE');
      } catch {
        // The room expires on its own.
      }
    }
  }
}
