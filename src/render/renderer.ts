import {PATH_UNIT, PLAYER_T, clamp, roadBend} from '../game/index.ts';
import type {Race} from '../game/index.ts';
import {RoadCamera} from './road-camera.ts';
import {SceneVehicles} from './scene-vehicles.ts';
import {sceneryDrawables} from './scene-roadside.ts';
import {paintSky} from './scene-sky.ts';
import {paintWeather, paintSpeedStreaks, paintOverlays} from './scene-weather.ts';
import {PALETTES, blendPalette} from './scene-palette.ts';
import {FRAME_WIDTH, FRAME_HEIGHT, HORIZON_RATIO, roadHalfFraction} from './scene-frame.ts';
import type {DrawInput, FrameContext} from './scene-frame.ts';

export {drawCar} from './sprites.ts';
export {blendColor} from './scene-palette.ts';
export type {DrawInput} from './scene-frame.ts';

const MAX_FRAME_STEP = 0.1;
const HIT_DECAY = 2.2;
const FLASH_DECAY = 3;
const OFFROAD_SHAKE = 0.45;
const PREVIEW_SPEED = 100;
const PREVIEW_PATH_RATE = 30;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly road: RoadCamera;
  private readonly vehicles: SceneVehicles;
  private heading = 0;
  private lastClock = 0;
  private hitShake = 0;
  private flash = 0;
  private lastPath: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.road = new RoadCamera(ctx);
    this.vehicles = new SceneVehicles(ctx, this.road.centerAt);
    this.resize();
  }

  /** Keeps the same road, sight distance and vehicle proportions on every screen. */
  resize(): void {
    if (this.canvas.width !== FRAME_WIDTH || this.canvas.height !== FRAME_HEIGHT) {
      this.canvas.width = FRAME_WIDTH;
      this.canvas.height = FRAME_HEIGHT;
    }
    this.ctx.imageSmoothingEnabled = false;
  }

  draw(race: Race, clock = 0, input: DrawInput = {}): void {
    const frame = this.beginFrame(race, clock, input);
    const c = this.ctx;
    c.save();
    c.translate(...this.shakeOffset(frame));
    paintSky(c, frame, this.heading, this.road.cameraOffset);
    this.road.paintRows(frame);
    this.road.paintGuardRail(frame);
    this.road.paintDistanceFog(frame);
    const drawables = [
      ...sceneryDrawables(c, frame, this.road.centerAt),
      ...this.vehicles.drawables(frame),
      {t: PLAYER_T, draw: () => this.vehicles.paintPlayer(frame)},
    ];
    drawables.sort((a, b) => a.t - b.t);
    for (const drawable of drawables) drawable.draw();
    paintWeather(c, frame);
    paintSpeedStreaks(c, frame, this.road.centerAt);
    c.restore();
    paintOverlays(c, frame, this.flash);
  }

  /** Advances camera/shake/heading state and gathers the values the painting steps share. */
  private beginFrame(race: Race, clockArg: number, input: DrawInput): FrameContext {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const preview = race.status === 'ready';
    const frameStep = clamp(clockArg - this.lastClock, 0, MAX_FRAME_STEP);
    this.lastClock = clockArg;
    const clock = preview ? clockArg : race.time;
    const path = preview ? clock * PREVIEW_PATH_RATE : race.path;
    const speed = preview ? PREVIEW_SPEED : race.speed;
    const env = race.environment;
    const horizon = Math.round(h * HORIZON_RATIO);
    const playerHalf = w * roadHalfFraction(PLAYER_T);
    const wanted = race.x * playerHalf;
    this.road.update(path, race.roadSeed, wanted * 0.4);
    const bendNow = preview ? 0 : roadBend(path, race.roadSeed);
    this.updateImpactEffects(race, frameStep);
    this.updateHeading(path, bendNow);
    return {
      race,
      w,
      h,
      preview,
      clock,
      path,
      scroll: path / PATH_UNIT,
      speed,
      // 150 km/h reaches the old flat-out effects; keep building all the way to 350.
      fast: clamp((speed - 35) / 115, 0, 2.75),
      env,
      palette: blendPalette(PALETTES[env.from], PALETTES[env.to], env.mix),
      horizon,
      roadH: h - horizon,
      sceneScale: Math.min(w, h * 1.25) / 550,
      wanted,
      bendNow,
      input,
    };
  }

  private updateImpactEffects(race: Race, frameStep: number): void {
    for (const event of race.events) {
      if (event === 'hit') {
        this.hitShake = 1;
        this.flash = 1;
      } else if (event === 'offroad') {
        this.hitShake = Math.max(this.hitShake, OFFROAD_SHAKE);
      }
    }
    this.hitShake = Math.max(0, this.hitShake - frameStep * HIT_DECAY);
    this.flash = Math.max(0, this.flash - frameStep * FLASH_DECAY);
  }

  /** The horizon pans with the distance driven through bends. */
  private updateHeading(path: number, bendNow: number): void {
    const travelled = this.lastPath === null || path < this.lastPath ? 0 : path - this.lastPath;
    this.lastPath = path;
    this.heading += bendNow * travelled * 0.67;
  }

  private shakeOffset(f: FrameContext): [number, number] {
    const rumble = (f.race.offroad ? 2.8 : 0) + Math.max(0, f.speed - 85) / 65 + this.hitShake * 7;
    const shakeX = Math.sin(f.clock * 91) * rumble;
    const shakeY = Math.cos(f.clock * 77) * rumble * 0.7;
    return [Math.round(shakeX), Math.round(shakeY)];
  }

}
