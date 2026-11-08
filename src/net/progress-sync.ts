import {loadSave} from '../game/save.ts';
import type {SaveData, SaveStorage} from '../game/save.ts';
import {isPlayerId, newPlayerId} from '../game/username.ts';

const DEVICE_KEY = 'pista84.device';
const OUTBOX_KEY = 'pista84.progress-outbox';
const ACK_PREFIX = 'pista84.progress-ack:';

/** Durable local outbox. Only a successful server acknowledgement removes a save. */
export class ProgressSync {
  private readonly deviceId: string;
  private running = false;
  private retryRequested = false;

  constructor(
    privateStorage: SaveStorage,
    request: typeof fetch = (input, init) => fetch(input, init),
    canUpload: () => boolean = () => true,
  ) {
    this.storage = privateStorage;
    this.request = request;
    this.canUpload = canUpload;
    const existing = this.read(DEVICE_KEY);
    this.deviceId = isPlayerId(existing) ? existing : newPlayerId();
    this.write(DEVICE_KEY, this.deviceId);
  }

  private readonly storage: SaveStorage;
  private readonly request: typeof fetch;
  private readonly canUpload: () => boolean;
  private readonly fallback = new Map<string, string>();

  private read(key: string): string | null {
    if (this.fallback.has(key)) return this.fallback.get(key)!;
    try { return this.storage.getItem(key); }
    catch { return this.fallback.get(key) ?? null; }
  }

  private write(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
      this.fallback.delete(key);
    } catch {
      this.fallback.set(key, value);
    }
  }

  private pending(): Record<string, SaveData> {
    try {
      const raw = JSON.parse(this.read(OUTBOX_KEY) ?? '{}');
      const result: Record<string, SaveData> = {};
      for (const [id, value] of Object.entries(raw)) {
        if (isPlayerId(id)) result[id] = loadSave({getItem: () => JSON.stringify(value)});
      }
      return result;
    } catch { return {}; }
  }

  queue(save: SaveData): void {
    const snapshot = JSON.stringify(save);
    if (this.read(ACK_PREFIX + save.playerId) === snapshot) return;
    const pending = this.pending();
    if (pending[save.playerId]?.updatedAt > save.updatedAt) return;
    pending[save.playerId] = structuredClone(save);
    this.write(OUTBOX_KEY, JSON.stringify(pending));
  }

  async flush(): Promise<void> {
    // Keep the outbox untouched while the browser already knows it is offline.
    if (!this.canUpload() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    if (this.running) {
      this.retryRequested = true;
      return;
    }
    this.running = true;
    try {
      for (const [playerId, save] of Object.entries(this.pending())) {
        if (!this.canUpload()) return;
        const url = `/api/progress?device=${this.deviceId}`;
        const headers = {'x-player-id': playerId, 'content-type': 'application/json'};
        try {
          const current = await this.request(url, {headers, signal: AbortSignal.timeout(10000)});
          if (!current.ok) continue;
          const {revision} = await current.json() as {revision: number};
          if (!Number.isSafeInteger(revision) || revision < 0) continue;
          if (!this.canUpload()) return;
          const response = await this.request(url, {
            method: 'PUT', headers, body: JSON.stringify({save, revision}),
            signal: AbortSignal.timeout(10000), keepalive: true,
          });
          if (!response.ok) continue;
          const snapshot = JSON.stringify(save);
          this.write(ACK_PREFIX + playerId, snapshot);
          const pending = this.pending();
          // A purchase or autosave may have arrived while the upload was running.
          if (JSON.stringify(pending[playerId]) === snapshot) delete pending[playerId];
          this.write(OUTBOX_KEY, JSON.stringify(pending));
        } catch {
          // Offline, timeout or lost response: replay the outbox on the next trigger.
        }
      }
    } finally {
      this.running = false;
      if (this.retryRequested) {
        this.retryRequested = false;
        await this.flush();
      }
    }
  }
}
