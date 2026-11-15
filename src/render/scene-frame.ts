import type {Environment, Race} from '../game/index.ts';
import type {Palette} from './scene-palette.ts';

export const FRAME_WIDTH = 960;
export const FRAME_HEIGHT = 720;
export const HORIZON_RATIO = 0.275;
export const SCREEN_BLEED = 20;
export const ROAD_SAMPLES = 160;
export const roadHalfFraction = (t: number): number => 0.018 + 0.67 * t;

export interface Drawable {
  readonly t: number;
  readonly draw: () => void;
}

/** Everything one frame needs, computed once and shared by the painting steps. */
export interface FrameContext {
  readonly race: Race;
  readonly w: number;
  readonly h: number;
  readonly preview: boolean;
  readonly clock: number;
  readonly path: number;
  /** Path distance expressed in `PATH_UNIT`s. */
  readonly scroll: number;
  readonly speed: number;
  /** 0..2.75 intensity of speed effects. */
  readonly fast: number;
  readonly env: Environment;
  readonly palette: Palette;
  readonly horizon: number;
  readonly roadH: number;
  readonly sceneScale: number;
  /** Player's lateral offset in pixels. */
  readonly wanted: number;
  readonly bendNow: number;
  readonly input: DrawInput;
}

export interface DrawInput {
  brake?: boolean;
}
