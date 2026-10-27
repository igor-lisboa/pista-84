import {
  LANES,
  LANE_DIVIDERS,
  LANE_WIDTH,
  PATH_UNIT,
  PLAYER_T,
  VEHICLE_SCALE,
  WALL,
  clamp,
  depthToScreen,
  environment,
  laneCenter,
  roadBend,
  screenToDepth,
} from '../game/index.ts';
import type { CarLook, Entity, Environment, FuelEntity, LightName, Race } from '../game/index.ts';
import { hash } from './noise.ts';
import { drawBillboard, drawBush, drawClouds, drawLamp, drawMountains, drawSkyline, drawSun, drawTree } from './scenery.ts';
import { drawCar } from './sprites.ts';

export { drawCar } from './sprites.ts';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

interface Palette {
  readonly skyTop: string;
  readonly haze: string;
  readonly farRidge: string;
  readonly nearRidge: string;
  readonly grassA: string;
  readonly grassB: string;
  readonly sun: string;
}

const PALETTE_KEYS = ['skyTop', 'haze', 'farRidge', 'nearRidge', 'grassA', 'grassB', 'sun'] as const;

const PALETTES: Readonly<Record<LightName, Palette>> = {
  day: {
    skyTop: '#2f7fd0',
    haze: '#c4e6f4',
    farRidge: '#8fb2d0',
    nearRidge: '#6e9aa8',
    grassA: '#58a845',
    grassB: '#4d9a3d',
    sun: '#fff0a8',
  },
  sunset: {
    skyTop: '#3f3a86',
    haze: '#ff9a5c',
    farRidge: '#9a6c9c',
    nearRidge: '#6e5280',
    grassA: '#527f3c',
    grassB: '#487234',
    sun: '#ffd070',
  },
  night: {
    skyTop: '#080e2c',
    haze: '#2b386c',
    farRidge: '#2a3760',
    nearRidge: '#1d2849',
    grassA: '#1f4632',
    grassB: '#1a3b2b',
    sun: '#e4ecff',
  },
  dawn: {
    skyTop: '#5f64b0',
    haze: '#ffb7a0',
    farRidge: '#a58ab2',
    nearRidge: '#7a749c',
    grassA: '#5e8c47',
    grassB: '#53803f',
    sun: '#ffe2a2',
  },
};

/** Sun height above the horizon, as a fraction of the sky height. */
const SUN_ALTITUDE: Readonly<Record<LightName, number>> = { day: 0.72, sunset: 0.1, night: 0.78, dawn: 0.13 };
/** Sun radius in 480px-wide canvas pixels. */
const SUN_SIZE: Readonly<Record<LightName, number>> = { day: 15, sunset: 27, night: 9, dawn: 22 };

const NIGHT_STAR_COLOR = '#d1dded';
const STAR_COUNT = 40;
const SKY_BANDS = 28;

const parseHex = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Linear blend of two `#rrggbb` colours. */
export function blendColor(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  const channels = x.map((v, i) =>
    Math.round(v + (y[i]! - v) * t)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${channels.join('')}`;
}

function blendPalette(from: Palette, to: Palette, mix: number): Palette {
  const blended = {} as Record<(typeof PALETTE_KEYS)[number], string>;
  for (const key of PALETTE_KEYS) blended[key] = blendColor(from[key], to[key], mix);
  return blended;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Number of depth samples used to integrate the road curvature. */
const SAMPLES = 160;
const HORIZON_RATIO = 0.275;
// One camera for every device. CSS contains this frame without cropping or stretching.
const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 720;
/** Half road width (as a fraction of canvas width) at the horizon and its growth towards the camera. */
const ROAD_HALF_MIN = 0.018;
const ROAD_HALF_SLOPE = 0.67;
const ROW_HEIGHT = 2;
const SCREEN_BLEED = 20;
/** Screen depth below which road rows are treated as distant (no stripes). */
const FAR_ROW_LIMIT = 0.07;

/** Half road width, as a fraction of canvas width, at screen depth `t`. */
const roadHalfFraction = (t: number): number => ROAD_HALF_MIN + ROAD_HALF_SLOPE * t;

// ---------------------------------------------------------------------------
// Frame state
// ---------------------------------------------------------------------------

/** Menu-preview traffic: cars that only need a look, a lane and a depth. */
interface PreviewVehicle {
  readonly lane: number;
  readonly z: number;
  readonly car: CarLook;
}

const PREVIEW_TRAFFIC: readonly PreviewVehicle[] = [
  { lane: -2, z: 0.29, car: { id: 'gt', color: '#e5bc47', shape: 'sport' } },
  { lane: 1, z: 0.4, car: { id: 'fusca', color: '#cdbd8b', shape: 'bug' } },
  { lane: 2, z: 0.68, car: { id: 'gol', color: '#5476aa', shape: 'box' } },
  { lane: -1, z: 0.84, car: { id: 'palio', color: '#cc6158', shape: 'box' } },
];

type SceneVehicle = Entity | PreviewVehicle;

/** Something standing on the ground; drawn far-to-near so it overlaps correctly. */
interface Drawable {
  readonly t: number;
  readonly draw: () => void;
}

/** Everything one frame needs, computed once and shared by the painting steps. */
interface FrameContext {
  readonly race: Race;
  readonly w: number;
  readonly h: number;
  readonly preview: boolean;
  readonly clock: number;
  readonly path: number;
  /** Path distance expressed in `PATH_UNIT`s. */
  readonly scroll: number;
  readonly speed: number;
  /** 0..1 intensity of speed effects. */
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

const MAX_FRAME_STEP = 0.1;
const HIT_DECAY = 2.2;
const FLASH_DECAY = 3;
const OFFROAD_SHAKE = 0.45;
const PREVIEW_SPEED = 100;
const PREVIEW_PATH_RATE = 30;

const isFuel = (vehicle: SceneVehicle): vehicle is FuelEntity => 'type' in vehicle && vehicle.type === 'fuel';

/** Lane a vehicle is steering towards; preview cars and pickups stay in their lane. */
const targetLaneOf = (vehicle: SceneVehicle): number => ('targetLane' in vehicle ? vehicle.targetLane : vehicle.lane);

/** Pixel gas pump: red body, white meter, black hose and a separate nozzle. */
const FUEL_PUMP_BLOCKS: readonly (readonly [number, number, number, number, string])[] = [
  [-18, -44, 30, 42, '#172137'],
  [-15, -41, 24, 36, '#d9473f'],
  [-15, -41, 24, 3, '#ff8261'],
  [-12, -35, 18, 13, '#fff2d5'],
  [-9, -32, 12, 5, '#243b4c'],
  [-10, -17, 14, 3, '#fff2d5'],
  [12, -33, 7, 4, '#172137'],
  [17, -31, 5, 24, '#172137'],
  [11, -10, 10, 5, '#172137'],
  [21, -39, 5, 13, '#172137'],
  [17, -42, 9, 5, '#d7e2e6'],
  [14, -44, 5, 5, '#d7e2e6'],
  [-21, -5, 36, 6, '#172137'],
  [-18, -4, 30, 2, '#d7e2e6'],
];

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: Ctx;
  private cameraOffset = 0;
  private readonly offsets = new Float32Array(SAMPLES + 1);
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
    this.paintSky(frame);
    this.paintRoadRows(frame);
    this.paintGuardRail(frame);
    this.paintDistanceFog(frame);
    this.paintGroundObjects(frame);
    this.paintWeather(frame);
    this.paintSpeedStreaks(frame);
    c.restore();
    this.paintOverlays(frame);
  }

  // -------------------------------------------------------------------------
  // Frame setup
  // -------------------------------------------------------------------------

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
    const env = environment(race.time);
    const horizon = Math.round(h * HORIZON_RATIO);
    const playerHalf = w * roadHalfFraction(PLAYER_T);
    const wanted = race.x * playerHalf;
    this.cameraOffset = wanted * 0.4;
    this.profile(path, race.roadSeed);
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

  // -------------------------------------------------------------------------
  // Road geometry
  // -------------------------------------------------------------------------

  /**
   * Lateral road offset per depth row: curvature is integrated along the *upcoming* track, so a
   * bend enters at the horizon and sweeps toward the car instead of the whole road swaying rigidly.
   */
  private profile(path: number, seed = 0): void {
    const w = this.canvas.width;
    const raw = new Float32Array(SAMPLES + 1);
    const playerSample = Math.round(PLAYER_T * SAMPLES);
    const playerDepth = screenToDepth(PLAYER_T);
    for (const dir of [-1, 1]) {
      let offset = 0;
      let slope = 0;
      let prev = playerDepth;
      for (let i = playerSample + dir; i >= 0 && i <= SAMPLES; i += dir) {
        const u = screenToDepth(i / SAMPLES);
        const du = u - prev;
        const change = roadBend(path + ((u + prev) / 2) * PATH_UNIT, seed) * du;
        offset += (slope + change * 0.5) * du;
        slope += change;
        raw[i] = offset;
        prev = u;
      }
    }
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const px = raw[i]! * 10 * roadHalfFraction(t) * w;
      const limit = w * 0.55;
      this.offsets[i] = limit * Math.tanh(px / limit);
    }
  }

  /** Screen x of the road centre at screen depth `t`. */
  private road(t: number): number {
    const w = this.canvas.width;
    const f = clamp(t, 0, 1) * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(f));
    const k = f - i;
    const o = this.offsets[i]! * (1 - k) + this.offsets[i + 1]! * k;
    return w * 0.5 + o - this.cameraOffset * (roadHalfFraction(clamp(t, 0, 1)) / roadHalfFraction(PLAYER_T));
  }

  // -------------------------------------------------------------------------
  // Drawing primitives
  // -------------------------------------------------------------------------

  /** Pixel-aligned filled rectangle. */
  private rect(x: number, y: number, ww: number, hh: number, color: string): void {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.ceil(ww), Math.ceil(hh));
  }

  /** Trapezoid between two horizontal edges given by centre x, y and half width. */
  private quad(x1: number, y1: number, hw1: number, x2: number, y2: number, hw2: number, color: string): void {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x1 - hw1, y1);
    c.lineTo(x1 + hw1, y1);
    c.lineTo(x2 + hw2, y2);
    c.lineTo(x2 - hw2, y2);
    c.closePath();
    c.fill();
  }

  // -------------------------------------------------------------------------
  // Sky
  // -------------------------------------------------------------------------

  /** Sky, sun, stars, clouds, ridges and city, each panning at its own rate as the heading changes. */
  private paintSky(f: FrameContext): void {
    const c = this.ctx;
    const { w, horizon, env, palette, bendNow } = f;
    this.paintSkyBands(f);
    this.paintStars(f);
    const altitude = SUN_ALTITUDE[env.from] * (1 - env.mix) + SUN_ALTITUDE[env.to] * env.mix;
    const size = SUN_SIZE[env.from] * (1 - env.mix) + SUN_SIZE[env.to] * env.mix;
    drawSun(c, w, horizon, w * 0.68 - bendNow * 14, altitude * horizon, palette.sun, size);
    c.globalAlpha = 1 - env.night * 0.7;
    drawClouds(c, w, horizon, f.clock);
    c.globalAlpha = 1;
    drawMountains(c, w, horizon, this.heading, palette.farRidge, palette.nearRidge);
    c.globalAlpha = 0.9;
    drawSkyline(c, w, horizon, env.night, -bendNow * 26 - this.cameraOffset * 0.1);
    c.globalAlpha = 1;
    this.paintHorizonHaze(f);
    this.rect(-SCREEN_BLEED, horizon + 2, w + SCREEN_BLEED * 2, f.roadH + SCREEN_BLEED, palette.grassA);
  }

  private paintSkyBands(f: FrameContext): void {
    const { w, horizon, palette } = f;
    for (let i = 0; i < SKY_BANDS; i++) {
      const bleed = i ? 0 : SCREEN_BLEED;
      const color = blendColor(palette.skyTop, palette.haze, (i / (SKY_BANDS - 1)) ** 1.5);
      this.rect(-SCREEN_BLEED, (i * horizon) / SKY_BANDS - bleed, w + 40, horizon / SKY_BANDS + 1 + bleed, color);
    }
  }

  private paintStars(f: FrameContext): void {
    const { w, horizon, env } = f;
    if (env.night <= 0.3) return;
    const c = this.ctx;
    c.globalAlpha = env.night;
    for (let i = 0; i < STAR_COUNT; i++) {
      const size = 1 + (i % 5 === 0 ? 1 : 0);
      this.rect((i * 137) % w, (i * 31) % (horizon * 0.55), size, size, NIGHT_STAR_COLOR);
    }
    c.globalAlpha = 1;
  }

  private paintHorizonHaze(f: FrameContext): void {
    const c = this.ctx;
    const { w, horizon, palette } = f;
    const haze = c.createLinearGradient(0, horizon * 0.55, 0, horizon + 4);
    haze.addColorStop(0, `${palette.haze}00`);
    haze.addColorStop(1, `${palette.haze}b0`);
    c.fillStyle = haze;
    c.fillRect(-SCREEN_BLEED, horizon * 0.55, w + 40, horizon * 0.45 + 4);
  }

  // -------------------------------------------------------------------------
  // Ground
  // -------------------------------------------------------------------------

  /** Ground, kerbs, asphalt and lane markings are painted from the horizon to the camera, row by row. */
  private paintRoadRows(f: FrameContext): void {
    const wet = f.env.rain;
    const asphalt: readonly [string, string] = [blendColor('#50545f', '#4f6176', wet), blendColor('#484c57', '#475a70', wet)];
    for (let y = f.horizon + 2; y < f.h; y += ROW_HEIGHT) this.paintRoadRow(f, y, asphalt);
  }

  private paintRoadRow(f: FrameContext, y: number, asphalt: readonly [string, string]): void {
    const { w, h, horizon, roadH, path, palette } = f;
    const t = (y - horizon) / roadH;
    const center = this.road(t);
    const half = w * roadHalfFraction(t);
    const world = path + screenToDepth(t) * PATH_UNIT;
    const far = t < FAR_ROW_LIMIT;
    const band = far ? 0 : Math.floor(world / 7) % 2;
    const kerb = Math.floor(world / 4) % 2;
    this.rect(-SCREEN_BLEED, y, w + 40, y > h - 3 ? 22 : ROW_HEIGHT, band ? palette.grassA : palette.grassB);
    const edge = 1 + w * 0.022 * t;
    this.rect(center - half - edge, y, (half + edge) * 2, ROW_HEIGHT, far ? '#c9d0d9' : kerb ? '#e8ecef' : '#d9473f');
    this.rect(center - half, y, half * 2, ROW_HEIGHT, asphalt[band]!);
    const line = Math.max(1, w * 0.0045 * t);
    this.rect(center - half * 0.93, y, line, ROW_HEIGHT, '#dfe3ea');
    this.rect(center + half * 0.93 - line, y, line, ROW_HEIGHT, '#dfe3ea');
    if (!far && world % 12 < 6) {
      for (const divider of LANE_DIVIDERS) this.rect(center + divider * half - line * 0.5, y, line, ROW_HEIGHT, '#f0f0e2');
    }
    if (t > 0.18) this.paintWheelTracks(center, half, y, line);
  }

  /** Darker wheel tracks in each lane add depth to the otherwise flat asphalt. */
  private paintWheelTracks(center: number, half: number, y: number, line: number): void {
    for (const lane of LANES) {
      const laneX = center + laneCenter(lane) * half;
      this.rect(laneX - half * LANE_WIDTH * 0.24, y, line, ROW_HEIGHT, '#00000014');
      this.rect(laneX + half * LANE_WIDTH * 0.24, y, line, ROW_HEIGHT, '#00000014');
    }
  }

  private paintGuardRail(f: FrameContext): void {
    for (const side of [-1, 1]) {
      this.paintRailBand(f, side);
      this.paintRailPosts(f, side);
    }
  }

  private paintRailBand(f: FrameContext, side: number): void {
    const { w, horizon, roadH } = f;
    for (let i = 1; i < SAMPLES; i++) {
      const t1 = i / SAMPLES;
      const t2 = (i + 1) / SAMPLES;
      const half1 = w * roadHalfFraction(t1);
      const half2 = w * roadHalfFraction(t2);
      const x1 = this.road(t1) + side * half1 * WALL;
      const x2 = this.road(t2) + side * half2 * WALL;
      const y1 = horizon + t1 * roadH - w * 0.026 * t1;
      const y2 = horizon + t2 * roadH - w * 0.026 * t2;
      this.quad(x1, y1, Math.max(0.6, w * 0.003 * t1), x2, y2, Math.max(0.6, w * 0.003 * t2), '#b8c4cc');
    }
  }

  private paintRailPosts(f: FrameContext, side: number): void {
    const { w, horizon, roadH, scroll } = f;
    const spacing = 0.025;
    for (let k = Math.ceil(scroll / spacing); k <= (scroll + 1) / spacing; k++) {
      const t = depthToScreen(k * spacing - scroll);
      if (t < 0.035 || t > 1) continue;
      const x = this.road(t) + side * w * roadHalfFraction(t) * WALL;
      const y = horizon + t * roadH;
      this.rect(x - w * 0.002 * t, y - w * 0.026 * t, w * 0.004 * t, w * 0.026 * t, '#647382');
    }
  }

  private paintDistanceFog(f: FrameContext): void {
    const c = this.ctx;
    const { w, horizon, roadH, palette } = f;
    c.globalAlpha = 0.55;
    const fog = c.createLinearGradient(0, horizon, 0, horizon + roadH * 0.45);
    fog.addColorStop(0, palette.haze);
    fog.addColorStop(1, `${palette.haze}00`);
    c.fillStyle = fog;
    c.fillRect(-SCREEN_BLEED, horizon + 2, w + 40, roadH * 0.45);
    c.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Roadside scenery, traffic and pickups
  // -------------------------------------------------------------------------

  /** Everything standing on the ground shares one depth list so it overlaps correctly. */
  private paintGroundObjects(f: FrameContext): void {
    const drawables = [
      ...this.sceneryDrawables(f),
      ...this.vehicleDrawables(f),
      { t: PLAYER_T, draw: () => this.paintPlayer(f) },
    ];
    drawables.sort((a, b) => a.t - b.t);
    for (const drawable of drawables) drawable.draw();
  }

  private sceneryDrawables(f: FrameContext): Drawable[] {
    const { scroll } = f;
    const spacing = 12 / PATH_UNIT;
    const kmin = Math.ceil((scroll - 0.09) / spacing);
    const kmax = Math.floor((scroll + 1.02) / spacing);
    const drawables: Drawable[] = [];
    for (let k = kmin; k <= kmax; k++) {
      const t = depthToScreen(k * spacing - scroll);
      if (t < 0.03 || t > 1.12) continue;
      drawables.push({ t, draw: () => this.paintRoadsideProp(f, k, t) });
    }
    return drawables;
  }

  /** One billboard, lamp, bush or tree, chosen by the marker index so the layout is deterministic. */
  private paintRoadsideProp(f: FrameContext, k: number, t: number): void {
    const c = this.ctx;
    const { w, horizon, roadH, env } = f;
    const side = k % 2 ? 1 : -1;
    const sample = Math.abs(k);
    const half = w * roadHalfFraction(t);
    const y = horizon + t * roadH;
    const s = ((0.11 + t * 1.08) * w) / 480;
    const edge = this.road(t) + side * half * WALL;
    if (sample % 19 === 7) drawBillboard(c, edge + side * (half * 0.2 + w * 0.025 * t), y, s * 1.1, Math.floor(sample / 19));
    else if (sample % 14 === 0) drawLamp(c, edge + side * half * 0.05, y, s, side, env.night);
    else if (sample % 7 === 3) drawBush(c, edge + side * (w * 0.012 + half * 0.1), y, s, sample % 2 === 0);
    else drawTree(c, edge + side * (w * 0.03 + w * 0.1 * t + hash(sample) * half * 0.28), y, s * (0.88 + hash(sample + 9) * 0.3));
  }

  private vehicleDrawables(f: FrameContext): Drawable[] {
    const vehicles: readonly SceneVehicle[] = f.preview ? PREVIEW_TRAFFIC : f.race.entities;
    const drawables: Drawable[] = [];
    for (const vehicle of vehicles) {
      const t = depthToScreen(vehicle.z);
      if (t < 0 || t > 1.3) continue;
      drawables.push({
        t,
        draw: () => {
          if (isFuel(vehicle)) this.paintFuelPickup(f, vehicle, t);
          else this.paintTraffic(f, vehicle, t);
        },
      });
    }
    return drawables;
  }

  /** Screen position and sprite scale of a vehicle at screen depth `t`. */
  private placeVehicle(f: FrameContext, lane: number, t: number): { x: number; y: number; s: number } {
    const half = f.w * roadHalfFraction(t);
    return {
      x: this.road(t) + laneCenter(lane) * half,
      y: f.horizon + t * f.roadH,
      s: ((0.08 + t) * f.sceneScale * VEHICLE_SCALE) / 0.93,
    };
  }

  private paintTraffic(f: FrameContext, vehicle: Exclude<SceneVehicle, FuelEntity>, t: number): void {
    const c = this.ctx;
    const { x, y, s } = this.placeVehicle(f, vehicle.lane, t);
    // Cars lean into the bend ahead of them and into any lane change in progress.
    const bend = roadBend(f.path + vehicle.z * PATH_UNIT, f.race.roadSeed) * 0.65;
    const laneChange = (targetLaneOf(vehicle) - vehicle.lane) * 0.6;
    this.rect(x - 45 * s, y - 2 * s, 90 * s, 6 * s, '#17212f66');
    drawCar(c, x, y, s, vehicle.car, false, clamp(bend + laneChange, -1, 1));
    if (f.env.night > 0.2) {
      c.globalAlpha = f.env.night * 0.25;
      this.rect(x - 35 * s, y + 2 * s, 14 * s, 8 * s, '#f37a86');
      this.rect(x + 21 * s, y + 2 * s, 14 * s, 8 * s, '#f37a86');
      c.globalAlpha = 1;
    }
  }

  private paintFuelPickup(f: FrameContext, pickup: FuelEntity, t: number): void {
    const c = this.ctx;
    const { x, y, s } = this.placeVehicle(f, pickup.lane, t);
    const bob = Math.sin(f.clock * 5 + pickup.lane) * 2 * s;
    c.globalAlpha = 0.35 + 0.15 * Math.sin(f.clock * 6);
    c.fillStyle = '#ffc96b';
    c.beginPath();
    c.ellipse(x, y - 18 * s + bob, 30 * s, 32 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    for (const [dx, dy, width, height, color] of FUEL_PUMP_BLOCKS) {
      this.rect(x + dx * s, y + dy * s + bob, width * s, height * s, color);
    }
  }

  // -------------------------------------------------------------------------
  // Player
  // -------------------------------------------------------------------------

  private paintPlayer(f: FrameContext): void {
    const c = this.ctx;
    const { race, env, roadH, horizon, path, fast, sceneScale, speed } = f;
    const bob = Math.sin(path * 1.4) * fast * 1.6 * sceneScale;
    const playerY = horizon + PLAYER_T * roadH + bob;
    const playerX = this.road(PLAYER_T) + f.wanted;
    const scale = sceneScale * VEHICLE_SCALE;
    this.rect(playerX - 49 * scale, playerY - 3, 98 * scale, 8 * scale, '#151d2f77');
    if (env.night > 0.1) {
      c.globalAlpha = env.night * 0.13;
      this.quad(playerX, playerY - 55 * scale, 32 * scale, playerX, playerY - 190 * scale, 92 * scale, '#eee0af');
      c.globalAlpha = 1;
    }
    this.paintOffroadDust(f, playerX, playerY, scale);
    if (race.invincible <= 0 || Math.floor(f.clock * 12) % 2 === 0) {
      drawCar(c, playerX, playerY, scale, race.car, f.input.brake, race.steer * clamp(speed / 35, 0, 1));
    }
  }

  /** Dust and grass clods thrown by the tyres whenever the car leaves the asphalt. */
  private paintOffroadDust(f: FrameContext, playerX: number, playerY: number, scale: number): void {
    if (!f.race.offroad || f.speed <= 25) return;
    const c = this.ctx;
    for (let i = 0; i < 22; i++) {
      const age = (f.clock * 3.2 + i * 0.137) % 1;
      const side = i % 2 ? 1 : -1;
      const px = playerX + side * (30 + hash(i) * 22) * scale + (hash(i + 5) - 0.5) * age * 60 * scale;
      const py = playerY - age * (14 + hash(i + 2) * 30) * scale;
      c.globalAlpha = (1 - age) * 0.75;
      this.rect(
        px,
        py,
        (3 + hash(i + 8) * 4) * scale * (1 + age),
        (3 + hash(i + 8) * 3) * scale * (1 + age),
        i % 3 ? '#8a6b46' : f.palette.grassA,
      );
      c.globalAlpha = 1;
    }
  }

  // -------------------------------------------------------------------------
  // Weather and speed effects
  // -------------------------------------------------------------------------

  private paintWeather(f: FrameContext): void {
    if (f.env.rain > 0) this.paintRain(f);
    if (f.env.fog > 0) this.paintFog(f);
  }

  private paintRain(f: FrameContext): void {
    const c = this.ctx;
    const { w, h, clock, env } = f;
    c.globalAlpha = env.rain * 0.5;
    c.strokeStyle = '#c2d1e2';
    c.lineWidth = 1;
    for (let i = 0; i < 65; i++) {
      const x = (((i * 97 - clock * 120) % w) + w) % w;
      const y = (i * 83 + clock * 400) % h;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 4, y + 13);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  private paintFog(f: FrameContext): void {
    const c = this.ctx;
    const { w, h, horizon, env } = f;
    c.globalAlpha = env.fog;
    const tint = blendColor('#bdc9db', '#617393', env.night);
    const fog = c.createLinearGradient(0, 0, 0, h);
    fog.addColorStop(0, `${tint}65`);
    fog.addColorStop(Math.max(0.01, (horizon - 55) / h), `${tint}d0`);
    fog.addColorStop(horizon / h, `${tint}ed`);
    fog.addColorStop(0.64, `${tint}70`);
    fog.addColorStop(1, `${tint}00`);
    c.fillStyle = fog;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
  }

  /** Speed streaks radiate from the vanishing point; they only show once you are really moving. */
  private paintSpeedStreaks(f: FrameContext): void {
    const { w, h, fast, path, horizon, roadH, env } = f;
    if (fast <= 0.05) return;
    const c = this.ctx;
    c.lineWidth = Math.max(1, w / 480);
    const vx = this.road(0);
    const vy = horizon + roadH * 0.06;
    for (let i = 0; i < Math.round(26 + Math.max(0, fast - 1) * 18); i++) {
      const angle = (hash(i + 3) - 0.5) * Math.PI * 0.95 + Math.PI / 2;
      const phase = (path / 35 + hash(i)) % 1;
      const r0 = 0.12 + phase ** 2 * 0.9;
      const r1 = r0 + 0.04 + fast * 0.2 * phase;
      const reach = Math.max(w, h) * 1.1;
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      if (cy < 0.15) continue;
      c.globalAlpha = Math.min(0.8, fast * 0.5) * Math.min(1, phase * 3) * (1 - phase * 0.3);
      c.strokeStyle = env.night > 0.5 ? '#c8d8ff' : '#ffffff';
      c.beginPath();
      c.moveTo(vx + cx * reach * r0, vy + cy * reach * r0);
      c.lineTo(vx + cx * reach * r1, vy + cy * reach * r1);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Screen overlays
  // -------------------------------------------------------------------------

  /** Vignette tightens with speed, dust tints the screen off-road, and a red flash marks every impact. */
  private paintOverlays(f: FrameContext): void {
    const c = this.ctx;
    const { w, h, fast } = f;
    const edgeShade = c.createRadialGradient(w / 2, h * 0.6, h * 0.35, w / 2, h * 0.6, Math.max(w, h) * 0.75);
    edgeShade.addColorStop(0, '#00000000');
    edgeShade.addColorStop(1, `rgba(4,8,24,${Math.min(0.82, 0.2 + fast * 0.3)})`);
    c.fillStyle = edgeShade;
    c.fillRect(0, 0, w, h);
    if (f.race.offroad && f.speed > 25) {
      c.fillStyle = 'rgba(120,80,30,.12)';
      c.fillRect(0, 0, w, h);
    }
    if (this.flash > 0) {
      c.fillStyle = `rgba(255,60,80,${this.flash * 0.4})`;
      c.fillRect(0, 0, w, h);
    }
  }
}
