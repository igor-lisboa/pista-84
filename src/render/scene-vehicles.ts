import {PATH_UNIT, PLAYER_T, VEHICLE_SCALE, clamp, depthToScreen, laneCenter, roadBend} from '../game/index.ts';
import type {CarLook, Entity, FuelEntity} from '../game/index.ts';
import {hash} from './noise.ts';
import {drawCar} from './sprites.ts';
import {paintVehicleGround, paintVehicleHeadlights} from './vehicle-ground.ts';
import {pixelRect} from './scene-primitives.ts';
import {roadHalfFraction} from './scene-frame.ts';
import type {Drawable, FrameContext} from './scene-frame.ts';

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

/** Draws vehicles and pickups using one shared road projection. */
export class SceneVehicles {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly road: (depth: number) => number;

  constructor(ctx: CanvasRenderingContext2D, road: (depth: number) => number) {
    this.ctx = ctx;
    this.road = road;
  }

  drawables(f: FrameContext): Drawable[] {
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
    const turn = clamp(bend + laneChange, -1, 1);
    paintVehicleGround(c, x, y, s, vehicle.car, turn, f.env.night, f.env.rain);
    drawCar(c, x, y, s, vehicle.car, false, turn);
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
      pixelRect(this.ctx, x + dx * s, y + dy * s + bob, width * s, height * s, color);
    }
  }
  
  // -------------------------------------------------------------------------
  // Player
  // -------------------------------------------------------------------------
  
  paintPlayer(f: FrameContext): void {
    const c = this.ctx;
    const { race, env, roadH, horizon, path, fast, sceneScale, speed } = f;
    const bob = Math.sin(path * 1.4) * fast * 1.6 * sceneScale;
    const playerY = horizon + PLAYER_T * roadH + bob;
    const playerX = this.road(PLAYER_T) + f.wanted;
    const scale = sceneScale * VEHICLE_SCALE;
    const turn = race.steer * clamp(speed / 35, 0, 1);
    paintVehicleGround(c, playerX, playerY, scale, race.car, turn, env.night, env.rain, f.input.brake);
    paintVehicleHeadlights(c, playerX, playerY, scale, race.car, turn, env.night);
    this.paintOffroadDust(f, playerX, playerY, scale);
    if (race.invincible <= 0 || Math.floor(f.clock * 12) % 2 === 0) {
      drawCar(c, playerX, playerY, scale, race.car, f.input.brake, turn);
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
      pixelRect(this.ctx, 
        px,
        py,
        (3 + hash(i + 8) * 4) * scale * (1 + age),
        (3 + hash(i + 8) * 3) * scale * (1 + age),
        i % 3 ? '#8a6b46' : f.palette.grassA,
      );
      c.globalAlpha = 1;
    }
  }
}
