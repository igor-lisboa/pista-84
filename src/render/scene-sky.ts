import {drawClouds, drawMountains, drawSkyline, drawSun} from './scenery.ts';
import {blendColor} from './scene-palette.ts';
import {SCREEN_BLEED} from './scene-frame.ts';
import type {FrameContext} from './scene-frame.ts';
import type {LightName} from '../game/index.ts';
import {pixelRect} from './scene-primitives.ts';

/** Sun height above the horizon, as a fraction of the sky height. */
const SUN_ALTITUDE: Readonly<Record<LightName, number>> = { day: 0.72, sunset: 0.1, night: 0.78, dawn: 0.13 };
/** Sun radius in 480px-wide canvas pixels. */
const SUN_SIZE: Readonly<Record<LightName, number>> = { day: 15, sunset: 27, night: 9, dawn: 22 };

const NIGHT_STAR_COLOR = '#d1dded';
const STAR_COUNT = 40;
const SKY_BANDS = 28;

/** Sky, sun, stars, clouds, ridges and city, each panning at its own rate as the heading changes. */
export function paintSky(ctx: CanvasRenderingContext2D, f: FrameContext, heading: number, cameraOffset: number): void {
  const c = ctx;
  const { w, horizon, env, palette, bendNow } = f;
  paintSkyBands(ctx, f);
  paintStars(ctx, f);
  const altitude = SUN_ALTITUDE[env.from] * (1 - env.mix) + SUN_ALTITUDE[env.to] * env.mix;
  const size = SUN_SIZE[env.from] * (1 - env.mix) + SUN_SIZE[env.to] * env.mix;
  drawSun(c, w, horizon, w * 0.68 - bendNow * 14, altitude * horizon, palette.sun, size);
  c.globalAlpha = 1 - env.night * 0.7;
  drawClouds(c, w, horizon, f.clock);
  c.globalAlpha = 1;
  drawMountains(c, w, horizon, heading, palette.farRidge, palette.nearRidge);
  c.globalAlpha = 0.9;
  drawSkyline(c, w, horizon, env.night, -bendNow * 26 - cameraOffset * 0.1);
  c.globalAlpha = 1;
  paintHorizonHaze(ctx, f);
  pixelRect(ctx, -SCREEN_BLEED, horizon + 2, w + SCREEN_BLEED * 2, f.roadH + SCREEN_BLEED, palette.grassA);
}

function paintSkyBands(ctx: CanvasRenderingContext2D, f: FrameContext): void {
  const { w, horizon, palette } = f;
  for (let i = 0; i < SKY_BANDS; i++) {
    const bleed = i ? 0 : SCREEN_BLEED;
    const color = blendColor(palette.skyTop, palette.haze, (i / (SKY_BANDS - 1)) ** 1.5);
    pixelRect(ctx, -SCREEN_BLEED, (i * horizon) / SKY_BANDS - bleed, w + 40, horizon / SKY_BANDS + 1 + bleed, color);
  }
}

function paintStars(ctx: CanvasRenderingContext2D, f: FrameContext): void {
  const { w, horizon, env } = f;
  if (env.night <= 0.3) return;
  const c = ctx;
  c.globalAlpha = env.night;
  for (let i = 0; i < STAR_COUNT; i++) {
    const size = 1 + (i % 5 === 0 ? 1 : 0);
    pixelRect(ctx, (i * 137) % w, (i * 31) % (horizon * 0.55), size, size, NIGHT_STAR_COLOR);
  }
  c.globalAlpha = 1;
}

function paintHorizonHaze(ctx: CanvasRenderingContext2D, f: FrameContext): void {
  const c = ctx;
  const { w, horizon, palette } = f;
  const haze = c.createLinearGradient(0, horizon * 0.55, 0, horizon + 4);
  haze.addColorStop(0, `${palette.haze}00`);
  haze.addColorStop(1, `${palette.haze}b0`);
  c.fillStyle = haze;
  c.fillRect(-SCREEN_BLEED, horizon * 0.55, w + 40, horizon * 0.45 + 4);
}
