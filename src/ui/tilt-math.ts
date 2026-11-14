import {clamp} from '../game/math.ts';

const TO_RADIANS = Math.PI / 180;
const MIN_GRAVITY = 3;
const FULL_LOCK = 25;
const DEAD_ZONE = 0.06;
const SMOOTHING_MS = 45;

/** Device gravity rotated into screen-right / screen-up axes. */
export function gravityOnScreen(gx: number, gy: number, angle: number): [number, number] {
  switch ((Math.round(angle / 90) * 90 + 360) % 360) {
    case 90: return [gy, -gx];
    case 180: return [-gx, -gy];
    case 270: return [-gy, gx];
    default: return [gx, gy];
  }
}

/** Positive when the top leans right; sign accounts for accelerometer platform conventions. */
export function screenLean(gx: number, gy: number, angle: number, sign: number): number {
  const [x, y] = gravityOnScreen(gx, gy, angle);
  return -Math.atan2(sign * x, sign * y) / TO_RADIANS;
}

/** W3C Z-X'-Y'' orientation projected onto gravity; yaw is irrelevant to steering. */
export function orientationGravity(beta: number, gamma: number): [number, number] {
  return [-Math.cos(beta * TO_RADIANS) * Math.sin(gamma * TO_RADIANS) * 9.81,
    Math.sin(beta * TO_RADIANS) * 9.81];
}

/** Absolute level is neutral. Filtering never learns a new steering center. */
export class WheelSteering {
  value = 0;
  private sign: number | null = null;
  private lastTime: number | null = null;

  clear(): void { this.value = 0; this.lastTime = null; }

  motion(gx: number, gy: number, angle: number, now: number): number {
    const [x, y] = gravityOnScreen(gx, gy, angle);
    if (this.sign === null && Math.abs(y) >= MIN_GRAVITY) this.sign = y > 0 ? 1 : -1;
    const degrees = this.sign === null || Math.hypot(x, y) < MIN_GRAVITY ? 0
      : screenLean(gx, gy, angle, this.sign);
    return this.accept(degrees, now);
  }

  orientation(beta: number, gamma: number, angle: number, now: number): number {
    const [gx, gy] = orientationGravity(beta, gamma);
    const degrees = Math.hypot(gx, gy) < MIN_GRAVITY ? 0 : screenLean(gx, gy, angle, 1);
    return this.accept(degrees, now);
  }

  private accept(degrees: number, now: number): number {
    if (!Number.isFinite(degrees) || !Number.isFinite(now)) return this.value;
    const normalized = degrees / FULL_LOCK;
    const target = Math.abs(normalized) < DEAD_ZONE ? 0 : clamp(normalized, -1, 1);
    const weight = this.lastTime === null ? 1 : 1 - Math.exp(-clamp(now - this.lastTime, 0, 250) / SMOOTHING_MS);
    this.value += (target - this.value) * weight;
    if (Math.abs(this.value) < 0.001) this.value = 0;
    this.lastTime = now;
    return this.value;
  }
}
