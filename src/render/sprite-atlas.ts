import {CARS} from '../game/cars.ts';
import type {CarLook} from '../game/cars.ts';
import {BASE_PAINTS, recolorTile} from './sprite-paint.ts';
import {createCanvas, context2d} from './sprite-canvas.ts';
import {vehicleAtlases, type Region} from './vehicle-atlases.ts';

export type SteeringPose = 0 | 1 | 2;
const PAINT_CACHE_LIMIT = 80;
const ALPHA_THRESHOLD = 80;
const atlasTiles = new Map<string, HTMLCanvasElement>();
const turnTiles = new Map<string, HTMLCanvasElement>();
const paints = new Map<string, HTMLCanvasElement>();

export function spritesReady(): boolean {
  return atlasTiles.size === CARS.length && turnTiles.size === CARS.length * 2;
}

export function factoryTile(id: string, pose: SteeringPose = 0): HTMLCanvasElement | null {
  return (pose ? turnTiles.get(`${id}:${pose}`) : atlasTiles.get(id)) ?? null;
}

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

/** Load every registered sheet through the same crop and publication path. */
export async function loadSprites(url?: string, turnUrl?: string, classicsUrl?: string, brazilianUrl?: string): Promise<boolean> {
  const sheets = vehicleAtlases(url, turnUrl, classicsUrl, brazilianUrl);
  const loaded = await Promise.all(sheets.map(async sheet => {
    const tiles = new Map<string, HTMLCanvasElement>();
    await loadAtlas(sheet.url, sheet.regions, tiles);
    return {sheet, tiles};
  }));
  paints.clear();
  for (const {sheet, tiles} of loaded) {
    for (const [key, tile] of tiles) {
      if (sheet.layout === 'straight') atlasTiles.set(key, tile);
      else if (sheet.layout === 'turn') turnTiles.set(key, tile);
      else {
        const [id, pose] = key.split(':');
        if (id && pose === '0') atlasTiles.set(id, tile);
        else turnTiles.set(key, tile);
      }
    }
  }
  return spritesReady();
}

/** Custom paints share the original material masks and a bounded cache. */
export function paintedTile(car: CarLook, pose: SteeringPose = 0): HTMLCanvasElement | null {
  const original = factoryTile(car.id, pose);
  if (!original) return null;
  if (car.color === BASE_PAINTS[car.id]) return original;
  const key = `${car.id}:${car.color}:${pose}`;
  const cached = paints.get(key);
  if (cached) return cached;
  const canvas = recolorTile(original, car, pose);
  if (paints.size >= PAINT_CACHE_LIMIT) {
    const oldest = paints.keys().next().value;
    if (oldest !== undefined) paints.delete(oldest);
  }
  paints.set(key, canvas);
  return canvas;
}
