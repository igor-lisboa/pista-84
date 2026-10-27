import { RemoteConnection, type RemoteInput } from '../net/remote.ts';
import { t } from '../i18n/index.ts';
import { qrImage } from '../qr.ts';
import { byId } from './dom.ts';
import type { InputController } from './input.ts';

/** What the remote-controller dialog needs from the running game. */
export interface RemoteHost {
  readonly input: InputController;
  isRunning(): boolean;
  isPaused(): boolean;
  start(): void;
  resume(): void;
  pause(): void;
  openModal(): void;
  closeModal(): void;
  isModalOpen(): boolean;
  notify(message: string): void;
}

/** A silent phone is treated as disconnected after this long. */
const INPUT_TIMEOUT_MS = 2000;

const isNativeApp = (): boolean =>
  (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;

/** "Phone as controller": shows a pairing QR code and feeds the paired phone's input to the game. */
export class RemoteDialog {
  private readonly host: RemoteHost;
  private connection: RemoteConnection | null = null;
  private inputTimer: ReturnType<typeof setTimeout> | undefined;
  private startHeld = false;
  private pauseHeld = false;

  constructor(host: RemoteHost) {
    this.host = host;
  }

  async open(): Promise<void> {
    if (isNativeApp()) {
      this.host.notify(t('remote.native'));
      return;
    }
    this.host.openModal();
    const previous = this.connection;
    this.connection = null;
    await previous?.close();

    byId('modalBody').innerHTML = `
      <div class="remote-content">
        <span class="label">${t('remote.label')}</span>
        <h1>${t('remote.title')}<span>.</span></h1>
        <p id="remoteState">${t('remote.preparing')}</p>
        <div id="remoteLink"></div>
        <button id="remotePlay" class="primary" hidden><span>${t('remote.play')}</span></button>
        <button id="pairAgain" class="secondary">${t('remote.again')}</button>
        <p>${t('remote.help')}</p>
      </div>`;
    byId('pairAgain').onclick = () => void this.open();
    byId('remotePlay').onclick = () => {
      this.host.closeModal();
      this.host.start();
    };

    try {
      const current = new RemoteConnection({
        onStatus: (state, detail) => {
          if (this.connection !== current) return;
          if (state === 'connected') {
            this.setState(t('remote.connected', { detail: detail ?? '' }));
            const play = document.getElementById('remotePlay');
            if (play) play.hidden = false;
          }
          if (state === 'disconnected' || state === 'error') {
            this.disconnect();
            this.setState(detail ?? t('remote.lost'));
          }
        },
        onInput: (input) => {
          if (this.connection === current) this.handleInput(input);
        },
      });
      this.connection = current;
      const room = await current.host();
      if (this.connection !== current) return;

      const url = await this.pairingUrl(room.id, room.joinToken);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = t('remote.open');
      const image = document.createElement('img');
      image.alt = t('remote.qrAlt');
      image.src = await qrImage(url);
      const container = document.getElementById('remoteLink');
      if (!container) return;
      container.replaceChildren(image, link);
      this.setState(t('remote.scan'));
    } catch (error) {
      this.setState(error instanceof Error ? error.message : String(error));
    }
  }

  /** Drops the paired phone's input and pauses a running race. */
  disconnect(): void {
    clearTimeout(this.inputTimer);
    this.host.input.clearRemote();
    this.startHeld = false;
    this.pauseHeld = false;
    if (this.host.isRunning()) this.host.pause();
  }

  private setState(text: string): void {
    const element = document.getElementById('remoteState');
    if (element) element.textContent = text;
  }

  private handleInput(input: Partial<RemoteInput>): void {
    this.host.input.setRemote(input);
    clearTimeout(this.inputTimer);
    this.inputTimer = setTimeout(() => this.disconnect(), INPUT_TIMEOUT_MS);

    if (input.start && !this.startHeld) {
      if (this.host.isModalOpen()) this.host.closeModal();
      if (this.host.isPaused()) this.host.resume();
      else if (!this.host.isRunning()) this.host.start();
    }
    if (input.pause && !this.pauseHeld && this.host.isRunning()) this.host.pause();
    this.startHeld = input.start === true;
    this.pauseHeld = input.pause === true;
  }

  /** The URL the phone opens, with this machine's LAN address substituted for localhost. */
  private async pairingUrl(roomId: string, joinToken: string): Promise<string> {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set('controller', roomId);
    url.searchParams.set('token', joinToken);
    if (new URLSearchParams(location.search).get('transport') === 'relay') url.searchParams.set('transport', 'relay');
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      try {
        const data = (await (await fetch('/network')).json()) as { host?: string };
        if (data.host) url.hostname = data.host;
      } catch {
        // Keep localhost; the phone can still be paired by typing the address.
      }
    }
    return url.href;
  }
}
