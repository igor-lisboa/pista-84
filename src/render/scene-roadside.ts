import {PATH_UNIT, WALL, depthToScreen} from '../game/index.ts';
import {hash} from './noise.ts';
import {drawBillboard, drawBush, drawLamp, drawTree} from './scenery.ts';
import {roadHalfFraction} from './scene-frame.ts';
import type {Drawable, FrameContext} from './scene-frame.ts';

export function sceneryDrawables(ctx: CanvasRenderingContext2D, f: FrameContext, road: (depth: number) => number): Drawable[] {
  const { scroll } = f;
  const spacing = 12 / PATH_UNIT;
  const kmin = Math.ceil((scroll - 0.09) / spacing);
  const kmax = Math.floor((scroll + 1.02) / spacing);
  const drawables: Drawable[] = [];
  for (let k = kmin; k <= kmax; k++) {
    const t = depthToScreen(k * spacing - scroll);
    if (t < 0.03 || t > 1.12) continue;
    drawables.push({ t, draw: () => paintRoadsideProp(ctx, f, road, k, t) });
  }
  return drawables;
}

/** One billboard, lamp, bush or tree, chosen by the marker index so the layout is deterministic. */
function paintRoadsideProp(ctx: CanvasRenderingContext2D, f: FrameContext, road: (depth: number) => number, k: number, t: number): void {
  const c = ctx;
  const { w, horizon, roadH, env } = f;
  const side = k % 2 ? 1 : -1;
  const sample = Math.abs(k);
  const half = w * roadHalfFraction(t);
  const y = horizon + t * roadH;
  const s = ((0.11 + t * 1.08) * w) / 480;
  const edge = road(t) + side * half * WALL;
  if (sample % 19 === 7) drawBillboard(c, edge + side * (half * 0.2 + w * 0.025 * t), y, s * 1.1, Math.floor(sample / 19));
  else if (sample % 14 === 0) drawLamp(c, edge + side * half * 0.05, y, s, side, env.night);
  else if (sample % 7 === 3) drawBush(c, edge + side * (w * 0.012 + half * 0.1), y, s, sample % 2 === 0);
  else drawTree(c, edge + side * (w * 0.03 + w * 0.1 * t + hash(sample) * half * 0.28), y, s * (0.88 + hash(sample + 9) * 0.3));
}
