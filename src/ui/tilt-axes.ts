export interface ScreenReading {
  readonly landscape: boolean;
  readonly angle: number | null;
  readonly legacyAngle: number | null;
  readonly type: string;
}

function quadrant(angle: number | null): number | null {
  return angle === null || !Number.isFinite(angle) ? null : (Math.round(angle / 90) * 90 + 360) % 360;
}

/** Resolve display axes, not a steering center, when rotation metadata lags the viewport. */
export class WheelAxes {
  private layout: boolean | null = null;
  private inferred: number | null = null;

  resolve(gx: number, gy: number, reading: ScreenReading): number {
    if (this.layout !== reading.landscape) {
      this.layout = reading.landscape;
      this.inferred = null;
    }
    const angle = quadrant(reading.angle), legacy = quadrant(reading.legacyAngle);
    if (legacy !== null && (legacy % 180 !== 0) === reading.landscape) return legacy;
    const matchesType = reading.type.startsWith(reading.landscape ? 'landscape' : 'portrait');
    // Type and angle may update in separate browser events. A landscape type
    // paired with zero degrees is also ambiguous with a landscape-natural tablet.
    if (angle !== null && matchesType && !(reading.landscape && angle % 180 === 0)) return angle;
    if (angle !== null && (angle % 180 !== 0) === reading.landscape) return angle;
    if (this.inferred !== null) return this.inferred;
    // A sideways portrait-natural phone has gravity along device X. Native-landscape
    // tablets retain device Y; a flat phone supplies neither strong axis yet.
    if (Math.abs(gx) >= 3 && Math.abs(gx) > Math.abs(gy) * 1.5) {
      this.inferred = gx < 0 ? 90 : 270;
    } else if (Math.abs(gy) >= 3 && Math.abs(gy) > Math.abs(gx) * 1.5) {
      this.inferred = gy < 0 ? 180 : 0;
    }
    return this.inferred ?? angle ?? 0;
  }
}
