import {Brush, TAIL_RED} from './procedural-brush.ts';
import {shade} from './color.ts';

/** Honda CG 125 motoboy: round white helmet, jacket, jeans, red delivery top-case and chrome silencer. */
export function paintCg125(b: Brush, body: string, brake: boolean): void {
  const jacket = '#262e40';
  const denim = '#244f8f';
  // Rear tyre and mudguard.
  b.tyre(57, 52, 14, 26);
  b.rect(55, 50, 18, 4, '#3b4356');
  // Chrome silencer on the right.
  b.fill([[76, 58], [84, 58], [85, 74], [76, 75]], '#aab6c0', true, 1);
  b.rect(78, 59, 2, 14, '#f1f5f8');
  b.rect(76, 72, 9, 3, '#12161e');
  // Jeans and boots on both sides of the top-case.
  b.lit([[44, 42], [51, 42], [51, 60], [43, 60]], denim, 1.25, 0.75, 2);
  b.lit([[77, 42], [84, 42], [85, 60], [77, 60]], denim, 1.25, 0.75, 2);
  b.rect(42, 59, 10, 5, '#141820');
  b.rect(77, 59, 10, 5, '#141820');
  // Handlebar, mirrors and arms.
  b.rect(34, 25, 60, 3, '#1b212c');
  b.mirror(30, 17, 9, 6, '#222');
  b.mirror(89, 17, 9, 6, '#222');
  b.fill([[42, 22], [54, 28], [54, 40], [43, 36]], jacket, true, 2);
  b.fill([[86, 22], [74, 28], [74, 40], [85, 36]], jacket, true, 2);
  b.rect(35, 24, 7, 5, '#0f131b');
  b.rect(86, 24, 7, 5, '#0f131b');
  // Torso with reflective stripes.
  b.lit([[48, 22], [80, 22], [84, 44], [44, 44]], jacket, 1.7, 0.85, 4);
  b.rect(50, 31, 28, 2, '#e8d34a');
  b.rect(49, 37, 30, 2, '#e8d34a');
  // Helmet.
  b.circle(64, 12, 10, '#f4f4f0');
  b.rect(55, 13, 18, 5, '#18222f');
  b.rect(57, 6, 14, 2, '#ffffff');
  b.rect(57, 19, 14, 2, '#c8402f');
  // Delivery top-case in the bike's colour.
  b.lit([[50, 38], [78, 38], [80, 54], [48, 54]], body, 1.3, 0.8, 3);
  b.rect(54, 41, 20, 5, shade(body, 1.35));
  b.rect(58, 43, 12, 2, '#f4f4f0');
  b.rect(48, 52, 32, 2, shade(body, 0.55));
  b.lamp(54, 55, 20, 4, TAIL_RED, brake);
  b.plate(56, 62, 16, 7);
}


/** Touring-bike fallback uses the same brush and registry as the rest of the fleet. */
export function paintTouringBike(b: Brush, body: string, brake: boolean): void {
  const rect = (x: number, y: number, w: number, h: number, color: string): void => {
    b.rect(x, y, w, h, color);
  };
  rect(56, 47, 16, 31, '#11151c');
  rect(59, 56, 10, 20, '#303843');
  rect(24, 42, 29, 26, '#c4c9cd');
  rect(75, 42, 29, 26, '#c4c9cd');
  rect(27, 44, 23, 20, body);
  rect(78, 44, 23, 20, shade(body, 0.8));
  rect(25, 47, 27, 2, '#fff1ce');
  rect(76, 47, 27, 2, '#fff1ce');
  rect(52, 39, 24, 21, body);
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
}
