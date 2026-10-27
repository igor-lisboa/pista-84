import { CARS, type CarLook } from '../game/index.ts';
import { drawCar, spriteDimensions } from '../render/sprites.ts';

/** Draws a car sprite centred horizontally and standing on 94% of the canvas height. */
export function paintCarPreview(canvas: HTMLCanvasElement, car: CarLook): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // One scale for the fleet: fitting each model independently hid the van/compact size gap.
  const fleet = CARS.map(spriteDimensions);
  const width = Math.max(...fleet.map((size) => size.width));
  const height = Math.max(...fleet.map((size) => size.height));
  const scale = Math.min((canvas.width * 0.85) / width, (canvas.height * 0.86) / height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  drawCar(ctx, canvas.width / 2, canvas.height * 0.94, scale, car);
}

export function createCarThumbnail(car: CarLook & { name: string }, width = 180, height = 110): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute('aria-label', car.name);
  paintCarPreview(canvas, car);
  return canvas;
}
