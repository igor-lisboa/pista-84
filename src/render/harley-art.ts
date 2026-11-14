import type {CarLook} from '../game/cars.ts';
import {shade} from './color.ts';

/** Actual transparent gutters of the authored sheet; bags/mirrors stay inside each crop. */
export const HARLEY_REGIONS = {
  'harley:0': [0, 0, 470 / 1536, 1],
  'harley:1': [470 / 1536, 0, 490 / 1536, 1],
  'harley:2': [960 / 1536, 0, 576 / 1536, 1],
} as const;

export const HARLEY_BRAKE_LAMP = {y: 0.33, centers: [[0.5], [0.33], [0.26]]} as const;

/** Only used while authored art is unavailable: broad bags, chrome rails and upright rider. */
export function paintHarleyFallback(ctx: CanvasRenderingContext2D, car: CarLook, brake: boolean): boolean {
  if (car.id !== 'harley') return false;
  const rect = (x: number, y: number, w: number, h: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  rect(56, 47, 16, 31, '#11151c');
  rect(59, 56, 10, 20, '#303843');
  rect(24, 42, 29, 26, '#c4c9cd');
  rect(75, 42, 29, 26, '#c4c9cd');
  rect(27, 44, 23, 20, car.color);
  rect(78, 44, 23, 20, shade(car.color, 0.8));
  rect(25, 47, 27, 2, '#fff1ce');
  rect(76, 47, 27, 2, '#fff1ce');
  rect(52, 39, 24, 21, car.color);
  rect(48, 28, 32, 18, '#252832');
  rect(45, 26, 6, 17, '#252832');
  rect(77, 26, 6, 17, '#252832');
  rect(53, 8, 22, 19, '#e7dfc9');
  rect(55, 23, 18, 4, '#151821');
  rect(53, 40, 22, 3, '#c4c9cd');
  rect(53, 41, 3, 9, '#c4c9cd');
  rect(72, 41, 3, 9, '#c4c9cd');
  rect(35, 64, 7, 12, '#c4c9cd');
  rect(86, 64, 7, 12, '#c4c9cd');
  rect(58, 54, 12, 5, brake ? '#fff0ad' : '#ef3b38');
  rect(60, 61, 8, 6, '#e8e7dd');
  rect(32, 24, 11, 5, '#c4c9cd');
  rect(85, 24, 11, 5, '#c4c9cd');
  return true;
}
