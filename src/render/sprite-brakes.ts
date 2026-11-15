import {lampMask} from './sprite-lamps.ts';
export {lampMask, lampFootprints} from './sprite-lamps.ts';

const cache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** Brighten the authored lenses themselves; no geometry is painted across a turning body. */
export function brakeTile(tile: HTMLCanvasElement, id: string, pose: number): HTMLCanvasElement {
  const cached = cache.get(tile);
  if (cached) return cached;
  const result = document.createElement('canvas'); result.width = tile.width; result.height = tile.height;
  const ctx = result.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(tile, 0, 0);
  const image = ctx.getImageData(0, 0, result.width, result.height), pixels = image.data;
  const mask = lampMask(tile, id, pose);
  for (let i = 0; i < pixels.length; i += 4) {
    if (!mask[i / 4]) continue;
    const g = pixels[i + 1] ?? 0, b = pixels[i + 2] ?? 0;
    pixels[i] = 255; pixels[i + 1] = Math.min(120, Math.max(g, 85)); pixels[i + 2] = Math.max(b, 65);
  }
  ctx.putImageData(image, 0, 0); cache.set(tile, result);
  return result;
}
