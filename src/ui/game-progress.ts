import { ProgressSync } from '../net/progress-sync.ts';
import { ACCOUNT_KEY, clearAccountDevice, localAccount, type AccountIdentity } from '../net/account.ts';
import { reconcileStoredSave } from '../game/merge-progress.ts';
import type { Race } from '../game/race.ts';
import { loadSave, SAVE_KEY, type SaveData, type SaveStorage } from '../game/save.ts';
import type { RuntimeConfig } from '../shared/config.ts';

const SYNC_KEY = 'pista84.synced';

interface ProgressHost {
  isRunning(): boolean;
  changed(): void;
  storageUnavailable(): void;
}

function createStorage(): SaveStorage {
  try {
    return localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage unavailable');
      },
    };
  }
}

/** Owns save identity, cross-tab reconciliation and optional uploads. */
export class GameProgress {
  readonly save: SaveData;
  private readonly storage = createStorage();
  private owner = localAccount();
  private transitioning = false;
  private readonly sync: ProgressSync;
  private readonly host: ProgressHost;
  private cloudBackup = false;
  private syncing = false;
  private writtenAt = 0;
  private settledCoins = 0;

  constructor(config: RuntimeConfig, host: ProgressHost) {
    this.host = host;
    this.sync = new ProgressSync(this.storage, (input, init) => fetch(input, init),
      () => this.signedIn() && !host.isRunning() && !this.transitioning && this.sameAccount());
    const localSave = loadSave(this.storage);
    this.applyAccountIdentity(localSave);
    // Persist legacy IDs before queueing their first durable snapshot.
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(localSave)); } catch { /* Offline play still works. */ }
    this.sync.queue(localSave);
    this.save = loadSave({ getItem: () => JSON.stringify(localSave) }, config);
    this.writtenAt = this.save.updatedAt;
  }

  beginAccountChange(): void {
    this.transitioning = true;
    this.sync.cancel();
  }

  finishAccountChange(): void {
    this.transitioning = false;
  }

  adoptAccount(save: SaveData, user: AccountIdentity): void {
    this.sync.discard(this.save.playerId);
    this.owner = user;
    Object.assign(this.save, save);
    this.applyAccountIdentity(this.save);
  }

  signOut(): void {
    this.sync.clear();
    clearAccountDevice(this.save);
    location.reload();
  }

  accountStorageChanged(event: StorageEvent): void {
    if ((event.key === ACCOUNT_KEY || event.key === null) && !this.sameAccount()) {
      this.beginAccountChange();
      location.reload();
    }
  }

  resetRunRewards(): void {
    this.settledCoins = 0;
  }

  /** Banks coins and records earned since the last call. */
  settle(race: Race): void {
    // Take in anything another tab saved first, so earnings are added to the current wallet.
    this.reconcileWithStorage();
    this.save.coins += Math.max(0, race.coins - this.settledCoins);
    this.settledCoins = race.coins;
    this.save.best = Math.max(this.save.best, race.distance);
    this.save.bestScore = Math.max(this.save.bestScore, Math.floor(race.score));
    this.persist();
  }

  private sameAccount(): boolean {
    return localAccount()?.id === this.owner?.id;
  }

  /** Guests play fully offline: no uploads, health checks or score submissions. */
  signedIn(): boolean {
    return this.owner !== null;
  }

  async syncAtRest(): Promise<void> {
    if (!this.signedIn() || this.host.isRunning() || navigator.onLine === false || this.transitioning || !this.sameAccount()) return;
    void this.sync.flush();
    if (!this.cloudBackup) await this.checkOnline();
    await this.syncScore();
  }

  /**
   * Checks availability for the manual backup controls, without uploading saves.
   */
  async checkOnline(): Promise<void> {
    if (!this.signedIn() || this.host.isRunning() || navigator.onLine === false) return;
    try {
      const response = await fetch('/health', {signal: AbortSignal.timeout(10000)});
      if (!response.ok) return;
      const data: unknown = await response.json();
      this.cloudBackup = !!data && typeof data === 'object' && 'cloudBackup' in data && data.cloudBackup === true;
    } catch {
      // Online features are optional; local progress remains authoritative.
    }
  }

  /**
   * Sends the best score and current name once per change. The last value the
   * server accepted is remembered on this device, so a run played offline (or
   * a rename) is retried on the next pause, game end or exit.
   */
  async syncScore(): Promise<void> {
    const { save } = this;
    if (!this.signedIn() || this.host.isRunning() || navigator.onLine === false || this.transitioning || !this.sameAccount() ||
      !this.cloudBackup || this.syncing || !save.username || save.bestScore <= 0) return;
    const marker = `${save.playerId}|${save.username}|${save.bestScore}`;
    if (this.readSyncMarker() === marker) return;
    this.syncing = true;
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId: save.playerId, username: save.username, score: save.bestScore, distance: save.best }),
        signal: AbortSignal.timeout(10000),
        keepalive: true,
      });
      if (response.ok && this.sameAccount() && !this.transitioning) this.writeSyncMarker(marker);
    } catch {
      // Offline: the marker is unchanged, so the next trigger retries.
    } finally {
      this.syncing = false;
    }
  }

  private readSyncMarker(): string | null {
    try {
      return this.storage.getItem(SYNC_KEY);
    } catch {
      return null;
    }
  }

  private writeSyncMarker(marker: string): void {
    try {
      this.storage.setItem(SYNC_KEY, marker);
    } catch {
      // Not being able to remember only means one extra submission later.
    }
  }

  /**
   * Adopts a newer save that another tab or a restore wrote, so this tab never overwrites it.
   * Returns false when that save belongs to another player: this tab is stale and must not write.
   */
  private reconcileWithStorage(): boolean {
    let stored: SaveData;
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return true;
      stored = loadSave({ getItem: () => raw });
    } catch {
      return true;
    }
    if (stored.updatedAt <= this.writtenAt) return true;
    if (stored.playerId !== this.save.playerId) return false;
    Object.assign(this.save, reconcileStoredSave(stored, this.save));
    this.writtenAt = this.save.updatedAt;
    return true;
  }

  persist(): void {
    if (this.transitioning || !this.sameAccount()) return;
    this.applyAccountIdentity(this.save);
    if (!this.reconcileWithStorage()) return;
    this.save.updatedAt = Date.now();
    this.writtenAt = this.save.updatedAt;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      this.host.storageUnavailable();
    }
    this.sync.queue(this.save);
    this.host.changed();
  }

  private applyAccountIdentity(save: SaveData): void {
    if (this.owner) {
      save.playerId = this.owner.id;
      save.username = this.owner.username;
      save.history = [];
    }
  }

}
