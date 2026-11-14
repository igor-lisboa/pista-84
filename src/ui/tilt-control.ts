import type {MessageKey} from '../i18n/index.ts';
import {LandscapeLock} from './landscape-lock.ts';
import {WheelSteering} from './tilt-math.ts';

export class TiltError extends Error {
  readonly key: MessageKey;
  constructor(key: MessageKey) { super(key); this.key = key; }
}

const TIMEOUT_MS = 5000;
const screenAngle = (): number => screen.orientation?.angle
  ?? (window as Window & {orientation?: number}).orientation ?? 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

async function permission(sensor: unknown): Promise<boolean> {
  if (!sensor || (typeof sensor !== 'object' && typeof sensor !== 'function') || !('requestPermission' in sensor)) return true;
  const request = sensor.requestPermission;
  return typeof request !== 'function' || await request.call(sensor) === 'granted';
}

/** Sensor permissions/lifetime and absolute wheel input, independent of keyboard/touch transport. */
export class TiltControl {
  enabled = false;
  onChange: (enabled: boolean) => void = () => {};
  onSilent: () => void = () => {};
  private wheel = new WheelSteering();
  private readonly landscape = new LandscapeLock();
  private changing = false;
  private lastSensor = 0;
  private motionSeen = -Infinity;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    window.addEventListener('devicemotion', event => this.readMotion(event));
    window.addEventListener('deviceorientation', event => this.readOrientation(event));
  }

  get steer(): number { return this.enabled && innerWidth >= innerHeight ? this.wheel.value : 0; }
  clear(): void { this.wheel.clear(); }

  async toggle(): Promise<boolean> {
    if (this.changing) return this.enabled;
    this.changing = true;
    try {
      if (this.enabled) { this.stop(); return false; }
      if (!window.DeviceOrientationEvent && !window.DeviceMotionEvent) throw new TiltError('tilt.noSensor');
      if (!window.isSecureContext) throw new TiltError('tilt.https');
      void this.landscape.acquire();
      try {
        // Launch both iOS requests from the tap instead of waiting for the first prompt to resolve.
        const orientation = permission(window.DeviceOrientationEvent);
        const motion = permission(window.DeviceMotionEvent).catch(() => false);
        if (!await orientation) throw new TiltError('tilt.denied');
        await motion;
      } catch {
        this.landscape.release();
        throw new TiltError('tilt.denied');
      }
      this.wheel = new WheelSteering();
      this.motionSeen = -Infinity;
      this.lastSensor = performance.now();
      this.enabled = true;
      this.onChange(true);
      this.timer = setInterval(() => {
        if (performance.now() - this.lastSensor >= TIMEOUT_MS) { this.stop(); this.onSilent(); }
      }, 500);
      return true;
    } finally { this.changing = false; }
  }

  private stop(): void {
    this.enabled = false;
    this.wheel.clear();
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.landscape.release();
    this.onChange(false);
  }

  private readMotion(event: DeviceMotionEvent): void {
    if (!this.enabled) return;
    const gravity = event.accelerationIncludingGravity;
    if (!gravity || !finite(gravity.x) || !finite(gravity.y)) return;
    this.lastSensor = this.motionSeen = performance.now();
    this.wheel.motion(gravity.x, gravity.y, screenAngle(), this.lastSensor);
  }

  private readOrientation(event: DeviceOrientationEvent): void {
    if (!this.enabled || !finite(event.beta) || !finite(event.gamma)) return;
    const now = performance.now();
    if (now - this.motionSeen < 500) return;
    this.lastSensor = now;
    this.wheel.orientation(event.beta, event.gamma, screenAngle(), now);
  }
}
