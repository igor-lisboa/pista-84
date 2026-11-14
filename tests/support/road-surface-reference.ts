import {LANES, LANE_DIVIDERS, LANE_WIDTH, PATH_UNIT, laneCenter, screenToDepth} from '../../src/game/road.ts';

/** Original row renderer retained only for pixel-equivalence checks of the batched surface. */
export function paintReferenceRoad(ctx: CanvasRenderingContext2D, path: number, centerAt: (t: number) => number): void {
  const w = 960, h = 720, horizon = 198, roadH = h - horizon;
  const rect = (x: number, y: number, width: number, height: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(width), Math.ceil(height));
  };
  for (let y = horizon + 2; y < h; y += 2) {
    const t = (y - horizon) / roadH;
    const center = centerAt(t), half = w * (0.018 + 0.67 * t);
    const world = path + screenToDepth(t) * PATH_UNIT;
    const far = t < 0.07, band = far ? 0 : Math.floor(world / 7) % 2;
    const kerb = Math.floor(world / 4) % 2;
    rect(-20, y, w + 40, y > h - 3 ? 22 : 2, band ? '#58a845' : '#4d9a3d');
    const edge = 1 + w * 0.022 * t;
    rect(center - half - edge, y, (half + edge) * 2, 2, far ? '#c9d0d9' : kerb ? '#e8ecef' : '#d9473f');
    rect(center - half, y, half * 2, 2, band ? '#484c57' : '#50545f');
    const line = Math.max(1, w * 0.0045 * t);
    rect(center - half * 0.93, y, line, 2, '#dfe3ea');
    rect(center + half * 0.93 - line, y, line, 2, '#dfe3ea');
    if (!far && world % 6 < 3) {
      for (const divider of LANE_DIVIDERS) rect(center + divider * half - line * 0.5, y, line, 2, '#f0f0e2');
    }
    if (t > 0.18) {
      for (const lane of LANES) {
        const laneX = center + laneCenter(lane) * half;
        rect(laneX - half * LANE_WIDTH * 0.24, y, line, 2, '#00000014');
        rect(laneX + half * LANE_WIDTH * 0.24, y, line, 2, '#00000014');
      }
    }
  }
}
