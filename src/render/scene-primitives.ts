/** Pixel-aligned filled rectangle. */
export function pixelRect(ctx: CanvasRenderingContext2D, x: number, y: number, ww: number, hh: number, color: string): void {
  const c = ctx;
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.ceil(ww), Math.ceil(hh));
}

/** Trapezoid between two horizontal edges given by centre x, y and half width. */
export function pixelQuad(ctx: CanvasRenderingContext2D, x1: number, y1: number, hw1: number, x2: number, y2: number, hw2: number, color: string): void {
  const c = ctx;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x1 - hw1, y1);
  c.lineTo(x1 + hw1, y1);
  c.lineTo(x2 + hw2, y2);
  c.lineTo(x2 - hw2, y2);
  c.closePath();
  c.fill();
}
