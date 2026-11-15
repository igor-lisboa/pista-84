import {lampFootprints} from './sprite-lamps.ts';
import {createCanvas, context2d} from './sprite-canvas.ts';

const reflections = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** Build lamp spill once in source space so both steering directions mirror identical pixels. */
export function reflectionTile(source: HTMLCanvasElement, id: string, pose: number): HTMLCanvasElement {
  const cached = reflections.get(source);
  if (cached) return cached;
  const tile = createCanvas(source.width, Math.max(4, Math.round(source.height * .27)));
  const ctx = context2d(tile);
  const gradient = ctx.createLinearGradient(0, 0, 0, tile.height);
  gradient.addColorStop(0, '#ff4e3eff'); gradient.addColorStop(1, '#ff4e3e00');
  ctx.fillStyle = gradient;
  for (const lamp of lampFootprints(source, id, pose)) {
    const center = (lamp.x + lamp.width / 2) * tile.width;
    const width = Math.max(1, lamp.width * tile.width * .7);
    ctx.beginPath();
    ctx.moveTo(center - width / 2, 0); ctx.lineTo(center + width / 2, 0);
    ctx.lineTo(center + width, tile.height); ctx.lineTo(center - width, tile.height);
    ctx.closePath(); ctx.fill();
  }
  reflections.set(source, tile);
  return tile;
}
