import { CARS, type CarSpec } from './cars.ts';
import { environment } from './environment.ts';
import { clamp } from './math.ts';
import {
  CHECKPOINT,
  EDGE,
  LANES,
  LANE_COUNT,
  PATH_UNIT,
  PLAYER_DEPTH,
  VEHICLE_SCALE,
  WALL,
  laneCenter,
  roadBend,
} from './road.ts';
import { POINTS_PER_COIN, paceMultiplier } from './scoring.ts';
import {
  MAX_TRAFFIC,
  SPAWN_PROBE_SPEED,
  TRAFFIC_SPAWN_Z,
  approachCruise,
  createFuel,
  createTraffic,
  findLeader,
  followLeader,
  isLaneClear,
  lanePosition,
  pickWaveLanes,
  separateTraffic,
  steerTraffic,
  trafficIntensity,
  trafficOf,
  type Entity,
  type Random,
} from './traffic.ts';

export type RaceStatus = 'ready' | 'running' | 'paused' | 'over';
/** Why a run ended; `traffic` and `wall` are crashes. */
export type EndReason = 'fuel' | 'traffic' | 'wall';
export type RaceEvent = 'fuel' | 'checkpoint' | 'hit' | 'crash' | 'offroad';

export interface DriveInput {
  /** -1 (full left) .. 1 (full right). */
  steer?: number;
  accelerate?: boolean;
  brake?: boolean;
}

/** Speed the car is dragged down to on the grass, in km/h. */
export const OFFROAD_LIMIT = 40;

const MAX_STEP_SECONDS = 0.05;
const ACCELERATION_GAIN = 2.2;
const BRAKE_DECELERATION = 110;
const OFFROAD_TRACTION = 0.1;
/** Exponential drag rate on the grass: the car sheds most excess speed in about half a second. */
const OFFROAD_DRAG = 5.5;
const STEER_RESPONSE = 22;
const BARRIER_BOUNCE = 0.16;
const CHECKPOINT_FUEL = 15;
const FUEL_PICKUP = 32;
const IDLE_FUEL_BURN = 0.04;
const DRIVING_FUEL_BURN = 0.45;
const DRIVING_FUEL_SPEED = 40;
const SECOND_CHANCE_SPEED = 90;
const SECOND_CHANCE_FUEL = 45;
const SECOND_CHANCE_INVINCIBLE = 3;
const PICKUP_DEPTH_WINDOW = 0.018;

export class Race {
  car: CarSpec;
  readonly random: Random;

  status: RaceStatus = 'ready';
  roadSeed = 0;
  /** Lateral position: -1 .. 1 across the asphalt, beyond ±EDGE is grass. */
  x = 0;
  /** Speed in km/h. */
  speed = 0;
  /** 0..100. */
  fuel = 100;
  /** Metres driven. */
  distance = 0;
  /** Metres along the road, used to sample curves (equals distance). */
  path = 0;
  time = 0;
  entities: Entity[] = [];
  coins = 0;
  score = 0;
  /** Seconds and metres since the last checkpoint; drive the pace multiplier. */
  kmTime = 0;
  kmMetres = 0;
  checkpoints = 0;
  endReason: EndReason | null = null;
  crashSpeed = 0;
  crashes = 0;
  continued = false;
  invincible = 0;
  offroad = false;
  drift = 0;
  steer = 0;
  /** -1 / 1 on the frame the car touched the left / right barrier, else 0. */
  wall = 0;
  events: RaceEvent[] = [];
  /** Seconds until the next traffic wave / fuel can. */
  trafficTimer = 1.6;
  fuelTimer = 4;

  constructor(car: CarSpec = CARS[0]!, random: Random = Math.random) {
    this.car = car;
    this.random = random;
    this.reset();
  }

  get crashed(): boolean {
    return this.endReason === 'traffic' || this.endReason === 'wall';
  }

  reset(): void {
    this.status = 'ready';
    this.roadSeed = Math.floor(this.random() * 4294967296) >>> 0;
    this.x = 0;
    this.speed = 0;
    this.fuel = 100;
    this.distance = 0;
    this.path = 0;
    this.time = 0;
    this.entities = [];
    this.coins = 0;
    this.score = 0;
    this.kmTime = 0;
    this.kmMetres = 0;
    this.checkpoints = 0;
    this.endReason = null;
    this.crashSpeed = 0;
    this.crashes = 0;
    this.continued = false;
    this.invincible = 0;
    this.offroad = false;
    this.drift = 0;
    this.steer = 0;
    this.wall = 0;
    this.events = [];
    this.trafficTimer = 1.6;
    this.fuelTimer = 4;
  }

  start(): void {
    this.reset();
    this.status = 'running';
  }

  finish(reason: EndReason): void {
    this.status = 'over';
    this.endReason = reason;
  }

  /** The single free second chance: refuel a little, clear the road, brief invincibility. */
  resume(): boolean {
    if (this.status !== 'over' || this.continued) return false;
    this.continued = true;
    this.status = 'running';
    this.endReason = null;
    this.fuel = Math.max(SECOND_CHANCE_FUEL, this.fuel);
    this.speed = SECOND_CHANCE_SPEED;
    this.entities = [];
    this.x = clamp(this.x, -0.6, 0.6);
    this.offroad = false;
    this.invincible = SECOND_CHANCE_INVINCIBLE;
    return true;
  }

  /** Any contact with traffic or the barrier ends the run. */
  crash(kind: 'traffic' | 'wall'): void {
    if (this.invincible > 0) return;
    this.crashes++;
    this.crashSpeed = this.speed;
    this.events.push('hit', 'crash');
    this.speed = 0;
    this.finish(kind);
  }

  update(rawDt: number, input: DriveInput = {}): void {
    this.events = [];
    if (this.status !== 'running') return;

    const dt = clamp(rawDt, 0, MAX_STEP_SECONDS);
    this.time += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    const intensity = trafficIntensity(this.time);

    this.drive(dt, input);
    if (!this.keepOnRoad(dt)) return;
    const advance = this.advance(dt);
    if (!this.burnFuel(dt)) return;

    this.spawnEntities(dt, intensity);
    this.updateEntities(dt, advance, intensity);
    separateTraffic(this.entities);
    this.entities = this.entities.filter((e) => e.z > -0.15 && e.z < 1.5 && !(e.type === 'fuel' && e.collected));
  }

  /** Throttle, coasting, braking, steering and curve drift. */
  private drive(dt: number, input: DriveInput): void {
    // Accelerator, coast and brake are distinct. Automatic gearing gives strong
    // low-speed pull and less acceleration near the vehicle's top speed.
    this.offroad = Math.abs(this.x) > EDGE;
    const speedRatio = clamp(this.speed / this.car.max, 0, 1);
    const traction = this.offroad ? OFFROAD_TRACTION : 1;
    const acceleration = this.car.accel * ACCELERATION_GAIN * (1 - 0.45 * speedRatio) * traction;
    const coast = -(12 + this.speed * 0.025);
    const force = input.brake ? -BRAKE_DECELERATION : input.accelerate ? acceleration : coast;
    this.speed = clamp(this.speed + force * dt, 0, this.car.max);

    const grip = 1 - environment(this.time).rain * (this.car.shape === 'bike' ? 0.22 : 0.1);
    const rolling = clamp(this.speed / 90, 0, 1);
    // Corners need attention at ordinary highway speeds and braking at extreme speeds.
    const load = clamp((this.speed / 120) ** 2, 0, 6);
    this.steer += (clamp(input.steer ?? 0, -1, 1) - this.steer) * (1 - Math.exp(-dt * STEER_RESPONSE));
    this.drift =
      (roadBend(this.path + PATH_UNIT * PLAYER_DEPTH, this.roadSeed) * load * 0.9 * VEHICLE_SCALE) /
      Math.sqrt(this.car.handling) /
      grip;
    const authority = (1.35 - 0.25 * speedRatio) * rolling * this.car.handling * grip * VEHICLE_SCALE;
    this.x += (this.steer * authority - this.drift) * dt;
  }

  /** Grass slows the car to a crawl; the barrier ends the run. Returns false if the run ended. */
  private keepOnRoad(dt: number): boolean {
    const wasOffroad = this.offroad;
    this.offroad = Math.abs(this.x) > EDGE;
    if (this.offroad && !wasOffroad) this.events.push('offroad');
    if (this.offroad && this.speed > OFFROAD_LIMIT) {
      // Ease toward the limit instead of snapping: a violent but smooth deceleration.
      this.speed = OFFROAD_LIMIT + (this.speed - OFFROAD_LIMIT) * Math.exp(-OFFROAD_DRAG * dt);
    }
    this.wall = 0;
    if (Math.abs(this.x) >= WALL) {
      this.wall = Math.sign(this.x);
      this.x = this.wall * (WALL - BARRIER_BOUNCE);
      this.crash('wall');
    }
    return this.status === 'running';
  }

  /** Moves the car along the road, banks score and coins, handles checkpoints. Returns metres advanced. */
  private advance(dt: number): number {
    const before = this.distance;
    const metres = (this.speed / 3.6) * dt;
    this.distance += metres;
    this.path += metres;
    this.kmTime += dt;
    this.kmMetres += metres;
    this.score += metres * paceMultiplier(this.kmMetres, this.kmTime);
    this.coins = Math.floor(this.score / POINTS_PER_COIN);

    if (Math.floor(this.distance / CHECKPOINT) > Math.floor(before / CHECKPOINT)) {
      this.checkpoints = Math.floor(this.distance / CHECKPOINT);
      this.fuel = Math.min(100, this.fuel + CHECKPOINT_FUEL);
      this.events.push('checkpoint');
      this.kmTime = 0;
      this.kmMetres = 0;
    }
    return metres;
  }

  /** Returns false when the tank ran dry. */
  private burnFuel(dt: number): boolean {
    // The engine keeps sipping at rest; smoothly reach the existing driving rate by 40 km/h.
    const baseBurn = IDLE_FUEL_BURN + (DRIVING_FUEL_BURN - IDLE_FUEL_BURN) * clamp(this.speed / DRIVING_FUEL_SPEED, 0, 1);
    this.fuel = Math.max(0, this.fuel - dt * this.car.consumption * (baseBurn + this.speed / 190));
    if (this.fuel > 0) return true;
    this.finish('fuel');
    return false;
  }

  private spawnEntities(dt: number, intensity: number): void {
    this.trafficTimer -= dt;
    this.fuelTimer -= dt;

    if (this.trafficTimer <= 0) {
      const lanes = pickWaveLanes(intensity, this.random);
      if (trafficOf(this.entities).length < MAX_TRAFFIC) {
        for (const lane of lanes) {
          if (!isLaneClear(this.entities, lane, TRAFFIC_SPAWN_Z, SPAWN_PROBE_SPEED)) continue;
          this.entities.push(createTraffic(lane, this.car, intensity, this.random));
        }
      }
      this.trafficTimer = 1.5 - intensity * 0.95 + this.random() * 0.3;
    }

    if (this.fuelTimer <= 0) {
      this.entities.push(createFuel(LANES[Math.floor(this.random() * LANE_COUNT)]!));
      this.fuelTimer = 7 + this.random() * 3;
    }
  }

  private updateEntities(dt: number, playerAdvance: number, intensity: number): void {
    const steering = { entities: this.entities, playerLane: lanePosition(this.x), random: this.random };
    for (const entity of this.entities) {
      let ownAdvance = 0;
      if (entity.type === 'traffic') {
        approachCruise(entity, this.car, intensity, dt);
        const leader = findLeader(this.entities, entity);
        steerTraffic(entity, dt, leader, steering);
        followLeader(entity, leader, dt);
        ownAdvance = (entity.speed / 3.6) * dt;
      }
      const previousZ = entity.z;
      entity.z += (ownAdvance - playerAdvance) / PATH_UNIT;
      this.checkContact(entity, previousZ);
    }
  }

  /** Pickups and collisions happen when an entity sweeps through the player's plane. */
  private checkContact(entity: Entity, previousZ: number): void {
    const crossed =
      Math.min(previousZ, entity.z) <= PLAYER_DEPTH + PICKUP_DEPTH_WINDOW &&
      Math.max(previousZ, entity.z) >= PLAYER_DEPTH - PICKUP_DEPTH_WINDOW;
    if (entity.passed || !crossed) return;

    const reach = (this.car.shape === 'bike' ? 0.19 : 0.27) * VEHICLE_SCALE;
    if (Math.abs(this.x - laneCenter(entity.lane)) >= reach) return;

    entity.passed = true;
    if (entity.type === 'fuel') {
      this.fuel = Math.min(100, this.fuel + FUEL_PICKUP);
      entity.collected = true;
      this.events.push('fuel');
    } else {
      this.crash('traffic');
    }
  }
}
