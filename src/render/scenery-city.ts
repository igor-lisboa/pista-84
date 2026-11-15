import {hash} from './noise.ts';

type Ctx = CanvasRenderingContext2D;
const CITY_CACHE_LIMIT = 5;
const CITY_LAYERS = 3;
const cityCache = new Map<string, HTMLCanvasElement>();

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

// ---------------------------------------------------------------------------
// Skyline
// ---------------------------------------------------------------------------

interface CityLayerStyle {
  readonly scale: number;
  readonly fill: string;
  readonly edge: string;
}

const CITY_LAYER_STYLES: readonly CityLayerStyle[] = [
  { scale: 0.52, fill: '#68758d', edge: '#8190aa' },
  { scale: 0.75, fill: '#4b5e7c', edge: '#7e8eac' },
  { scale: 1, fill: '#303e5c', edge: '#7182a1' },
];

/** [x as fraction of width, height, width] in skyline pixels. */
const LANDMARK_TOWERS: readonly (readonly [number, number, number])[] = [
  [0.3, 76, 15],
  [0.46, 93, 13],
  [0.59, 83, 18],
  [0.72, 61, 14],
];

type SkylineRect = (x: number, y: number, ww: number, hh: number, color: string) => void;

function skylineRect(c: Ctx, base: number, vertical: number): SkylineRect {
  return (x, y, ww, hh, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(base + (y - base) * vertical), Math.ceil(ww), Math.max(1, Math.ceil(hh * vertical)));
  };
}

function drawWindows(rect: SkylineRect, x: number, y: number, bw: number, bh: number, seed: number, night: number, unit: number): void {
  const rows = Math.floor(bh / (5 * unit));
  const cols = Math.floor(bw / (4 * unit));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lit = hash(seed * 30 + row * 7 + col * 3) > 0.6;
      const color = lit ? (night > 0.4 ? '#e7c896' : '#a6bbcb') : '#526c8e';
      rect(x + 2 * unit + col * 4 * unit, y + 3 * unit + row * 5 * unit, unit, 2 * unit, color);
    }
  }
}

function drawCityBuilding(
  rect: SkylineRect,
  layer: number,
  i: number,
  w: number,
  base: number,
  night: number,
  pan: number,
  unit: number,
): void {
  const style = CITY_LAYER_STYLES[layer]!;
  const offset = pan * (0.1 + layer * 0.06);
  const seed = i + 50 + layer * 71;
  const bw = (8 + hash(seed) * 12) * unit;
  const x = i * 13 * unit + offset;
  const center = 1 - Math.abs(x / w - 0.5) * 1.3;
  const bh = (12 + hash(seed + 8) * 52) * unit * style.scale * Math.max(0.35, center);
  const y = base - bh;
  const { fill, edge } = style;
  rect(x, y, bw, bh, fill);
  rect(x, y, Math.max(1, unit), bh, '#273750');
  rect(x + unit, y + unit, bw - 2 * unit, unit, edge);
  rect(x + bw - 2 * unit, y + unit, unit, bh, '#26324c');
  if (hash(seed + 3) > 0.45) {
    rect(x + bw * 0.3, y - 4 * unit, bw * 0.4, 4 * unit, fill);
    rect(x + bw * 0.3, y - 4 * unit, bw * 0.4, unit, edge);
  }
  if (layer === 2 && i % 7 === 0) {
    rect(x + bw * 0.5, y - 13 * unit, unit, 13 * unit, '#27354e');
    rect(x + bw * 0.5, y - 14 * unit, unit, unit, night > 0.3 ? '#e8a4a6' : '#a5b9d3');
  }
  // Individual lit windows, broken floors, and shaded glass strips.
  drawWindows(rect, x, y, bw, bh, seed, night, unit);
  if (i % 4 === 0) rect(x + bw * 0.5, y + 4 * unit, unit, bh - 8 * unit, '#8796b3');
}

/** A distant, broad city mass makes the route feel connected to a place. */
function drawCityMass(rect: SkylineRect, w: number, base: number, night: number, pan: number, unit: number): void {
  for (let layer = 0; layer < CITY_LAYERS; layer++) {
    for (let i = -3; i < 43; i++) drawCityBuilding(rect, layer, i, w, base, night, pan, unit);
  }
}

/** Four distinct landmark towers anchor the skyline, rather than repeating boxes. */
function drawLandmarks(rect: SkylineRect, w: number, base: number, pan: number, unit: number): void {
  for (const [fraction, height, width] of LANDMARK_TOWERS) {
    const x = w * fraction + pan * 0.2;
    const bh = height * unit;
    const bw = width * unit;
    const y = base - bh;
    rect(x, y, bw, bh, '#26354f');
    rect(x + unit, y + unit, bw - 2 * unit, bh - unit, '#435975');
    rect(x + 2 * unit, y + 2 * unit, 2 * unit, bh - 3 * unit, '#8495b0');
    rect(x + bw * 0.25, y - 5 * unit, bw * 0.5, 5 * unit, '#344661');
    rect(x + bw * 0.5, y - 15 * unit, unit, 12 * unit, '#9ba9c2');
    for (let k = 0; k < Math.floor(bh / (5 * unit)); k++) {
      rect(x + 5 * unit, y + 3 * unit + k * 5 * unit, bw - 7 * unit, unit, k % 3 === 0 ? '#c7c2a4' : '#8090ae');
    }
  }
}

function drawSkylineRaw(c: Ctx, w: number, horizon: number, night: number, pan = 0): void {
  const unit = w / 480;
  const base = horizon + 2;
  const vertical = horizon / (125 * unit);
  const rect = skylineRect(c, base, vertical);
  drawCityMass(rect, w, base, night, pan, unit);
  drawLandmarks(rect, w, base, pan, unit);
  rect(0, base - 2 * unit, w, 2 * unit, '#23374b');
  rect(0, base, w, 2 * unit, '#759391');
}

/** Draws the city silhouette from a cached strip that is re-used until the canvas size changes. */
export function drawSkyline(c: Ctx, w: number, horizon: number, night: number, pan = 0): void {
  const key = `${w}:${horizon}:${night > 0.4}`;
  const margin = Math.ceil(w * 0.15);
  let image = cityCache.get(key);
  if (!image) {
    image = createCanvas(w + margin * 2, horizon + 8);
    drawSkylineRaw(context2d(image), image.width, horizon, night, 0);
    if (cityCache.size > CITY_CACHE_LIMIT) cityCache.clear();
    cityCache.set(key, image);
  }
  c.drawImage(image, Math.round(-margin + pan * 0.2), 0);
}
