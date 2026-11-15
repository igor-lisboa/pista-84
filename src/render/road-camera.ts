import {PATH_UNIT, PLAYER_T, WALL, clamp, depthToScreen, roadBend, screenToDepth} from '../game/index.ts';
import {RoadSurface} from './road-surface.ts';
import {blendColor} from './scene-palette.ts';
import {FRAME_WIDTH, FRAME_HEIGHT, HORIZON_RATIO, ROAD_SAMPLES as SAMPLES, SCREEN_BLEED, roadHalfFraction} from './scene-frame.ts';
import type {FrameContext} from './scene-frame.ts';
import {pixelRect, pixelQuad} from './scene-primitives.ts';

/** Keeps reusable curvature buffers and projects every road-bound scene layer. */
export class RoadCamera {
  private readonly ctx: CanvasRenderingContext2D;
  cameraOffset = 0;
  private readonly offsets = new Float32Array(SAMPLES + 1);
  private readonly rawOffsets = new Float32Array(SAMPLES + 1);
  private readonly depths = Float64Array.from({length: SAMPLES + 1}, (_, i) => screenToDepth(i / SAMPLES));
  private readonly surface = new RoadSurface(FRAME_WIDTH, FRAME_HEIGHT, Math.round(FRAME_HEIGHT * HORIZON_RATIO));

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Lateral road offset per depth row: curvature is integrated along the *upcoming* track, so a
   * bend enters at the horizon and sweeps toward the car instead of the whole road swaying rigidly.
   */
  update(path: number, seed: number, cameraOffset: number): void {
    this.cameraOffset = cameraOffset;
    const w = FRAME_WIDTH;
    const raw = this.rawOffsets;
    const playerSample = Math.round(PLAYER_T * SAMPLES);
    const playerDepth = screenToDepth(PLAYER_T);
    for (const dir of [-1, 1]) {
      let offset = 0;
      let slope = 0;
      let prev = playerDepth;
      for (let i = playerSample + dir; i >= 0 && i <= SAMPLES; i += dir) {
        const u = this.depths[i]!;
        const du = u - prev;
        const change = roadBend(path + ((u + prev) / 2) * PATH_UNIT, seed) * du;
        offset += (slope + change * 0.5) * du;
        slope += change;
        raw[i] = offset;
        prev = u;
      }
    }
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const px = raw[i]! * 10 * roadHalfFraction(t) * w;
      const limit = w * 0.55;
      this.offsets[i] = limit * Math.tanh(px / limit);
    }
  }

  /** Screen x of the road centre at screen depth `t`. */
  readonly centerAt = (t: number): number => {
    const w = FRAME_WIDTH;
    const f = clamp(t, 0, 1) * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(f));
    const k = f - i;
    const o = this.offsets[i]! * (1 - k) + this.offsets[i + 1]! * k;
    return w * 0.5 + o - this.cameraOffset * (roadHalfFraction(clamp(t, 0, 1)) / roadHalfFraction(PLAYER_T));
  };

  /** Ground, kerbs, asphalt and lane markings are painted from the horizon to the camera, row by row. */
  paintRows(f: FrameContext): void {
    const wet = f.env.rain;
    const asphalt: readonly [string, string] = [blendColor('#50545f', '#4f6176', wet), blendColor('#484c57', '#475a70', wet)];
    this.surface.paint(this.ctx, {path: f.path, grassA: f.palette.grassA, grassB: f.palette.grassB,
      asphalt, centerAt: t => this.centerAt(t)});
  }

  paintGuardRail(f: FrameContext): void {
    for (const side of [-1, 1]) {
      this.paintRailBand(f, side);
      this.paintRailPosts(f, side);
    }
  }

  private paintRailBand(f: FrameContext, side: number): void {
    const { w, horizon, roadH } = f;
    for (let i = 1; i < SAMPLES; i++) {
      const t1 = i / SAMPLES;
      const t2 = (i + 1) / SAMPLES;
      const half1 = w * roadHalfFraction(t1);
      const half2 = w * roadHalfFraction(t2);
      const x1 = this.centerAt(t1) + side * half1 * WALL;
      const x2 = this.centerAt(t2) + side * half2 * WALL;
      const y1 = horizon + t1 * roadH - w * 0.026 * t1;
      const y2 = horizon + t2 * roadH - w * 0.026 * t2;
      pixelQuad(this.ctx, x1, y1, Math.max(0.6, w * 0.003 * t1), x2, y2, Math.max(0.6, w * 0.003 * t2), '#b8c4cc');
    }
  }

  private paintRailPosts(f: FrameContext, side: number): void {
    const { w, horizon, roadH, scroll } = f;
    const spacing = 0.025;
    for (let k = Math.ceil(scroll / spacing); k <= (scroll + 1) / spacing; k++) {
      const t = depthToScreen(k * spacing - scroll);
      if (t < 0.035 || t > 1) continue;
      const x = this.centerAt(t) + side * w * roadHalfFraction(t) * WALL;
      const y = horizon + t * roadH;
      pixelRect(this.ctx, x - w * 0.002 * t, y - w * 0.026 * t, w * 0.004 * t, w * 0.026 * t, '#647382');
    }
  }

  paintDistanceFog(f: FrameContext): void {
    const c = this.ctx;
    const { w, horizon, roadH, palette } = f;
    c.globalAlpha = 0.55;
    const fog = c.createLinearGradient(0, horizon, 0, horizon + roadH * 0.45);
    fog.addColorStop(0, palette.haze);
    fog.addColorStop(1, `${palette.haze}00`);
    c.fillStyle = fog;
    c.fillRect(-SCREEN_BLEED, horizon + 2, w + 40, roadH * 0.45);
    c.globalAlpha = 1;
  }

}
