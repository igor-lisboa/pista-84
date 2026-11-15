import {shade} from './color.ts';

type Ctx = CanvasRenderingContext2D;
type Point = readonly [number, number];

const OUTLINE = '#0a0f1e';
const GLASS_TOP = '#35566f';
const GLASS_BOTTOM = '#0f1b2b';
const CHROME_TOP = '#f3f6f8';
const CHROME_BOTTOM = '#7d8a96';
const TYRE = '#10131c';
export const TAIL_RED = '#d1202f';
export const TAIL_AMBER = '#ff9a2e';
export const BRAKE_RED = '#ff5a52';

/** Drawing helpers shared by every model. */
export class Brush {
  private readonly c: Ctx;

  constructor(c: Ctx) {
    this.c = c;
  }

  /** Closed path through `points`; a positive radius rounds every corner. */
  private path(points: readonly Point[], radius = 0): void {
    const c = this.c;
    c.beginPath();
    if (radius <= 0) {
      points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      return;
    }
    const last = points.length - 1;
    const start: Point = [(points[last]![0] + points[0]![0]) / 2, (points[last]![1] + points[0]![1]) / 2];
    c.moveTo(start[0], start[1]);
    points.forEach(([x, y], i) => {
      const next = points[(i + 1) % points.length]!;
      c.arcTo(x, y, (x + next[0]) / 2, (y + next[1]) / 2, radius);
    });
    c.closePath();
  }

  private gradient(points: readonly Point[], top: string, bottom: string): CanvasGradient {
    const ys = points.map(([, y]) => y);
    const gradient = this.c.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    return gradient;
  }

  fill(points: readonly Point[], style: string | CanvasGradient, outline = true, radius = 0): void {
    const c = this.c;
    this.path(points, radius);
    c.fillStyle = style;
    c.fill();
    if (outline) {
      c.strokeStyle = OUTLINE;
      c.lineWidth = 1.6;
      c.lineJoin = 'round';
      c.stroke();
    }
  }

  circle(x: number, y: number, radius: number, color: string): void {
    const c = this.c;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.strokeStyle = OUTLINE;
    c.lineWidth = 1.6;
    c.stroke();
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.c.fillStyle = color;
    this.c.fillRect(x, y, w, h);
  }

  /** A panel lit from above: lighter at the top edge, darker at the bottom. */
  lit(points: readonly Point[], base: string, top = 1.22, bottom = 0.78, radius = 3): void {
    this.fill(points, this.gradient(points, shade(base, top), shade(base, bottom)), true, radius);
    this.roundOff(points, radius);
  }

  /** Darkens the left and right edges of a panel so flat polygons read as curved bodywork. */
  private roundOff(points: readonly Point[], radius: number): void {
    const c = this.c;
    const xs = points.map(([x]) => x);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    if (right - left < 24) return;
    const gradient = c.createLinearGradient(left, 0, right, 0);
    gradient.addColorStop(0, 'rgba(5, 8, 20, 0.34)');
    gradient.addColorStop(0.16, 'rgba(5, 8, 20, 0)');
    gradient.addColorStop(0.84, 'rgba(5, 8, 20, 0)');
    gradient.addColorStop(1, 'rgba(5, 8, 20, 0.38)');
    c.save();
    this.path(points, radius);
    c.clip();
    c.fillStyle = gradient;
    c.fillRect(left, 0, right - left, 80);
    c.restore();
  }

  /** Window glass with a diagonal reflection. */
  glass(points: readonly Point[]): void {
    const c = this.c;
    this.fill(points, this.gradient(points, GLASS_TOP, GLASS_BOTTOM), true, 2);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    c.save();
    this.path(points, 2);
    c.clip();
    c.fillStyle = 'rgba(190, 225, 240, 0.28)';
    const width = (right - left) * 0.16;
    const start = left + (right - left) * 0.18;
    c.beginPath();
    c.moveTo(start + width, top);
    c.lineTo(start + width * 2.2, top);
    c.lineTo(start + width * 0.9, bottom);
    c.lineTo(start - width * 0.3, bottom);
    c.closePath();
    c.fill();
    c.restore();
  }

  chrome(x: number, y: number, w: number, h: number): void {
    const c = this.c;
    const gradient = c.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, CHROME_TOP);
    gradient.addColorStop(0.45, '#b9c3cb');
    gradient.addColorStop(1, CHROME_BOTTOM);
    c.fillStyle = gradient;
    c.fillRect(x, y, w, h);
    c.strokeStyle = OUTLINE;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  /** A rounded tyre with a lighter shoulder and a tread band. */
  tyre(x: number, y: number, w: number, h: number): void {
    const corners: Point[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    this.fill(corners, TYRE, true, 3);
    this.rect(x + 2, y + 2, w - 4, 2, '#323a4d');
    for (let row = y + 8; row < y + h - 3; row += 4) this.rect(x + 2, row, w - 4, 1, '#222838');
  }

  /** A tail-light unit with an inner glow; brighter while braking. */
  lamp(x: number, y: number, w: number, h: number, color: string, brake: boolean): void {
    const lit = color === TAIL_RED && brake ? BRAKE_RED : color;
    this.rect(x - 1, y - 1, w + 2, h + 2, '#2a1620');
    this.rect(x, y, w, h, shade(lit, 0.75));
    this.rect(x, y, w, Math.max(1, Math.floor(h * 0.55)), lit);
    this.rect(x + 1, y + 1, Math.max(1, Math.floor(w * 0.4)), 1, '#ffd6cf');
  }

  plate(x: number, y: number, w = 22, h = 8): void {
    this.rect(x - 1, y - 1, w + 2, h + 2, '#272d38');
    this.rect(x, y, w, h, '#e9e6d6');
    this.rect(x, y + h - 2, w, 2, '#bdb9a4');
    this.rect(x + 2, y + 2, w - 4, 1, '#6a6f78');
    this.rect(x + 2, y + 4, w - 7, 1, '#6a6f78');
  }

  mirror(x: number, y: number, w: number, h: number, body: string): void {
    this.rect(x, y, w, h, shade(body, 0.55));
    this.rect(x + 1, y + 1, w - 2, 2, '#9fb3c1');
    this.rect(x, y + h - 1, w, 1, OUTLINE);
  }

  /** Round exhaust tip. */
  pipe(x: number, y: number, w = 7, h = 4): void {
    this.rect(x, y, w, h, '#2a303a');
    this.rect(x + 1, y + 1, w - 2, h - 2, '#0b0e15');
    this.rect(x, y, w, 1, '#9aa6b1');
  }
}
