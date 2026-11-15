import { BILLBOARD_ADS } from './billboards.ts';
import { hash } from './noise.ts';

export {drawSkyline} from './scenery-city.ts';

// Layered city and roadside sprites built on a fixed pixel grid.

type Ctx = CanvasRenderingContext2D;
type Point = readonly [number, number];

/** Shadows under roadside objects share one translucent green. */
const SHADOW_COLOR = '#233b3545';
const TREE_WIDTH = 64;
const TREE_HEIGHT = 96;

const treeCache = new Map<string, HTMLCanvasElement>();

function context2d(canvas: HTMLCanvasElement): Ctx {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function fillPolygon(c: Ctx, points: readonly Point[], color: string): void {
  c.fillStyle = color;
  c.beginPath();
  points.forEach(([x, y], i) => {
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  });
  c.closePath();
  c.fill();
}

// ---------------------------------------------------------------------------
// Clouds, mountains and sun
// ---------------------------------------------------------------------------

/** [x, y, width, height, color] of each block, in cloud units. */
const CLOUD_BLOCKS: readonly (readonly [number, number, number, number, string])[] = [
  [0, 11, 55, 5, '#8a9cbe'],
  [7, 6, 13, 9, '#a1b1cb'],
  [19, 1, 19, 14, '#b4c1d7'],
  [15, 5, 29, 11, '#b4c1d7'],
  [38, 8, 17, 7, '#a8b8d1'],
  [24, 0, 11, 4, '#c0cbe0'],
  [5, 13, 53, 3, '#8194b6'],
  [25, 7, 7, 6, '#9badcb'],
];

const CLOUD_COUNT = 6;

export function drawClouds(c: Ctx, w: number, horizon: number, clock: number): void {
  const unit = w / 480;
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const x = ((((i * w * 0.23 - clock * 1.2) % (w + 80)) + w + 80) % (w + 80)) - 45;
    const y = horizon * (0.08 + (i % 3) * 0.105);
    const s = (0.6 + hash(i + 10) * 0.6) * unit;
    for (const [xx, yy, ww, hh, color] of CLOUD_BLOCKS) {
      c.fillStyle = color;
      c.fillRect(Math.round(x + xx * s), Math.round(y + yy * s), Math.ceil(ww * s), Math.ceil(hh * s));
    }
  }
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

function drawTrunk(c: Ctx): void {
  c.fillStyle = '#293c36';
  c.fillRect(28, 73, 9, 21);
  c.fillStyle = '#6e6950';
  c.fillRect(29, 74, 4, 20);
  c.fillStyle = '#8a7d59';
  c.fillRect(30, 78, 2, 13);
}

function drawPineLayer(c: Ctx, layer: number): void {
  const yy = 5 + layer * 17;
  const spread = 11 + layer * 6;
  fillPolygon(
    c,
    [
      [32, yy], [37, yy + 7], [35 + spread * 0.3, yy + 10], [32 + spread * 0.65, yy + 17],
      [31 + spread, yy + 24], [33 + spread, yy + 30], [39, yy + 35], [26, yy + 37],
      [30 - spread, yy + 31], [28 - spread, yy + 26], [32 - spread * 0.65, yy + 17], [27, yy + 11],
    ],
    '#263d35',
  );
  fillPolygon(
    c,
    [
      [32, yy + 2], [35, yy + 11], [31 + spread * 0.55, yy + 19], [30 + spread * 0.8, yy + 26],
      [35, yy + 31], [26, yy + 32], [31 - spread * 0.8, yy + 27], [34 - spread * 0.5, yy + 18], [29, yy + 10],
    ],
    layer % 2 ? '#4a6c48' : '#55764e',
  );
  fillPolygon(
    c,
    [[32, yy + 4], [34, yy + 13], [29, yy + 22], [33 - spread * 0.6, yy + 25], [34 - spread * 0.4, yy + 17]],
    '#6f8a59',
  );
  for (let i = 0; i < 7; i++) {
    c.fillStyle = i % 2 ? '#344f3b' : '#758e5d';
    c.fillRect(24 + Math.floor(hash(layer * 15 + i) * 16), yy + 12 + i * 2, 2, 2);
  }
}

function treeImage(): HTMLCanvasElement {
  const cached = treeCache.get('pine');
  if (cached) return cached;
  const canvas = createCanvas(TREE_WIDTH, TREE_HEIGHT);
  const c = context2d(canvas);
  drawTrunk(c);
  for (let layer = 3; layer >= 0; layer--) drawPineLayer(c, layer);
  treeCache.set('pine', canvas);
  return canvas;
}

export function drawTree(c: Ctx, x: number, y: number, scale: number): void {
  const image = treeImage();
  c.fillStyle = SHADOW_COLOR;
  c.fillRect(Math.round(x - 21 * scale), Math.round(y - 3 * scale), Math.ceil(44 * scale), Math.ceil(5 * scale));
  c.drawImage(
    image,
    Math.round(x - 32 * scale),
    Math.round(y - 96 * scale),
    Math.round(TREE_WIDTH * scale),
    Math.round(TREE_HEIGHT * scale),
  );
}

/**
 * Periodic mountain ridges: harmonics are integers of the tile width, so panning by heading
 * never shows a seam.
 */
export function drawMountains(c: Ctx, w: number, horizon: number, offset: number, far: string, near: string): void {
  const unit = w / 480;
  const period = w * 1.7;
  const ridge = (seed: number, amp: number, base: number, color: string, speed: number): void => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, horizon + 2);
    for (let x = 0; x <= w + 8; x += 8) {
      const u = ((x + offset * speed) / period) * Math.PI * 2;
      const height =
        base + amp * (0.5 + 0.28 * Math.sin(u + seed) + 0.17 * Math.sin(u * 3 + seed * 2.3) + 0.09 * Math.sin(u * 7 + seed * 0.7));
      c.lineTo(x, horizon + 2 - height * unit);
    }
    c.lineTo(w, horizon + 2);
    c.closePath();
    c.fill();
  };
  ridge(1.2, 70, 18, far, 0.35);
  ridge(4.1, 48, 10, near, 0.6);
}

export function drawSun(c: Ctx, w: number, horizon: number, x: number, altitude: number, color: string, size: number): void {
  const y = horizon - altitude;
  const r = (size * w) / 480;
  c.save();
  c.beginPath();
  c.rect(0, 0, w, horizon + 2);
  c.clip();
  const glow = c.createRadialGradient(x, y, r * 0.4, x, y, r * 4.2);
  glow.addColorStop(0, `${color}aa`);
  glow.addColorStop(1, `${color}00`);
  c.fillStyle = glow;
  c.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  c.fillStyle = color;
  const step = Math.max(2, Math.round(w / 240));
  for (let yy = -r; yy <= r; yy += step) {
    const half = Math.sqrt(Math.max(0, r * r - yy * yy));
    c.fillRect(Math.round(x - half), Math.round(y + yy), Math.ceil(half * 2), step);
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// Roadside props
// ---------------------------------------------------------------------------

export function drawLamp(c: Ctx, x: number, y: number, s: number, side: number, night: number): void {
  const pole = Math.max(1, Math.round(2.2 * s));
  c.fillStyle = SHADOW_COLOR;
  c.fillRect(Math.round(x - 9 * s), Math.round(y - 2 * s), Math.ceil(18 * s), Math.ceil(3 * s));
  c.fillStyle = '#4b5568';
  c.fillRect(Math.round(x - pole / 2), Math.round(y - 62 * s), pole, Math.ceil(62 * s));
  c.fillRect(Math.round(x - (side > 0 ? 16 : 0) * s), Math.round(y - 64 * s), Math.ceil(16 * s), Math.max(1, Math.round(2.2 * s)));
  const headX = x - side * 14 * s;
  c.fillStyle = night > 0.25 ? '#fff0b0' : '#c9ced6';
  c.fillRect(Math.round(headX - 4 * s), Math.round(y - 63 * s), Math.ceil(8 * s), Math.ceil(3 * s));
  if (night > 0.25) {
    c.globalAlpha = night * 0.28;
    c.fillStyle = '#ffe9a6';
    c.fillRect(Math.round(headX - 14 * s), Math.round(y - 60 * s), Math.ceil(28 * s), Math.ceil(10 * s));
    c.globalAlpha = 1;
  }
}

export function drawBillboard(c: Ctx, x: number, y: number, s: number, index: number): void {
  const ad = BILLBOARD_ADS[index % BILLBOARD_ADS.length]!;
  const W = 90 * s;
  const H = 38 * s;
  const top = y - 82 * s;
  const legWidth = Math.max(1, Math.round(3 * s));
  c.save();
  c.fillStyle = SHADOW_COLOR;
  c.fillRect(Math.round(x - W / 2), Math.round(y - 2 * s), Math.ceil(W), Math.ceil(4 * s));
  c.fillStyle = '#3a4256';
  c.fillRect(Math.round(x - W * 0.3), Math.round(top + H), legWidth, Math.ceil(48 * s));
  c.fillRect(Math.round(x + W * 0.3), Math.round(top + H), legWidth, Math.ceil(48 * s));
  c.fillStyle = '#1d2438';
  c.fillRect(Math.round(x - W / 2 - 2 * s), Math.round(top - 2 * s), Math.ceil(W + 4 * s), Math.ceil(H + 4 * s));
  c.fillStyle = ad.background;
  c.fillRect(Math.round(x - W / 2), Math.round(top), Math.ceil(W), Math.ceil(H));
  c.fillStyle = ad.foreground;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `900 ${Math.max(1, 11 * s)}px monospace`;
  c.fillText(ad.title, x, top + H * 0.36, W * 0.88);
  c.fillRect(Math.round(x - W * 0.4), Math.round(top + H * 0.59), Math.ceil(W * 0.8), Math.max(1, Math.round(s)));
  c.font = `bold ${Math.max(1, 5.5 * s)}px monospace`;
  c.fillText(ad.subtitle, x, top + H * 0.78, W * 0.88);
  c.restore();
}

export function drawBush(c: Ctx, x: number, y: number, s: number, tint: boolean): void {
  c.fillStyle = SHADOW_COLOR;
  c.fillRect(Math.round(x - 14 * s), Math.round(y - 2 * s), Math.ceil(28 * s), Math.ceil(4 * s));
  const r = (xx: number, yy: number, ww: number, hh: number, color: string): void => {
    c.fillStyle = color;
    c.fillRect(Math.round(x + xx * s), Math.round(y + yy * s), Math.ceil(ww * s), Math.ceil(hh * s));
  };
  r(-13, -12, 26, 12, tint ? '#2e6a3c' : '#2a5f38');
  r(-9, -18, 18, 8, tint ? '#3f8a4a' : '#38794a');
  r(-4, -20, 8, 4, '#55a35a');
  r(-12, -6, 24, 3, '#214a2d');
}
