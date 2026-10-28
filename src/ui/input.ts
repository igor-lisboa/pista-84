import type { DriveInput } from '../game/index.ts';
import { clamp } from '../game/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { RemoteInput } from '../net/remote.ts';

/** Raised when tilt steering cannot be enabled; carries the message to show. */
export class TiltError extends Error {
  readonly key: MessageKey;

  constructor(key: MessageKey) {
    super(key);
    this.key = key;
  }
}

const TILT_FULL_LOCK_DEGREES = 25;
const TILT_DEAD_ZONE = 0.06;
const TILT_SENSOR_TIMEOUT_MS = 5000;

interface OrientationPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const normalizeKey = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

/**
 * Merges every control scheme — keyboard, on-screen buttons, device tilt and a
 * paired phone — into one `DriveInput` per frame.
 */
export class InputController {
  /** Called when tilt steering turns on or off (including the automatic timeout). */
  onTiltChange: (enabled: boolean) => void = () => {};
  /** Called when the tilt sensor never reported a value. */
  onTiltSilent: () => void = () => {};

  tiltEnabled = false;

  private readonly keys = new Set<string>();
  private readonly held = new Map<number | string, string>();
  private remote: Partial<RemoteInput> = {};
  private tilt = 0;
  private rawTilt = 0;
  private tiltZero = 0;
  private calibrateNext = false;
  private lastSensor = 0;

  constructor() {
    window.addEventListener('deviceorientation', (event) => this.readSensor(event));
    screen.orientation?.addEventListener?.('change', () => {
      this.calibrateNext = true;
    });
    window.addEventListener('orientationchange', () => {
      this.calibrateNext = true;
    });
  }

  read(): DriveInput {
    const pressed = (...names: string[]): boolean => names.some((name) => this.keys.has(name));
    const right = pressed('ArrowRight', 'd') || this.isHeld('right') ? 1 : 0;
    const left = pressed('ArrowLeft', 'a') || this.isHeld('left') ? 1 : 0;
    const tilt = this.tiltEnabled ? this.tilt : 0;
    return {
      steer: clamp(right - left + tilt + (this.remote.steer ?? 0), -1, 1),
      accelerate: pressed('ArrowUp', 'w') || this.isHeld('accelerate') || this.remote.accelerate === true,
      brake: pressed('ArrowDown', 's', ' ') || this.isHeld('brake') || this.remote.brake === true,
    };
  }

  clear(): void {
    this.keys.clear();
    this.held.clear();
    this.remote = {};
    this.tilt = 0;
    document.querySelectorAll('.pressed').forEach((element) => element.classList.remove('pressed'));
  }

  setRemote(input: Partial<RemoteInput>): void {
    this.remote = input;
  }

  clearRemote(): void {
    this.remote = {};
  }

  /** Records a key press and returns its normalised name. */
  keyDown(event: KeyboardEvent): string {
    const key = normalizeKey(event.key);
    this.keys.add(key);
    return key;
  }

  keyUp(event: KeyboardEvent): void {
    this.keys.delete(normalizeKey(event.key));
  }

  /** Wires every `[data-control]` button under `root` to the held-button map. */
  bindButtons(root: ParentNode = document): void {
    for (const element of root.querySelectorAll<HTMLElement>('[data-control]')) {
      const name = element.dataset.control!;
      const press = (id: number | string, event: Event): void => {
        event.preventDefault();
        this.held.set(id, name);
        element.classList.add('pressed');
      };
      const release = (id: number | string): void => {
        this.held.delete(id);
        if (!this.isHeld(name)) element.classList.remove('pressed');
      };

      if (window.PointerEvent) {
        element.addEventListener('pointerdown', (event) => {
          press(event.pointerId, event);
          try {
            element.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture is optional.
          }
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          element.addEventListener(type, (event) => release((event as PointerEvent).pointerId));
        }
      } else {
        element.addEventListener(
          'touchstart',
          (event) => {
            for (const touch of event.changedTouches) press(touch.identifier, event);
          },
          { passive: false },
        );
        for (const type of ['touchend', 'touchcancel']) {
          element.addEventListener(
            type,
            (event) => {
              event.preventDefault();
              for (const touch of (event as TouchEvent).changedTouches) release(touch.identifier);
            },
            { passive: false },
          );
        }
        element.addEventListener('mousedown', (event) => press('mouse', event));
        window.addEventListener('mouseup', () => release('mouse'));
      }
      // Safari may still interpret rapid taps as zoom when only pointerdown is cancelled.
      // Cancel the native touch completion too, including on Pointer Events browsers.
      element.addEventListener('touchend', (event) => event.preventDefault(), { passive: false });
      element.addEventListener('dblclick', (event) => event.preventDefault());
      element.addEventListener('contextmenu', (event) => event.preventDefault());
    }
  }

  /** Turns tilt steering on or off. Throws `TiltError` when it is unavailable. */
  async toggleTilt(): Promise<boolean> {
    if (this.tiltEnabled) {
      this.tiltEnabled = false;
      this.tilt = 0;
      this.unlockOrientation();
      this.onTiltChange(false);
      return false;
    }
    if (!window.DeviceOrientationEvent) throw new TiltError('tilt.noSensor');
    if (!window.isSecureContext) throw new TiltError('tilt.https');
    const permission = DeviceOrientationEvent as unknown as OrientationPermission;
    if (typeof permission.requestPermission === 'function' && (await permission.requestPermission()) !== 'granted') {
      throw new TiltError('tilt.denied');
    }
    this.tiltEnabled = true;
    this.calibrateNext = true;
    this.lastSensor = 0;
    void this.lockLandscape();
    this.onTiltChange(true);
    setTimeout(() => {
      if (this.tiltEnabled && !this.lastSensor) {
        this.tiltEnabled = false;
        this.unlockOrientation();
        this.onTiltChange(false);
        this.onTiltSilent();
      }
    }, TILT_SENSOR_TIMEOUT_MS);
    return true;
  }

  /** Makes the current phone angle the steering centre. */
  calibrate(): void {
    this.tiltZero = this.rawTilt;
    this.tilt = 0;
  }

  /**
   * Pins the page to landscape so turning the phone steers the car instead of
   * rotating the layout. Browsers usually require fullscreen for the lock; where
   * it is unsupported (e.g. iOS Safari) tilt keeps working without it.
   */
  private async lockLandscape(): Promise<void> {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen is only a prerequisite for the lock; try without it.
    }
    try {
      await screen.orientation?.lock?.('landscape');
      this.calibrateNext = true;
    } catch {
      // Orientation lock is not available here.
    }
  }

  private unlockOrientation(): void {
    try {
      screen.orientation?.unlock?.();
    } catch {
      // Nothing to unlock.
    }
  }

  private isHeld(name: string): boolean {
    return [...this.held.values()].includes(name);
  }

  private readSensor(event: DeviceOrientationEvent): void {
    if (event.gamma === null && event.beta === null) return;
    this.lastSensor = performance.now();
    const angle = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
    this.rawTilt = Math.abs(angle) === 90 ? (event.beta ?? 0) * Math.sign(angle) : (event.gamma ?? 0);
    if (this.calibrateNext) {
      this.tiltZero = this.rawTilt;
      this.calibrateNext = false;
    }
    const value = (this.rawTilt - this.tiltZero) / TILT_FULL_LOCK_DEGREES;
    this.tilt = Math.abs(value) < TILT_DEAD_ZONE ? 0 : clamp(value, -1, 1);
  }
}
