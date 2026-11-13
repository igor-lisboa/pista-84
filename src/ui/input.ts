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
/** Gravity above this (m/s²) on the screen's vertical axis is trusted to fix the sensor's sign convention. */
const GRAVITY_CONFIDENT = 4;
/** While motion samples arrive, the Euler-angle fallback from `deviceorientation` is ignored. */
const MOTION_PRIORITY_MS = 500;

interface SensorPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Gravity in screen axes (x right, y up on the screen) for a device reading
 * `gx, gy`, rotated by the screen orientation angle (0, 90, 180 or 270).
 */
export function gravityOnScreen(gx: number, gy: number, angle: number): [number, number] {
  switch ((Math.round(angle / 90) * 90 + 360) % 360) {
    case 90:
      return [gy, -gx];
    case 180:
      return [-gx, -gy];
    case 270:
      return [-gy, gx];
    default:
      return [gx, gy];
  }
}

/**
 * How far the phone is rolled in its own screen plane, in degrees, positive when the
 * top leans right. It is read from gravity rather than Euler angles, so it does not
 * wrap or flip past 90° and does not depend on how exactly square the phone is held.
 * `sign` is +1 or -1: the platform's sign convention for the gravity reading.
 */
export function screenLean(gx: number, gy: number, angle: number, sign: number): number {
  const [sx, sy] = gravityOnScreen(gx, gy, angle);
  // Gravity reads "up" on the screen's vertical axis, so the sign is fixed by making that positive.
  const lean = Math.atan2(sign * sx, sign * sy) * (180 / Math.PI);
  // Gravity pulls a right-leaning top toward negative screen x, hence the sign flip.
  return -lean;
}

const screenAngle = (): number =>
  screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;

/** Browser autofill dispatches key events without a `key`, so it may be undefined at runtime. */
const normalizeKey = (key: string | undefined): string => {
  if (!key) return '';
  return key.length === 1 ? key.toLowerCase() : key;
};

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
  /** Whether tilt steering put the page into fullscreen, so turning it off can leave again. */
  private fullscreenByTilt = false;
  private lastSensor = 0;
  private motionSeen = 0;
  private gravitySign = 1;
  private gravitySignKnown = false;

  constructor() {
    window.addEventListener('devicemotion', (event) => this.readMotion(event));
    window.addEventListener('deviceorientation', (event) => this.readOrientation(event));
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
    // Fullscreen and the orientation lock need a very recent tap, and the sensor
    // permission prompt can take longer than that to answer: ask for the lock first.
    void this.lockLandscape();
    const orientation = DeviceOrientationEvent as unknown as SensorPermission;
    if (typeof orientation.requestPermission === 'function' && (await orientation.requestPermission()) !== 'granted') {
      this.unlockOrientation();
      throw new TiltError('tilt.denied');
    }
    // Gravity (motion) access is preferred on iOS but optional: without it the Euler angles still steer.
    const motion = window.DeviceMotionEvent as unknown as SensorPermission | undefined;
    if (typeof motion?.requestPermission === 'function') await motion.requestPermission().catch(() => 'denied' as const);
    this.tiltEnabled = true;
    this.calibrateNext = true;
    this.lastSensor = 0;
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
   * rotating the layout. Installed apps allow the lock directly; Chrome in a
   * tab only allows it in fullscreen; iOS Safari has no lock at all. When it
   * fails the game falls back to asking for landscape (see `data-rotate`).
   */
  private async lockLandscape(): Promise<void> {
    const orientation = screen.orientation;
    if (typeof orientation?.lock !== 'function') return;
    const attempt = async (): Promise<boolean> => {
      try {
        await orientation.lock('landscape');
        return true;
      } catch {
        return false;
      }
    };
    if (!(await attempt())) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
          this.fullscreenByTilt = true;
        }
      } catch {
        // Fullscreen refused (no user gesture, or not supported); the overlay fallback covers it.
      }
      if (!(await attempt())) return;
    }
    this.calibrateNext = true;
  }

  private unlockOrientation(): void {
    try {
      screen.orientation?.unlock?.();
      if (this.fullscreenByTilt && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch {
      // Nothing to unlock.
    }
    this.fullscreenByTilt = false;
  }

  private isHeld(name: string): boolean {
    return [...this.held.values()].includes(name);
  }

  /** Primary source: gravity from the accelerometer, which gives the roll without Euler wrap-around. */
  private readMotion(event: DeviceMotionEvent): void {
    const gravity = event.accelerationIncludingGravity;
    if (!gravity || gravity.x === null || gravity.y === null || gravity.x === undefined || gravity.y === undefined) return;
    this.motionSeen = performance.now();
    const [, screenY] = gravityOnScreen(gravity.x, gravity.y, screenAngle());
    if (!this.gravitySignKnown && Math.abs(screenY) > GRAVITY_CONFIDENT) {
      this.gravitySign = screenY > 0 ? 1 : -1;
      this.gravitySignKnown = true;
    }
    this.acceptSample(screenLean(gravity.x, gravity.y, screenAngle(), this.gravitySign));
  }

  /** Fallback when no motion sample is arriving: the Euler roll, read in the phone's current orientation. */
  private readOrientation(event: DeviceOrientationEvent): void {
    if (event.gamma === null && event.beta === null) return;
    if (performance.now() - this.motionSeen < MOTION_PRIORITY_MS) return;
    const angle = screenAngle();
    this.acceptSample(Math.abs(angle) === 90 ? (event.beta ?? 0) * Math.sign(angle) : (event.gamma ?? 0));
  }

  /** Turns one roll reading (degrees) into steering, relative to the calibrated neutral. */
  private acceptSample(degrees: number): void {
    this.lastSensor = performance.now();
    this.rawTilt = degrees;
    if (this.calibrateNext) {
      this.tiltZero = this.rawTilt;
      this.calibrateNext = false;
    }
    const value = (this.rawTilt - this.tiltZero) / TILT_FULL_LOCK_DEGREES;
    this.tilt = Math.abs(value) < TILT_DEAD_ZONE ? 0 : clamp(value, -1, 1);
  }
}
