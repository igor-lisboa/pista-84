import {LANES, LANE_DIVIDERS, LANE_WIDTH, PATH_UNIT, laneCenter, screenToDepth} from '../game/road.ts';

interface SurfaceFrame {
  readonly path: number;
  readonly grassA: string;
  readonly grassB: string;
  readonly asphalt: readonly [string, string];
  centerAt(depth: number): number;
}

interface SurfaceRow {
  readonly y: number;
  readonly t: number;
  readonly half: number;
  readonly distance: number;
  readonly edge: number;
  readonly line: number;
}

const ROW_HEIGHT = 2;
const BLEED = 20;
const FAR_LIMIT = 0.07;
const DASH_PERIOD = 6;

/** Same integer-aligned road rectangles, submitted in a handful of nonoverlapping paint layers. */
export class RoadSurface {
  private readonly rows: readonly SurfaceRow[];
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number, horizon: number) {
    this.width = width;
    this.height = height;
    const rows: SurfaceRow[] = [];
    for (let y = horizon + 2; y < height; y += ROW_HEIGHT) {
      const t = (y - horizon) / (height - horizon);
      rows.push({y, t, half: width * (0.018 + 0.67 * t), distance: screenToDepth(t) * PATH_UNIT,
        edge: 1 + width * 0.022 * t, line: Math.max(1, width * 0.0045 * t)});
    }
    this.rows = rows;
  }

  paint(ctx: CanvasRenderingContext2D, frame: SurfaceFrame): void {
    const grass = [new Path2D(), new Path2D()] as const;
    const kerbs = [new Path2D(), new Path2D(), new Path2D()] as const;
    const road = [new Path2D(), new Path2D()] as const;
    const edges = new Path2D();
    const dashes = new Path2D();
    const tracks = new Path2D();
    const rect = (path: Path2D, x: number, y: number, width: number, height = ROW_HEIGHT): void => {
      path.rect(Math.round(x), Math.round(y), Math.ceil(width), Math.ceil(height));
    };
    for (const {y, t, half, distance, edge, line} of this.rows) {
      const center = frame.centerAt(t);
      const world = frame.path + distance;
      const far = t < FAR_LIMIT;
      const band = !far && Math.floor(world / 7) % 2 !== 0 ? 1 : 0;
      const kerb = far ? 2 : Math.floor(world / 4) % 2 !== 0 ? 1 : 0;
      rect(grass[band], -BLEED, y, this.width + 40, y > this.height - 3 ? 22 : ROW_HEIGHT);
      rect(kerbs[kerb], center - half - edge, y, (half + edge) * 2);
      rect(road[band], center - half, y, half * 2);
      rect(edges, center - half * 0.93, y, line);
      rect(edges, center + half * 0.93 - line, y, line);
      if (!far && world % DASH_PERIOD < DASH_PERIOD / 2) {
        for (const divider of LANE_DIVIDERS) rect(dashes, center + divider * half - line * 0.5, y, line);
      }
      if (t > 0.18) {
        for (const lane of LANES) {
          const laneX = center + laneCenter(lane) * half;
          rect(tracks, laneX - half * LANE_WIDTH * 0.24, y, line);
          rect(tracks, laneX + half * LANE_WIDTH * 0.24, y, line);
        }
      }
    }
    const fill = (path: Path2D, color: string): void => { ctx.fillStyle = color; ctx.fill(path); };
    fill(grass[0], frame.grassB);
    fill(grass[1], frame.grassA);
    fill(kerbs[0], '#d9473f');
    fill(kerbs[1], '#e8ecef');
    fill(kerbs[2], '#c9d0d9');
    fill(road[0], frame.asphalt[0]);
    fill(road[1], frame.asphalt[1]);
    fill(edges, '#dfe3ea');
    fill(dashes, '#f0f0e2');
    fill(tracks, '#00000014');
  }
}
