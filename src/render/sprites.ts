import type { CarLook } from '../game/index.ts';

// Rear-view pixel sprites. Authored atlas tiles are used when loaded; every vehicle also has a
// procedural fallback drawn once to a transparent 128 x 80 canvas and cached.

type Ctx = CanvasRenderingContext2D;
type Point = readonly [number, number];
/** Left, top, width and height of an atlas region as fractions of the image size. */
type Region = readonly [number, number, number, number];
type Hsl = readonly [number, number, number];
type SteeringPose = 0 | 1 | 2;

const SPRITE_WIDTH = 128;
const SPRITE_HEIGHT = 80;
const SPRITE_CACHE_LIMIT = 150;
const PAINT_CACHE_LIMIT = 80;
const ALPHA_THRESHOLD = 80;
const DEFAULT_BODY_COLOR = '#efce5e';
const ATLAS_TILE_COUNT = 8;
const TURN_TILE_COUNT = 16;
const TURN_SHEET_SIZE = 1254;

const DEFAULT_ATLAS_URL = './assets/vehicle-atlas-v1.png';
const DEFAULT_TURN_ATLAS_URL = './assets/vehicle-turns-v2.png';

const ATLAS_REGIONS: Readonly<Record<string, Region>> = {
  fusca: [0, 0.15, 0.25, 0.34],
  brasilia: [0.25, 0.15, 0.25, 0.34],
  gol: [0.5, 0.15, 0.25, 0.34],
  palio: [0.75, 0.15, 0.25, 0.34],
  moto: [0, 0.54, 0.2, 0.36],
  gt: [0.215, 0.54, 0.29, 0.36],
  suv: [0.515, 0.54, 0.245, 0.36],
  superbike: [0.79, 0.54, 0.21, 0.36],
};

/** Paint colour baked into each atlas tile; recolouring is skipped when a car uses it. */
const BASE_PAINTS: Readonly<Record<string, string>> = {
  fusca: '#f5c542',
  brasilia: '#6ed4a0',
  gol: '#669df4',
  palio: '#f08364',
  moto: '#ddd8cf',
  gt: '#e76368',
  suv: '#c2a177',
  superbike: '#af94ec',
};

/** Hue (0..1) of the paintable body area of each atlas tile. */
const BASE_HUES: Readonly<Record<string, number>> = {
  fusca: 0.115,
  brasilia: 0.25,
  gol: 0.62,
  palio: 0.065,
  moto: 0.6,
  gt: 0,
  suv: 0.14,
  superbike: 0.76,
};

const HUE_TOLERANCE = 0.13;
const MIN_PAINT_SATURATION = 0.16;
const MIN_PAINT_LIGHTNESS = 0.14;
const MAX_PAINT_LIGHTNESS = 0.93;

/** Turn sheet layout: [ids, top, bottom, column cuts]; each row holds two cars with two poses. */
const TURN_ROWS: readonly (readonly [readonly [string, string], number, number, readonly number[]])[] = [
  [['fusca', 'brasilia'], 0, 350, [0, 312, 627, 932, 1254]],
  [['gol', 'palio'], 350, 630, [0, 315, 628, 932, 1254]],
  [['moto', 'gt'], 630, 930, [0, 295, 580, 927, 1254]],
  [['suv', 'superbike'], 930, 1254, [0, 318, 660, 930, 1254]],
];

const spriteCache = new Map<string, HTMLCanvasElement>();
const atlasTiles = new Map<string, HTMLCanvasElement>();
const atlasPaints = new Map<string, HTMLCanvasElement>();
const turnTiles = new Map<string, HTMLCanvasElement>();
const turnPaints = new Map<string, HTMLCanvasElement>();
let atlasLoaded = false;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement, readback = false): Ctx {
  const ctx = readback ? canvas.getContext('2d', { willReadFrequently: true }) : canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

function parseHex(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function rgbToHsl(red: number, green: number, blue: number): Hsl {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const channel = (n: number): number => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
}

function shade(hex: string, factor: number): string {
  const v = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const value = Math.min(255, Math.max(0, Math.round(parseInt(v.slice(i, i + 2), 16) * factor)));
    return value.toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export function spritesReady(): boolean {
  return atlasLoaded && turnTiles.size === TURN_TILE_COUNT;
}

/** 0 = straight rear view, 1 = gentle lean, 2 = hard lean. */
export function steeringPose(steer: number): SteeringPose {
  const amount = Math.abs(steer);
  if (amount < 0.18) return 0;
  return amount < 0.7 ? 1 : 2;
}

export interface SpriteDimensions {
  readonly width: number;
  readonly height: number;
}

function sizeFactor(car: CarLook): number {
  if (car.shape === 'bike') return 0.6;
  if (car.shape === 'sport') return 1.12;
  return 1;
}

/** Logical size of a car sprite in sprite pixels; ids without an atlas tile use the procedural size. */
export function spriteDimensions(car: CarLook): SpriteDimensions {
  const tile = atlasTiles.get(car.id);
  if (!tile) return { width: SPRITE_WIDTH, height: SPRITE_HEIGHT };
  const factor = sizeFactor(car);
  return { width: 112 * factor, height: (112 * factor * tile.height) / tile.width };
}

// ---------------------------------------------------------------------------
// Atlas loading
// ---------------------------------------------------------------------------

function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Sprite atlas unavailable'));
    image.src = url;
  });
}

function readPixels(image: HTMLImageElement): Uint8ClampedArray {
  const source = createCanvas(image.width, image.height);
  const ctx = context2d(source, true);
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height).data;
}

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Tight bounding box of the opaque pixels inside a region, or `null` when it is empty. */
function opaqueBounds(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): Bounds | null {
  let minX = rx + rw;
  let minY = ry + rh;
  let maxX = rx;
  let maxY = ry;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      if (pixels[(y * imageWidth + x) * 4 + 3]! <= ALPHA_THRESHOLD) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX <= minX ? null : { minX, minY, maxX, maxY };
}

function cropTile(image: HTMLImageElement, bounds: Bounds): HTMLCanvasElement {
  const canvas = createCanvas(bounds.maxX - bounds.minX + 1, bounds.maxY - bounds.minY + 1);
  context2d(canvas).drawImage(image, bounds.minX, bounds.minY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function loadAtlas(
  url: string,
  regions: Readonly<Record<string, Region>>,
  target: Map<string, HTMLCanvasElement>,
): Promise<void> {
  const image = await loadImage(url);
  const pixels = readPixels(image);
  for (const [id, region] of Object.entries(regions)) {
    const rx = Math.floor(region[0] * image.width);
    const ry = Math.floor(region[1] * image.height);
    const rw = Math.floor(region[2] * image.width);
    const rh = Math.floor(region[3] * image.height);
    const bounds = opaqueBounds(pixels, image.width, rx, ry, rw, rh);
    if (bounds) target.set(id, cropTile(image, bounds));
  }
}

/** Cell gutters follow the authored sheet; each crop includes the complete body. */
function buildTurnRegions(): Record<string, Region> {
  const regions: Record<string, Region> = {};
  for (const [ids, top, bottom, cuts] of TURN_ROWS) {
    for (let i = 0; i < 4; i++) {
      const id = ids[Math.floor(i / 2)]!;
      regions[`${id}:${(i % 2) + 1}`] = [
        cuts[i]! / TURN_SHEET_SIZE,
        top / TURN_SHEET_SIZE,
        (cuts[i + 1]! - cuts[i]!) / TURN_SHEET_SIZE,
        (bottom - top) / TURN_SHEET_SIZE,
      ];
    }
  }
  return regions;
}

const TURN_REGIONS = buildTurnRegions();

export async function loadSprites(url = DEFAULT_ATLAS_URL, turnUrl = DEFAULT_TURN_ATLAS_URL): Promise<boolean> {
  await Promise.all([loadAtlas(url, ATLAS_REGIONS, atlasTiles), loadAtlas(turnUrl, TURN_REGIONS, turnTiles)]);
  atlasLoaded = atlasTiles.size === ATLAS_TILE_COUNT;
  return spritesReady();
}

// ---------------------------------------------------------------------------
// Atlas tiles with custom paint
// ---------------------------------------------------------------------------

/** Shifts the body-coloured pixels of a tile towards the requested paint, keeping their lightness. */
function recolorTile(original: HTMLCanvasElement, car: CarLook): HTMLCanvasElement {
  const canvas = createCanvas(original.width, original.height);
  const ctx = context2d(canvas, true);
  ctx.drawImage(original, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = data.data;
  const target = rgbToHsl(...parseHex(car.color));
  const baseHue = BASE_HUES[car.id] ?? 0;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3]! < ALPHA_THRESHOLD) continue;
    const [h, s, l] = rgbToHsl(p[i]!, p[i + 1]!, p[i + 2]!);
    const diff = Math.min(Math.abs(h - baseHue), 1 - Math.abs(h - baseHue));
    const paintable = diff < HUE_TOLERANCE && s > MIN_PAINT_SATURATION && l > MIN_PAINT_LIGHTNESS && l < MAX_PAINT_LIGHTNESS;
    if (!paintable) continue;
    const rgb = hslToRgb(target[0], target[1] * 0.85 + 0.1, l);
    p[i] = rgb[0];
    p[i + 1] = rgb[1];
    p[i + 2] = rgb[2];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** The authored tile for a car and pose in the car's paint, or `null` when the atlas has none. */
function paintedTile(car: CarLook, pose: SteeringPose = 0): HTMLCanvasElement | null {
  const tiles = pose ? turnTiles : atlasTiles;
  const paints = pose ? turnPaints : atlasPaints;
  const original = tiles.get(pose ? `${car.id}:${pose}` : car.id);
  if (!original) return null;
  if (car.color === BASE_PAINTS[car.id]) return original;
  const key = `${car.id}:${car.color}:${pose}`;
  const cached = paints.get(key);
  if (cached) return cached;
  const canvas = recolorTile(original, car);
  if (paints.size > PAINT_CACHE_LIMIT) paints.clear();
  paints.set(key, canvas);
  return canvas;
}

// ---------------------------------------------------------------------------
// Procedural sprites
// ---------------------------------------------------------------------------

interface Painter {
  rect(x: number, y: number, w: number, h: number, color: string): void;
  poly(points: readonly Point[], color: string): void;
}

function createPainter(c: Ctx): Painter {
  return {
    rect(x, y, w, h, color) {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    },
    poly(points, color) {
      c.fillStyle = color;
      c.beginPath();
      points.forEach(([x, y], i) => {
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
      c.closePath();
      c.fill();
    },
  };
}

interface Livery {
  readonly body: string;
  readonly dark: string;
  readonly mid: string;
  readonly light: string;
  /** Tail-light colour; brighter while braking. */
  readonly tail: string;
  readonly brake: boolean;
}

/** Edges of a four-wheeled body: outer left/right and the roofline. */
interface Frame {
  readonly left: number;
  readonly right: number;
  readonly roofL: number;
  readonly roofR: number;
  readonly roofY: number;
}

function createLivery(car: CarLook, brake: boolean): Livery {
  const body = car.color || DEFAULT_BODY_COLOR;
  return {
    body,
    dark: shade(body, 0.52),
    mid: shade(body, 0.78),
    light: shade(body, 1.22),
    tail: brake ? '#ffdf8b' : '#f94e68',
    brake,
  };
}

function createFrame(car: CarLook): Frame {
  const dims = (left: number, roofL: number, roofY: number): Frame => ({ left, right: 128 - left, roofL, roofR: 128 - roofL, roofY });
  switch (car.shape) {
    case 'suv':
      return dims(16, 29, 7);
    case 'sport':
      return dims(8, 43, 24);
    case 'bug':
      return dims(17, 43, 10);
    case 'van':
      return dims(18, 27, 4);
    case 'sedan':
      return dims(15, 38, 21);
    case 'muscle':
      return dims(10, 41, 24);
    default:
      return dims(17, 35, 15);
  }
}

function paintBike(p: Painter, car: CarLook, l: Livery): void {
  const { body, dark, mid, light, brake } = l;
  const superbike = car.id === 'superbike';
  p.rect(58, 43, 13, 34, '#10182d');
  p.rect(61, 51, 7, 25, '#273046');
  p.rect(60, 75, 9, 3, '#070f23');
  p.poly([[49, 37], [57, 29], [70, 29], [78, 37], [74, 60], [53, 60]], body);
  p.rect(55, 51, 19, 9, dark);
  p.poly([[47, 31], [52, 23], [76, 23], [82, 31], [76, 45], [52, 45]], '#28384f');
  p.rect(51, 31, 25, 8, mid);
  p.rect(52, 40, 9, 20, '#1a2539');
  p.rect(68, 40, 9, 20, '#1a2539');
  p.rect(55, 5, 19, 3, '#dee4e8');
  p.rect(51, 8, 27, 13, superbike ? body : '#eee5d1');
  p.rect(54, 19, 22, 8, '#141f32');
  p.rect(54, 20, 22, 3, '#7db3c5');
  if (car.id === 'cg125') {
    p.rect(50, 13, 28, 3, '#3b4350');
    p.rect(54, 16, 20, 2, '#59626f');
  }
  if (superbike) {
    p.poly([[43, 32], [49, 27], [53, 45], [48, 55], [40, 53]], body);
    p.poly([[80, 28], [87, 32], [88, 53], [79, 56], [75, 44]], mid);
    p.rect(45, 29, 38, 3, light);
  }
  p.rect(54, 58, 20, 5, brake ? '#fff0ad' : '#ff526f');
  p.rect(62, 65, 6, 5, '#d9dccf');
  p.rect(76, 61, 5, 12, '#a3aec1');
  p.rect(76, 72, 5, 3, '#172137');
}

/** Wheels, chassis, windows, tail lights and bumper shared by every four-wheeled body. */
function paintCarBase(p: Painter, l: Livery, f: Frame): void {
  const { body, dark, mid, light, tail } = l;
  const { left, right, roofL, roofR, roofY } = f;
  p.rect(left + 2, 51, 15, 25, '#101728');
  p.rect(right - 17, 51, 15, 25, '#101728');
  p.rect(left + 4, 73, 12, 3, '#050e20');
  p.rect(right - 16, 73, 12, 3, '#050e20');
  p.poly(
    [
      [left, 43], [left + 8, 32], [roofL, roofY + 4], [roofL + 5, roofY], [roofR - 5, roofY], [roofR, roofY + 4],
      [right - 8, 32], [right, 43], [right, 66], [right - 5, 71], [left + 5, 71], [left, 66],
    ],
    '#0c1630',
  );
  p.poly(
    [
      [left + 2, 44], [left + 10, 34], [roofL + 1, roofY + 5], [roofL + 6, roofY + 2], [roofR - 6, roofY + 2],
      [roofR - 1, roofY + 5], [right - 10, 34], [right - 2, 44], [right - 2, 63], [left + 2, 63],
    ],
    body,
  );
  p.poly([[left + 2, 46], [left + 12, 39], [left + 15, 59], [left + 8, 66], [left + 2, 62]], mid);
  p.poly([[right - 2, 46], [right - 12, 39], [right - 15, 59], [right - 8, 66], [right - 2, 62]], dark);
  p.poly([[roofL + 4, roofY + 7], [roofR - 4, roofY + 7], [right - 21, 35], [left + 21, 35]], '#172b45');
  p.poly([[roofL + 7, roofY + 9], [roofR - 6, roofY + 9], [right - 23, 31], [left + 24, 31]], '#497a99');
  p.poly([[roofL + 8, roofY + 9], [roofL + 20, roofY + 9], [left + 34, 30], [left + 25, 30]], '#8db7c5');
  p.rect(roofL + 7, roofY + 3, roofR - roofL - 14, 2, light);
  p.poly([[left + 14, 38], [right - 14, 38], [right - 5, 48], [left + 5, 48]], light);
  p.rect(left + 3, 48, right - left - 6, 15, body);
  p.rect(left + 3, 59, right - left - 6, 6, mid);
  p.rect(left + 9, 48, right - left - 18, 2, light);
  p.rect(left + 3, 64, right - left - 6, 4, '#152238');
  p.rect(left + 5, 52, 21, 7, '#431e3a');
  p.rect(right - 26, 52, 21, 7, '#431e3a');
  p.rect(left + 6, 53, 19, 4, tail);
  p.rect(right - 25, 53, 19, 4, tail);
  p.rect(55, 58, 18, 7, '#e6d8ad');
  p.rect(58, 60, 12, 2, '#7b867c');
  p.rect(left + 8, 68, 16, 3, '#92a9b8');
  p.rect(right - 24, 68, 16, 3, '#92a9b8');
  p.rect(left + 17, 70, 7, 4, '#1b273e');
  p.rect(right - 25, 70, 7, 4, '#1b273e');
}

function paintBeetle(p: Painter, l: Livery): void {
  const { body, dark, mid, light, tail, brake } = l;
  const lampGlow = brake ? '#fff8c5' : '#ff8c81';
  p.poly([[35, 34], [39, 22], [44, 15], [52, 11], [76, 11], [84, 15], [89, 22], [93, 34], [89, 47], [39, 47]], body);
  p.poly([[43, 28], [46, 20], [53, 17], [75, 17], [82, 20], [85, 28], [82, 33], [46, 33]], '#1a354d');
  p.poly([[46, 26], [49, 21], [55, 19], [74, 19], [79, 21], [82, 27], [79, 30], [49, 30]], '#6b9dad');
  p.poly([[49, 22], [55, 19], [65, 19], [55, 30], [48, 30]], '#b8d4d1');
  p.poly([[38, 38], [45, 34], [83, 34], [90, 38], [87, 54], [41, 54]], light);
  p.poly([[43, 40], [85, 40], [88, 53], [40, 53]], body);
  for (let i = 0; i < 6; i++) p.rect(47 + i * 6, 43, 3, 6, dark);
  p.poly([[21, 43], [26, 39], [34, 40], [39, 48], [38, 62], [22, 62]], mid);
  p.poly([[107, 43], [102, 39], [94, 40], [89, 48], [90, 62], [106, 62]], dark);
  p.rect(24, 49, 9, 3, '#ffba8c');
  p.rect(22, 52, 13, 8, tail);
  p.rect(95, 49, 9, 3, '#ffba8c');
  p.rect(93, 52, 13, 8, tail);
  p.rect(25, 54, 6, 3, lampGlow);
  p.rect(96, 54, 6, 3, lampGlow);
  p.rect(16, 65, 96, 4, '#bfd0d0');
  p.rect(25, 65, 78, 1, '#f6e8d2');
}

function paintBrasilia(p: Painter, l: Livery): void {
  const { mid, light, tail } = l;
  p.rect(37, 19, 54, 16, '#1d3750');
  p.rect(39, 20, 50, 3, '#91b8c4');
  p.rect(63, 20, 2, 14, mid);
  p.rect(36, 37, 56, 4, light);
  p.rect(28, 54, 23, 4, tail);
  p.rect(77, 54, 23, 4, tail);
  p.rect(31, 63, 66, 2, '#d0dad6');
}

function paintGol(p: Painter, l: Livery): void {
  const { dark, tail } = l;
  p.rect(37, 34, 54, 4, dark);
  p.rect(61, 25, 3, 8, '#adc5c7');
  p.rect(59, 51, 10, 3, '#233750');
  p.rect(27, 53, 14, 6, tail);
  p.rect(87, 53, 14, 6, tail);
  p.rect(44, 65, 40, 2, '#32465b');
}

function paintPalio(p: Painter, l: Livery): void {
  const { dark, mid, tail } = l;
  p.poly([[39, 36], [44, 31], [84, 31], [89, 36], [86, 40], [42, 40]], mid);
  p.rect(29, 49, 9, 12, tail);
  p.rect(90, 49, 9, 12, tail);
  p.rect(32, 49, 3, 5, '#ffc792');
  p.rect(93, 49, 3, 5, '#ffc792');
  p.rect(57, 47, 14, 2, dark);
}

function paintSportDetails(p: Painter, l: Livery): void {
  const { dark, light, tail } = l;
  p.rect(12, 38, 104, 4, '#16233e');
  p.rect(11, 36, 106, 3, light);
  p.rect(22, 39, 5, 10, dark);
  p.rect(101, 39, 5, 10, dark);
  p.rect(17, 52, 29, 3, tail);
  p.rect(82, 52, 29, 3, tail);
  p.rect(51, 51, 26, 2, dark);
  p.rect(29, 66, 14, 5, '#0a142a');
  p.rect(85, 66, 14, 5, '#0a142a');
  p.rect(32, 67, 8, 2, '#a8b7c1');
  p.rect(88, 67, 8, 2, '#a8b7c1');
  p.rect(58, 17, 12, 19, '#e1ded2');
}

function paintSuvDetails(p: Painter, l: Livery): void {
  const { mid, light, tail } = l;
  p.rect(32, 14, 64, 20, '#1a3044');
  p.rect(35, 16, 58, 4, '#85adbb');
  p.rect(62, 15, 3, 19, mid);
  p.rect(24, 9, 80, 3, light);
  p.rect(24, 5, 6, 8, '#2e3a47');
  p.rect(98, 5, 6, 8, '#2e3a47');
  p.rect(25, 6, 77, 2, '#85969d');
  p.rect(54, 40, 24, 28, '#15243a');
  p.rect(49, 44, 34, 20, '#15243a');
  p.rect(55, 43, 22, 22, '#384452');
  p.rect(60, 47, 12, 14, '#94a4a4');
  p.rect(63, 51, 6, 6, '#52626e');
  p.rect(24, 49, 8, 13, tail);
  p.rect(96, 49, 8, 13, tail);
}

/** Volkswagen Kombi: two-tone paint, split rear window, engine-lid vents and a white V. */
function paintKombi(p: Painter, l: Livery, f: Frame): void {
  const { dark, mid, tail } = l;
  const white = '#f3efe3';
  p.rect(f.roofL + 2, f.roofY, f.roofR - f.roofL - 4, 7, white);
  p.poly([[f.left + 4, 40], [64, 53], [f.right - 4, 40], [f.right - 12, 40], [64, 49], [f.left + 12, 40]], white);
  p.rect(f.left + 8, 56, f.right - f.left - 16, 5, mid);
  for (let i = 0; i < 7; i++) p.rect(46 + i * 6, 57, 3, 3, dark);
  p.rect(f.left + 4, 44, 7, 15, tail);
  p.rect(f.right - 11, 44, 7, 15, tail);
  p.rect(61, 20, 6, 18, white);
}

/** Fiat Uno with the roof ladder every Brazilian handyman knows. */
function paintUno(p: Painter, l: Livery, f: Frame): void {
  const rail = '#9aa6ad';
  const top = 2;
  p.rect(f.roofL + 1, top, 3, f.roofY + 2, rail);
  p.rect(f.roofR - 4, top, 3, f.roofY + 2, rail);
  for (let x = f.roofL + 4; x < f.roofR - 4; x += 6) p.rect(x, top + 1, 2, 9, '#c9d2d6');
  p.rect(f.roofL, f.roofY + 1, 4, 3, '#2e3a47');
  p.rect(f.roofR - 4, f.roofY + 1, 4, 3, '#2e3a47');
  p.rect(f.left + 4, 50, 8, 13, l.tail);
  p.rect(f.right - 12, 50, 8, 13, l.tail);
}

/** Chevrolet Chevette: round tail lamps and a gently sloping hatch. */
function paintChevette(p: Painter, l: Livery): void {
  p.poly([[40, 24], [88, 24], [84, 36], [44, 36]], '#1a354d');
  p.poly([[44, 26], [84, 26], [81, 33], [47, 33]], '#6b9dad');
  p.rect(27, 51, 12, 10, '#ffbd8a');
  p.rect(89, 51, 12, 10, '#ffbd8a');
  p.rect(29, 53, 8, 6, l.tail);
  p.rect(91, 53, 8, 6, l.tail);
  p.rect(52, 62, 24, 2, '#c9d2d6');
}

/** Chevrolet Opala: long trunk, low roof, chrome bumper and a wide tail-light bar. */
function paintOpala(p: Painter, l: Livery): void {
  p.rect(44, 28, 40, 9, '#1a354d');
  p.rect(46, 30, 36, 4, '#6b9dad');
  p.rect(22, 49, 84, 8, '#431e3a');
  p.rect(24, 51, 36, 4, l.tail);
  p.rect(68, 51, 36, 4, l.tail);
  p.rect(60, 49, 8, 8, l.dark);
  p.rect(18, 64, 92, 4, '#dfe6ea');
  p.rect(20, 65, 88, 1, '#ffffff');
}

/** Ford Maverick GT: fastback glass, black racing stripe, triple tail lights and twin pipes. */
function paintMaverick(p: Painter, l: Livery): void {
  p.rect(58, 26, 12, 40, '#161b24');
  p.poly([[46, 27], [82, 27], [92, 38], [36, 38]], '#1a354d');
  p.poly([[50, 29], [78, 29], [86, 36], [42, 36]], '#6b9dad');
  for (let i = 0; i < 3; i++) {
    p.rect(14 + i * 7, 49, 5, 10, l.tail);
    p.rect(93 + i * 7, 49, 5, 10, l.tail);
  }
  p.rect(30, 68, 9, 5, '#2b3340');
  p.rect(89, 68, 9, 5, '#2b3340');
  p.rect(32, 69, 5, 2, '#b8c4cc');
  p.rect(91, 69, 5, 2, '#b8c4cc');
}

function paintFourWheeler(p: Painter, car: CarLook, l: Livery): void {
  const f = createFrame(car);
  paintCarBase(p, l, f);
  // Model-specific details make cars identifiable even with the same paint.
  if (car.shape === 'bug') paintBeetle(p, l);
  if (car.id === 'brasilia') paintBrasilia(p, l);
  if (car.id === 'gol') paintGol(p, l);
  if (car.id === 'palio') paintPalio(p, l);
  if (car.shape === 'sport') paintSportDetails(p, l);
  if (car.shape === 'suv') paintSuvDetails(p, l);
  if (car.id === 'kombi') paintKombi(p, l, f);
  if (car.id === 'uno') paintUno(p, l, f);
  if (car.id === 'chevette') paintChevette(p, l);
  if (car.id === 'opala') paintOpala(p, l);
  if (car.id === 'maverick') paintMaverick(p, l);
  p.rect(f.left - 3, 37, 7, 5, l.mid);
  p.rect(f.right - 4, 37, 7, 5, l.dark);
}

/** Procedural sprite for a car, cached per id, paint, brake state and offset. */
function sprite(car: CarLook, brake: boolean, turn: number): HTMLCanvasElement {
  const key = `${car.id}:${car.color}:${brake}:${turn}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const canvas = createCanvas(SPRITE_WIDTH, SPRITE_HEIGHT);
  const c = context2d(canvas);
  const painter = createPainter(c);
  const livery = createLivery(car, brake);
  c.translate(turn * 3, 0);
  if (car.shape === 'bike') paintBike(painter, car, livery);
  else paintFourWheeler(painter, car, livery);
  if (spriteCache.size > SPRITE_CACHE_LIMIT) spriteCache.clear();
  spriteCache.set(key, canvas);
  return canvas;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Brake-lamp offsets across the width of an atlas tile (straight, leaning). */
const STRAIGHT_BRAKE_LAMPS = [0.12, 0.72] as const;
const TURNING_BRAKE_LAMPS = [0.1, 0.58] as const;

/** Pick authored poses. Never shear, rotate or slice the rear image to fake yaw. */
export function drawCar(ctx: Ctx, x: number, y: number, scale: number, car: CarLook, brake = false, turn = 0): void {
  const pose = steeringPose(turn);
  const tile = atlasLoaded ? paintedTile(car, pose) : null;
  // Procedural cars have no authored turn poses, so they lean by shifting a few pixels instead.
  const image = tile || sprite(car, brake, Math.sign(turn) * pose);
  const leaning = !!tile && pose > 0;
  const dimensions = atlasLoaded ? spriteDimensions(car) : { width: SPRITE_WIDTH, height: SPRITE_HEIGHT };
  const height = dimensions.height * scale * (leaning ? 0.96 : 1);
  const width = (height * image.width) / image.height;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (leaning && turn < 0) ctx.scale(-1, 1);
  const left = -width * (leaning ? 0.4 : 0.5);
  ctx.drawImage(image, Math.round(left), Math.round(-height), Math.round(width), Math.round(height));
  if (tile && brake) {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#ff5445';
    const lamps = leaning ? TURNING_BRAKE_LAMPS : STRAIGHT_BRAKE_LAMPS;
    for (const lamp of lamps) ctx.fillRect(left + width * lamp, -height * 0.24, width * 0.13, Math.max(2, height * 0.045));
  }
  ctx.restore();
}
