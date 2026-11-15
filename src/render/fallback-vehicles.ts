import type {CarLook} from '../game/cars.ts';
import {shade} from './color.ts';
import {paintProceduralCar} from './procedural-cars.ts';
import {createCanvas, context2d} from './sprite-canvas.ts';

type Ctx = CanvasRenderingContext2D;
type Point = readonly [number, number];
const SPRITE_WIDTH = 128;
const SPRITE_HEIGHT = 80;
const SPRITE_CACHE_LIMIT = 150;
const DEFAULT_BODY_COLOR = '#efce5e';
const spriteCache = new Map<string, HTMLCanvasElement>();

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
  const superbike = car.id === 'superbike' || car.id === 'hayabusa';
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
  p.rect(f.left - 3, 37, 7, 5, l.mid);
  p.rect(f.right - 4, 37, 7, 5, l.dark);
}

/** Procedural sprite for a car, cached per id, paint, brake state and offset. */
export function fallbackSprite(car: CarLook, brake: boolean, turn: number): HTMLCanvasElement {
  const key = `${car.id}:${car.color}:${brake}:${turn}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const canvas = createCanvas(SPRITE_WIDTH, SPRITE_HEIGHT);
  const c = context2d(canvas);
  const painter = createPainter(c);
  const livery = createLivery(car, brake);
  c.translate(turn * 3, 0);
  if (!paintProceduralCar(c, car, brake)) {
    if (car.shape === 'bike') paintBike(painter, car, livery);
    else paintFourWheeler(painter, car, livery);
  }
  if (spriteCache.size >= SPRITE_CACHE_LIMIT) {
    const oldest = spriteCache.keys().next().value;
    if (oldest !== undefined) spriteCache.delete(oldest);
  }
  spriteCache.set(key, canvas);
  return canvas;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
