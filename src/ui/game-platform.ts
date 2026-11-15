import type { Race } from '../game/race.ts';
import type { Renderer } from '../render/renderer.ts';
import type { InputController } from './input.ts';
import type { GameProgress } from './game-progress.ts';
import type { InstallPrompt } from './settings.ts';
import { isNativeApp } from './platform-capabilities.ts';

interface PlatformHost {
  readonly input: InputController;
  readonly race: Race;
  readonly renderer: Renderer;
  readonly progress: GameProgress;
  isModalOpen(): boolean;
  start(): void;
  resume(): void;
  pause(): void;
  settle(): void;
  unlockAudio(): void;
}

/** Browser events and display lifecycle; no simulation or persistence rules. */
export class GamePlatform {
  private readonly host: PlatformHost;
  private installPrompt: InstallPrompt | null = null;

  constructor(host: PlatformHost) { this.host = host; }

  takeInstallPrompt(): InstallPrompt | null {
    const prompt = this.installPrompt;
    this.installPrompt = null;
    return prompt;
  }

  resize(): void {
    const height = window.visualViewport?.height ?? innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    this.host.renderer.resize();
    this.checkRotation();
  }

  /**
   * Tilt steering needs a landscape screen. Where the orientation lock is not
   * available the overlay asks the player to turn the phone, and a running race
   * pauses rather than being played blind in a portrait layout.
   */
  checkRotation(): void {
    const needed = this.host.input.tiltEnabled && innerHeight > innerWidth;
    document.body.dataset.rotate = needed ? 'needed' : '';
    if (needed && this.host.race.status === 'running') this.host.pause();
  }

  async keepScreenAwake(): Promise<void> {
    try {
      if ('wakeLock' in navigator && !document.hidden) await navigator.wakeLock.request('screen');
    } catch {
      // Wake lock is a nicety only.
    }
  }

  /**
   * Double taps, pinch zoom and text selection must not break play. Form fields keep
   * their own behaviour; everything else ignores those gestures.
   */
  private bindGestureGuards(): void {
    const isTextField = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && target.matches('input,textarea,select,[contenteditable="true"]');
    // Double-tap zoom is stopped by the viewport meta and `touch-action: manipulation`; cancelling
    // touchend here would also swallow the click of a quick repeat tap on a menu button.
    document.addEventListener('touchmove', (event) => {
      if (event.touches.length > 1) event.preventDefault();
    }, { passive: false });
    for (const type of ['gesturestart', 'gesturechange', 'gestureend'] as const) {
      document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
    }
    document.addEventListener('dblclick', (event) => {
      if (!isTextField(event.target)) event.preventDefault();
    });
    document.addEventListener('selectstart', (event) => {
      if (!isTextField(event.target)) event.preventDefault();
    });
    // Ctrl/Cmd + wheel and + / - zoom the browser page; the game already has its own camera.
    window.addEventListener('wheel', (event) => {
      if (event.ctrlKey) event.preventDefault();
    }, { passive: false });
  }

  bind(): void {
    window.addEventListener('storage', event => this.host.progress.accountStorageChanged(event));
    window.addEventListener('appinstalled', () => { this.installPrompt = null; });
    window.addEventListener('beforeinstallprompt', event => {
      if (!('prompt' in event) || typeof event.prompt !== 'function') return;
      event.preventDefault();
      const prompt = event.prompt;
      this.installPrompt = {
        prompt: async () => {
          const result: unknown = prompt.call(event);
          return result;
        },
      };
    });
    // The first tap or key press unlocks the Web Audio context for the menu music.
    const unlockOnce = (): void => {
      this.host.unlockAudio();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce);
    window.addEventListener('keydown', unlockOnce);

    window.addEventListener('keydown', (event) => {
      const target = event.target;
      if ((target instanceof HTMLElement && target.matches('input,textarea,select')) || this.host.isModalOpen()) return;
      const key = this.host.input.keyDown(event);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
      if (event.repeat) return;
      if (key === 'Enter' && this.host.race.status !== 'running') {
        if (this.host.race.status === 'paused') this.host.resume();
        else this.host.start();
      }
      if (key === 'p' || key === 'Escape') this.host.pause();
    });
    window.addEventListener('keyup', (event) => this.host.input.keyUp(event));
    this.bindGestureGuards();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.host.input.clear();
        if (this.host.race.status === 'running') this.host.pause();
        else {
          this.host.progress.persist();
          void this.host.progress.syncAtRest();
        }
      }
    });
    window.addEventListener('pagehide', () => {
      if (this.host.race.status === 'running') {
        this.host.pause();
        return;
      }
      this.host.settle();
      this.host.input.clear();
      void this.host.progress.syncAtRest();
    });
    // Safari may fire blur when its browser chrome changes focus; on touch devices
    // visibility is the pause authority instead.
    window.addEventListener('blur', () => {
      if (matchMedia('(pointer:coarse)').matches) return;
      this.host.input.clear();
      if (this.host.race.status === 'running') this.host.pause();
    });
  }
}

export function registerGameWorker(): void {
  if ('serviceWorker' in navigator && !isNativeApp()) {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update()).catch(() => undefined);
  }
}

export function startGameFrames(tick: (dt: number, now: number) => void): void {
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt, now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
