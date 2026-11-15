import {hash} from './noise.ts';
import {blendColor} from './scene-palette.ts';
import type {FrameContext} from './scene-frame.ts';

export function paintWeather(ctx: CanvasRenderingContext2D, f: FrameContext): void {
  if (f.env.rain > 0) paintRain(ctx, f);
  if (f.env.fog > 0) paintFog(ctx, f);
}

function paintRain(ctx: CanvasRenderingContext2D, f: FrameContext): void {
  const c = ctx;
  const { w, h, clock, env } = f;
  c.globalAlpha = env.rain * 0.5;
  c.strokeStyle = '#c2d1e2';
  c.lineWidth = 1;
  for (let i = 0; i < 65; i++) {
    const x = (((i * 97 - clock * 120) % w) + w) % w;
    const y = (i * 83 + clock * 400) % h;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 4, y + 13);
    c.stroke();
  }
  c.globalAlpha = 1;
}

function paintFog(ctx: CanvasRenderingContext2D, f: FrameContext): void {
  const c = ctx;
  const { w, h, horizon, env } = f;
  c.globalAlpha = env.fog;
  const tint = blendColor('#bdc9db', '#617393', env.night);
  const fog = c.createLinearGradient(0, 0, 0, h);
  fog.addColorStop(0, `${tint}65`);
  fog.addColorStop(Math.max(0.01, (horizon - 55) / h), `${tint}d0`);
  fog.addColorStop(horizon / h, `${tint}ed`);
  fog.addColorStop(0.64, `${tint}70`);
  fog.addColorStop(1, `${tint}00`);
  c.fillStyle = fog;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 1;
}

/** Speed streaks radiate from the vanishing point; they only show once you are really moving. */
export function paintSpeedStreaks(ctx: CanvasRenderingContext2D, f: FrameContext, road: (depth: number) => number): void {
  const { w, h, fast, path, horizon, roadH, env } = f;
  if (fast <= 0.05) return;
  const c = ctx;
  c.lineWidth = Math.max(1, w / 480);
  const vx = road(0);
  const vy = horizon + roadH * 0.06;
  for (let i = 0; i < Math.round(26 + Math.max(0, fast - 1) * 18); i++) {
    const angle = (hash(i + 3) - 0.5) * Math.PI * 0.95 + Math.PI / 2;
    const phase = (path / 35 + hash(i)) % 1;
    const r0 = 0.12 + phase ** 2 * 0.9;
    const r1 = r0 + 0.04 + fast * 0.2 * phase;
    const reach = Math.max(w, h) * 1.1;
    const cx = Math.cos(angle);
    const cy = Math.sin(angle);
    if (cy < 0.15) continue;
    c.globalAlpha = Math.min(0.8, fast * 0.5) * Math.min(1, phase * 3) * (1 - phase * 0.3);
    c.strokeStyle = env.night > 0.5 ? '#c8d8ff' : '#ffffff';
    c.beginPath();
    c.moveTo(vx + cx * reach * r0, vy + cy * reach * r0);
    c.lineTo(vx + cx * reach * r1, vy + cy * reach * r1);
    c.stroke();
  }
  c.globalAlpha = 1;
}

// -------------------------------------------------------------------------
// Screen overlays
// -------------------------------------------------------------------------

/** Vignette tightens with speed, dust tints the screen off-road, and a red flash marks every impact. */
export function paintOverlays(ctx: CanvasRenderingContext2D, f: FrameContext, flash: number): void {
  const c = ctx;
  const { w, h, fast } = f;
  const edgeShade = c.createRadialGradient(w / 2, h * 0.6, h * 0.35, w / 2, h * 0.6, Math.max(w, h) * 0.75);
  edgeShade.addColorStop(0, '#00000000');
  edgeShade.addColorStop(1, `rgba(4,8,24,${Math.min(0.82, 0.2 + fast * 0.3)})`);
  c.fillStyle = edgeShade;
  c.fillRect(0, 0, w, h);
  if (f.race.offroad && f.speed > 25) {
    c.fillStyle = 'rgba(120,80,30,.12)';
    c.fillRect(0, 0, w, h);
  }
  if (flash > 0) {
    c.fillStyle = `rgba(255,60,80,${flash * 0.4})`;
    c.fillRect(0, 0, w, h);
  }
}
