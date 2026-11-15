import type {CarLook} from '../game/cars.ts';
import {shade} from './color.ts';
import {Brush, TAIL_RED, TAIL_AMBER, BRAKE_RED} from './procedural-brush.ts';
import {paintCg125, paintTouringBike} from './procedural-bikes.ts';
type Ctx = CanvasRenderingContext2D;

/** Volkswagen Kombi: white roof and V-shaped belt, one big rear window, engine lid with vents. */
function paintKombi(b: Brush, body: string, brake: boolean): void {
  const white = '#f1ede0';
  b.tyre(29, 60, 13, 18);
  b.tyre(86, 60, 13, 18);
  b.mirror(14, 22, 7, 10, body);
  b.mirror(107, 22, 7, 10, body);
  b.lit([[21, 38], [107, 38], [109, 52], [108, 67], [20, 67], [19, 52]], body);
  b.lit([[27, 6], [101, 6], [106, 13], [107, 40], [64, 50], [21, 40], [22, 13]], white, 1.04, 0.84);
  b.fill([[27, 6], [101, 6], [104, 10], [24, 10]], '#fbf9f0');
  b.fill([[29, 14], [99, 14], [103, 32], [25, 32]], shade(white, 0.7));
  b.glass([[31, 16], [97, 16], [100, 30], [28, 30]]);
  b.rect(62, 16, 4, 14, 'rgba(10,15,30,0.45)');
  b.fill([[36, 46], [92, 46], [94, 62], [34, 62]], shade(body, 0.86));
  for (let i = 0; i < 5; i++) b.rect(47 + i * 7, 48, 5, 2, '#10161f');
  b.plate(53, 53);
  b.rect(61, 41, 6, 6, '#c9d2d8');
  b.rect(62, 42, 4, 4, '#4d5a68');
  b.lamp(22, 40, 8, 10, TAIL_RED, brake);
  b.lamp(22, 51, 8, 6, TAIL_AMBER, false);
  b.lamp(98, 40, 8, 10, TAIL_RED, brake);
  b.lamp(98, 51, 8, 6, TAIL_AMBER, false);
  b.chrome(17, 62, 94, 5);
  b.chrome(27, 57, 5, 13);
  b.chrome(96, 57, 5, 13);
  b.pipe(72, 68);
}

/** Fiat Uno Mille with the roof ladder that decorates half the handymen of Brazil. */
function paintUno(b: Brush, body: string, brake: boolean, ladder = true): void {
  b.tyre(27, 60, 12, 18);
  b.tyre(89, 60, 12, 18);
  b.mirror(14, 20, 7, 8, body);
  b.mirror(107, 20, 7, 8, body);
  b.lit([[22, 33], [106, 33], [108, 46], [108, 62], [20, 62], [20, 46]], body);
  b.lit([[27, 16], [101, 16], [106, 34], [22, 34]], body, 1.18, 0.9);
  b.lit([[31, 7], [97, 7], [102, 17], [26, 17]], body, 1.32, 1.08);
  b.glass([[30, 19], [98, 19], [102, 32], [26, 32]]);
  b.rect(63, 24, 2, 8, '#06090f');
  b.rect(52, 30, 24, 1, '#06090f');
  b.rect(20, 56, 88, 11, '#171b25');
  b.rect(21, 56, 86, 2, '#313847');
  b.plate(53, 57);
  b.lamp(21, 36, 9, 16, TAIL_RED, brake);
  b.lamp(21, 47, 9, 6, TAIL_AMBER, false);
  b.lamp(98, 36, 9, 16, TAIL_RED, brake);
  b.lamp(98, 47, 9, 6, TAIL_AMBER, false);
  b.rect(46, 40, 36, 4, shade(body, 0.7));
  b.rect(61, 38, 6, 3, '#c9d2d8');
  b.pipe(88, 68);
  if (!ladder) return;
  // The ladder: two rails with rungs lying along the roof, sticking out past the tailgate.
  b.rect(41, 2, 3, 22, '#cdd6db');
  b.rect(84, 2, 3, 22, '#cdd6db');
  b.rect(41, 2, 1, 22, '#f4f8fa');
  b.rect(84, 2, 1, 22, '#f4f8fa');
  b.rect(43, 2, 1, 22, '#7d8a96');
  b.rect(86, 2, 1, 22, '#7d8a96');
  for (let y = 5; y < 22; y += 4) b.rect(44, y, 40, 2, '#aab5bc');
  for (let y = 5; y < 22; y += 4) b.rect(44, y + 2, 40, 1, '#4b5560');
  b.rect(38, 22, 8, 5, '#d1202f');
  b.rect(82, 22, 8, 5, '#d1202f');
}

/** Chevrolet Chevette: tall hatch glass with defogger lines, wide tail-light clusters. */
function paintChevette(b: Brush, body: string, brake: boolean): void {
  b.tyre(27, 59, 12, 19);
  b.tyre(89, 59, 12, 19);
  b.mirror(14, 21, 7, 8, body);
  b.mirror(107, 21, 7, 8, body);
  b.lit([[20, 35], [108, 35], [110, 48], [109, 62], [19, 62], [18, 48]], body);
  b.lit([[28, 14], [100, 14], [106, 36], [22, 36]], body, 1.2, 0.9);
  b.lit([[34, 7], [94, 7], [99, 15], [29, 15]], body, 1.34, 1.1);
  b.glass([[31, 17], [97, 17], [102, 33], [26, 33]]);
  for (let y = 21; y < 32; y += 3) b.rect(30, y, 68, 1, 'rgba(255,170,120,0.30)');
  b.rect(63, 22, 2, 10, '#06090f');
  b.rect(22, 38, 84, 11, '#141823');
  b.lamp(22, 39, 26, 9, TAIL_RED, brake);
  b.lamp(80, 39, 26, 9, TAIL_RED, brake);
  b.rect(44, 40, 4, 7, TAIL_AMBER);
  b.rect(80, 40, 4, 7, TAIL_AMBER);
  b.rect(58, 41, 12, 5, '#d9b44a');
  b.rect(59, 42, 10, 3, '#8a6a1c');
  b.plate(53, 51, 22, 9);
  b.rect(18, 59, 92, 8, '#171b25');
  b.rect(19, 59, 90, 2, '#3a4252');
  b.pipe(88, 68);
}

/** Chevrolet Opala SS: long deck, raked rear glass, two black stripes, chrome bumper. */
function paintOpala(b: Brush, body: string, brake: boolean): void {
  b.tyre(26, 60, 13, 18);
  b.tyre(89, 60, 13, 18);
  b.mirror(24, 17, 7, 6, body);
  b.mirror(97, 17, 7, 6, body);
  b.lit([[19, 34], [109, 34], [111, 50], [110, 66], [18, 66], [17, 50]], body);
  b.lit([[33, 9], [95, 9], [104, 33], [24, 33]], body, 1.18, 0.88);
  b.lit([[37, 5], [91, 5], [95, 10], [33, 10]], body, 1.36, 1.12);
  b.glass([[38, 12], [90, 12], [97, 29], [31, 29]]);
  b.lit([[24, 34], [104, 34], [108, 47], [20, 47]], body, 1.3, 1.02);
  b.rect(57, 34, 5, 13, '#0f131c');
  b.rect(66, 34, 5, 13, '#0f131c');
  b.rect(46, 50, 36, 10, '#141823');
  b.rect(52, 52, 24, 1, '#aab5bc');
  b.lamp(19, 48, 26, 11, TAIL_RED, brake);
  b.lamp(83, 48, 26, 11, TAIL_RED, brake);
  b.rect(36, 49, 8, 9, '#f2ede0');
  b.rect(84, 49, 8, 9, '#f2ede0');
  b.plate(53, 53, 22, 8);
  b.chrome(14, 62, 100, 5);
  b.chrome(22, 58, 5, 12);
  b.chrome(101, 58, 5, 12);
  b.pipe(36, 68);
  b.pipe(85, 68);
}

/** Ford Maverick GT: fastback glass, black tail panel with triple tail lights, twin pipes, wide tyres. */
function paintMaverick(b: Brush, body: string, brake: boolean): void {
  b.tyre(11, 55, 19, 23);
  b.tyre(98, 55, 19, 23);
  b.mirror(22, 23, 6, 5, body);
  b.mirror(100, 23, 6, 5, body);
  b.lit([[13, 36], [115, 36], [119, 50], [117, 64], [11, 64], [9, 50]], body);
  b.lit([[32, 10], [96, 10], [108, 36], [20, 36]], body, 1.2, 0.9);
  b.lit([[40, 6], [88, 6], [93, 11], [35, 11]], body, 1.36, 1.1);
  b.glass([[38, 13], [90, 13], [101, 33], [27, 33]]);
  b.lit([[22, 36], [106, 36], [110, 45], [18, 45]], body, 1.32, 1.04);
  b.rect(52, 36, 9, 9, '#0d1018');
  b.rect(67, 36, 9, 9, '#0d1018');
  b.rect(18, 45, 92, 13, '#10131b');
  b.rect(18, 45, 92, 2, shade(body, 1.2));
  for (let i = 0; i < 3; i++) {
    b.lamp(20 + i * 8, 47, 6, 10, TAIL_RED, brake);
    b.lamp(88 + i * 8, 47, 6, 10, TAIL_RED, brake);
  }
  b.rect(60, 48, 8, 3, '#c9d2d8');
  b.plate(53, 52, 22, 8);
  b.chrome(12, 60, 104, 4);
  b.pipe(36, 65, 9, 5);
  b.pipe(83, 65, 9, 5);
}

/** Compact hatch with upright glass and small rectangular tail lights. */
function paintFiat147(b: Brush, body: string, brake: boolean): void {
  b.tyre(24, 52, 13, 24);
  b.tyre(91, 52, 13, 24);
  b.lit([[31, 9], [97, 9], [105, 42], [23, 42]], body);
  b.glass([[36, 15], [92, 15], [98, 36], [30, 36]]);
  b.lit([[23, 40], [105, 40], [107, 66], [21, 66]], body);
  b.rect(29, 42, 70, 2, shade(body, 0.65));
  b.lamp(26, 49, 17, 8, TAIL_RED, brake);
  b.lamp(85, 49, 17, 8, TAIL_RED, brake);
  b.rect(47, 47, 11, 2, '#d9dde0');
  b.plate(55, 56, 18, 7);
  b.chrome(21, 65, 86, 5);
}

/** Rounded sedan, high boot and broad segmented lights. */
function paintMarea(b: Brush, body: string, brake: boolean): void {
  b.tyre(16, 52, 17, 25);
  b.tyre(95, 52, 17, 25);
  b.lit([[34, 7], [94, 7], [109, 40], [19, 40]], body, 1.25, 0.8, 6);
  b.glass([[37, 13], [91, 13], [101, 33], [27, 33]]);
  b.lit([[19, 38], [109, 38], [116, 62], [12, 62]], body, 1.3, 0.8, 6);
  b.lit([[12, 53], [116, 53], [112, 70], [16, 70]], body);
  b.lamp(18, 47, 26, 9, TAIL_RED, brake);
  b.lamp(84, 47, 26, 9, TAIL_RED, brake);
  b.rect(36, 49, 6, 3, '#eee5d1');
  b.rect(86, 49, 6, 3, '#eee5d1');
  b.plate(53, 54, 22, 8);
  b.rect(19, 65, 90, 4, '#252b30');
  b.chrome(91, 71, 12, 3);
}

/** Angular fastback with sloped rear glass and a chrome bumper. */
function paintPassat(b: Brush, body: string, brake: boolean): void {
  b.tyre(20, 52, 15, 24);
  b.tyre(93, 52, 15, 24);
  b.lit([[34, 6], [94, 6], [108, 44], [20, 44]], body, 1.22, 0.8, 1);
  b.glass([[37, 12], [91, 12], [102, 37], [26, 37]]);
  b.lit([[20, 42], [108, 42], [110, 67], [18, 67]], body, 1.2, 0.8, 1);
  b.rect(25, 45, 78, 2, shade(body, 0.55));
  b.lamp(23, 51, 25, 8, TAIL_RED, brake);
  b.lamp(80, 51, 25, 8, TAIL_RED, brake);
  b.rect(24, 51, 5, 8, TAIL_AMBER);
  b.rect(99, 51, 5, 8, TAIL_AMBER);
  b.plate(54, 53, 20, 8);
  b.chrome(18, 65, 92, 5);
}

/** Low fibreglass coupe with a curved rear window and round tail lights. */
function paintPuma(b: Brush, body: string, brake: boolean): void {
  b.tyre(17, 55, 18, 22);
  b.tyre(93, 55, 18, 22);
  b.lit([[41, 16], [87, 16], [106, 43], [22, 43]], body, 1.3, 0.8, 8);
  b.glass([[42, 21], [86, 21], [97, 39], [31, 39]]);
  b.lit([[22, 42], [106, 42], [115, 62], [108, 70], [20, 70], [13, 62]], body, 1.3, 0.75, 8);
  for (let y = 44; y < 51; y += 3) b.rect(44, y, 40, 1, shade(body, 0.5));
  for (const x of [29, 42, 86, 99]) b.circle(x, 58, 5, brake ? BRAKE_RED : TAIL_RED);
  b.plate(54, 57, 20, 8);
  b.chrome(21, 68, 28, 3);
  b.chrome(79, 68, 28, 3);
}

const PAINTERS: Readonly<Record<string, (brush: Brush, body: string, brake: boolean) => void>> = {
  fiat147: paintFiat147,
  marea: paintMarea,
  passat: paintPassat,
  puma: paintPuma,
  kombi: paintKombi,
  uno: paintUno,
  'uno-normal': (b, body, brake) => paintUno(b, body, brake, false),
  chevette: paintChevette,
  opala: paintOpala,
  maverick: paintMaverick,
  cg125: paintCg125,
  harley: paintTouringBike,
};

/** Snaps anti-aliased edges to full or zero alpha so the art stays crisp pixel art. */
function snapAlpha(c: Ctx, width: number, height: number): void {
  const image = c.getImageData(0, 0, width, height);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i]! > 110 ? 255 : 0;
  c.putImageData(image, 0, 0);
}

/** Paints the car onto an empty 128 x 80 context. Returns false for ids without hand-made art. */
export function paintProceduralCar(c: Ctx, car: CarLook, brake: boolean): boolean {
  const painter = PAINTERS[car.id];
  if (!painter) return false;
  painter(new Brush(c), car.color, brake);
  snapAlpha(c, 128, 80);
  return true;
}


export {mix} from './color.ts';
