import type {CarLook} from '../game/cars.ts';

type Ctx = CanvasRenderingContext2D;
type Hsl = readonly [number, number, number];
const ALPHA_THRESHOLD = 80;

/** Paint colour baked into each atlas tile; recolouring is skipped when a car uses it. */
export const BASE_PAINTS: Readonly<Record<string, string>> = {
  fusca: '#f5c542',
  brasilia: '#6ed4a0',
  gol: '#669df4',
  palio: '#f08364',
  moto: '#ddd8cf',
  gt: '#e76368',
  suv: '#c2a177',
  superbike: '#af94ec',
  kombi: '#7ad0c8',
  uno: '#f1efe6',
  'uno-normal': '#f1efe6',
  chevette: '#d9573b',
  cg125: '#d33a3a',
  opala: '#2f6fb8',
  maverick: '#f08a24',
  fiat147: '#e6b45b',
  marea: '#527a68',
  passat: '#9b4840',
  puma: '#e8d7a6',
  biz125: '#d33a3a',
  hayabusa: '#2852b8',
  harley: '#147d75',
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
  kombi: 0.51,
  uno: 0.12,
  'uno-normal': 0.12,
  chevette: 0.055,
  cg125: 0,
  opala: 0.61,
  maverick: 0.065,
  fiat147: 0.12,
  marea: 0.44,
  passat: 0.98,
  puma: 0.13,
  biz125: 0,
  hayabusa: 0.63,
  harley: 0.49,
};

const HUE_TOLERANCE = 0.13;
const MIN_PAINT_SATURATION = 0.16;
const MIN_PAINT_LIGHTNESS = 0.14;
const MAX_PAINT_LIGHTNESS = 0.93;

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


function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement, readback: boolean): Ctx {
  const ctx = canvas.getContext('2d', {willReadFrequently: readback});
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

/** Shifts the body-coloured pixels of a tile towards the requested paint, keeping their lightness. */
export function recolorTile(original: HTMLCanvasElement, car: CarLook, pose = 0): HTMLCanvasElement {
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
    const x = ((i / 4) % canvas.width) / canvas.width;
    const y = Math.floor(i / 4 / canvas.width) / canvas.height;
    if (car.id === 'harley' && (y < 0.32 || y > 0.91)) continue;
    // New bikes keep neutral helmets, reflected mirror glass and red brake lenses.
    if (car.id === 'biz125' || car.id === 'hayabusa') {
      const lampX = car.id === 'biz125' ? [0.5, 0.22, 0.25] : [0.5, 0.29, 0.26];
      const lampY = car.id === 'biz125' ? 0.55 : 0.49;
      if (y < 0.35 || y > 0.8 || (Math.abs(y - lampY) < 0.035 && Math.abs(x - (lampX[pose] ?? 0.5)) < 0.12)) continue;
    }
    // The Uno's white body needs a neutral mask; keep its ladder, plate and bumpers intact.
    const whiteBody = s < (car.id === 'uno-normal' ? 0.26 : 0.15) && l > 0.55 && (
      (car.id === 'uno' && y > 0.25 && y < 0.72 && !(y > 0.59 && x > 0.28 && x < 0.72))
      || (car.id === 'uno-normal' && y < 0.78 && !(y > 0.53 && y < 0.70 && x > 0.28 && x < 0.68))
    );
    const paintable = whiteBody || (diff < (car.id === 'harley' ? 0.08 : HUE_TOLERANCE) && s > MIN_PAINT_SATURATION && l > MIN_PAINT_LIGHTNESS && l < MAX_PAINT_LIGHTNESS);
    if (!paintable) continue;
    // Dark and neutral paints must change brightness too, while retaining panel shading.
    const lightness = whiteBody && car.id === 'uno-normal' ? Math.min(0.96, l * target[2] / 0.8)
      : target[2] < 0.35 ? l * target[2] / 0.5
      : target[2] > 0.75 ? l + (target[2] - 0.5) * (1 - l)
      : l * (0.7 + target[2] * 0.6);
    const saturation = target[1] < 0.08 ? target[1] : target[1] * 0.85 + 0.1;
    const rgb = hslToRgb(target[0], saturation, lightness);
    p[i] = rgb[0];
    p[i + 1] = rgb[1];
    p[i + 2] = rgb[2];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

