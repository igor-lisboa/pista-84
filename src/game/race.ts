import { CARS, type CarSpec } from './cars.ts';
import { environment, rollConditions, type Conditions, type Environment } from './environment.ts';
import { clamp } from './math.ts';
import { vehicleAcceleration, vehicleTuning } from './vehicle-tuning.ts';
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
  maxTraffic,
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
  trafficPressure,
  trafficOf,
  type Entity,
  type Random,
} from './traffic.ts';

export type RaceStatus = 'ready' | 'running' | 'paused' | 'over';
/** Why a run ended; `traffic` and `wall` are crashes. */
export type EndReason = 'fuel' | 'traffic' | 'wall';
/** `fuelPenalty` fires when a grass excursion is actually charged (not during its cooldown). */
export type RaceEvent = 'fuel' | 'fuelPenalty' | 'checkpoint' | 'hit' | 'crash' | 'offroad';

export interface DriveInput {
  /** -1 (full left) .. 1 (full right). */
  steer?: number;
  accelerate?: boolean;
  brake?: boolean;
}

/** Speed the car is dragged down to on the grass, in km/h. */
export const OFFROAD_LIMIT = 40;

const MAX_STEP_SECONDS = 0.05;
export const SECOND_CHANCE_PRICE = 1000;
const OFFROAD_TRACTION = 0.1;
/** Exponential drag rate on the grass: the car sheds most excess speed in about half a second. */
const OFFROAD_DRAG = 5.5;
/** Fuel (percent of a tank) lost the moment the car drops onto the grass. */
export const OFFROAD_ENTRY_FUEL = 15;
/** Extra fuel (percent of a tank per second) burnt while churning through the grass. */
export const OFFROAD_FUEL_BURN = 3;
/** Score multiplier factor removed per grass excursion, until the next checkpoint. */
export const OFFROAD_SCORE_PENALTY = 0.25;
/** The grass penalty never cuts the multiplier below this factor. */
export const MIN_SCORE_FACTOR = 0.25;
/** Seconds after a grass penalty during which re-entering the grass is not charged again. */
const OFFROAD_PENALTY_COOLDOWN = 1.5;
const STEER_RESPONSE = 22;
const BARRIER_BOUNCE = 0.16;
/** Fuel (percent of a tank) restored at every checkpoint. */
export const CHECKPOINT_FUEL = 4;
/** Fuel (percent of a tank) a fuel can on the road restores. */
export const FUEL_PICKUP = 12;
const IDLE_FUEL_BURN = 0.04;
const DRIVING_FUEL_BURN = 0.45;
const DRIVING_FUEL_SPEED = 40;
/** Higher divisor = the speed-dependent part of the burn grows more slowly. */
const SPEED_FUEL_DIVISOR = 300;
const SECOND_CHANCE_SPEED = 90;
const SECOND_CHANCE_FUEL = 45;
const SECOND_CHANCE_INVINCIBLE = 3;
const PICKUP_DEPTH_WINDOW = 0.018;
const FIRST_TRAFFIC_DELAY = 0.6;
const FIRST_FUEL_DELAY = 8;
/** Cars placed ahead of the player when a run starts, within this depth band. */
const OPENING_TRAFFIC = 3;
const OPENING_TRAFFIC_MIN_Z = 0.4;
const OPENING_TRAFFIC_MAX_Z = 0.9;

/** Supplies the player's local time; injectable so tests do not depend on when they run. */
export type Clock = () => Date;

export class Race {
  car: CarSpec;
  readonly random: Random;
  readonly clock: Clock;
  /** Time of day the run starts at and its weather plan. */
  conditions!: Conditions;

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
  /** Grass penalty on the score multiplier for the current kilometre: 1 is clean. */
  scoreFactor = 1;
  /** Seconds until another grass excursion is penalised. */
  offroadCooldown = 0;
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
  trafficTimer = FIRST_TRAFFIC_DELAY;
  fuelTimer = FIRST_FUEL_DELAY;

  constructor(car: CarSpec = CARS[0]!, random: Random = Math.random, clock: Clock = () => new Date()) {
    this.car = car;
    this.random = random;
    this.clock = clock;
    this.reset();
  }

  /** Lighting and weather right now in this run. */
  get environment(): Environment {
    return environment(this.time, this.conditions);
  }

  /** Score multiplier in effect: kilometre pace, cut by any grass excursions since the last checkpoint. */
  get multiplier(): number {
    return paceMultiplier(this.kmMetres, this.kmTime) * this.scoreFactor;
  }

  get crashed(): boolean {
    return this.endReason === 'traffic' || this.endReason === 'wall';
  }

  reset(): void {
    this.status = 'ready';
    this.roadSeed = Math.floor(this.random() * 4294967296) >>> 0;
    this.conditions = rollConditions(this.clock(), this.random);
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
    this.scoreFactor = 1;
    this.offroadCooldown = 0;
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
    this.trafficTimer = FIRST_TRAFFIC_DELAY;
    this.fuelTimer = FIRST_FUEL_DELAY;
  }

  start(): void {
    // Keep the weather the menu preview was showing, but read the clock again for the light.
    const previewWeather = this.status === 'ready' ? this.conditions.weather : null;
    this.reset();
    if (previewWeather) this.conditions = { ...this.conditions, weather: previewWeather };
    this.status = 'running';
    this.seedTraffic();
  }

  /** Cars already on the road at the start line, so the highway is never empty while the car gathers speed. */
  private seedTraffic(): void {
    for (let i = 0; i < OPENING_TRAFFIC; i++) {
      const lane = LANES[Math.floor(this.random() * LANE_COUNT)]!;
      const z = OPENING_TRAFFIC_MIN_Z + this.random() * (OPENING_TRAFFIC_MAX_Z - OPENING_TRAFFIC_MIN_Z);
      if (!isLaneClear(this.entities, lane, z, SPAWN_PROBE_SPEED)) continue;
      const entity = createTraffic(lane, this.car, 0, this.random);
      entity.z = z;
      this.entities.push(entity);
    }
  }

  finish(reason: EndReason): void {
    this.status = 'over';
    this.endReason = reason;
  }

  /** One paid continuation per race; debit only when continuation can actually succeed. */
  resume(wallet: { coins: number }): boolean {
    if (this.status !== 'over' || this.continued || wallet.coins < SECOND_CHANCE_PRICE) return false;
    wallet.coins -= SECOND_CHANCE_PRICE;
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
    this.offroadCooldown = Math.max(0, this.offroadCooldown - dt);
    const intensity = trafficIntensity(this.time);
    const pressure = trafficPressure(this.time);

    this.drive(dt, input);
    if (!this.keepOnRoad(dt)) return;
    const advance = this.advance(dt);
    if (!this.burnFuel(dt)) return;

    this.spawnEntities(dt, intensity, pressure);
    this.updateEntities(dt, advance, intensity, pressure);
    separateTraffic(this.entities);
    this.entities = this.entities.filter((e) => e.z > -0.15 && e.z < 1.5 && !(e.type === 'fuel' && e.collected));
  }

  /** Throttle, coasting, braking, steering and curve drift. */
  private drive(dt: number, input: DriveInput): void {
    // Accelerator, coast and brake are distinct. Automatic gearing gives strong
    // low-speed pull and less acceleration near the vehicle's top speed.
    // Local on purpose: keepOnRoad() owns `offroad` so it can detect the moment the car leaves the asphalt.
    const onGrass = Math.abs(this.x) > EDGE;
    const speedRatio = clamp(this.speed / this.car.max, 0, 1);
    const traction = onGrass ? OFFROAD_TRACTION : 1;
    const acceleration = vehicleAcceleration(this.car, this.speed) * traction;
    const coast = -(12 + this.speed * 0.025);
    const brakingGrip = 1 - this.environment.rain * (this.car.shape === 'bike' ? 0.25 : 0.15);
    const deceleration = vehicleTuning(this.car).braking * brakingGrip;
    const force = input.brake ? -deceleration : input.accelerate ? acceleration : coast;
    this.speed = clamp(this.speed + force * dt, 0, this.car.max);

    const grip = 1 - this.environment.rain * (this.car.shape === 'bike' ? 0.22 : 0.1);
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

  /**
   * Grass slows the car to a crawl and costs fuel and score multiplier, so it is
   * never a free emergency brake; the barrier ends the run. Returns false if the run ended.
   */
  private keepOnRoad(dt: number): boolean {
    const wasOffroad = this.offroad;
    this.offroad = Math.abs(this.x) > EDGE;
    if (this.offroad && !wasOffroad) {
      this.events.push('offroad');
      this.penaliseOffroad();
    }
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

  /** One charge per excursion; the cooldown stops a car riding the edge from being billed every frame. */
  private penaliseOffroad(): void {
    if (this.offroadCooldown > 0) return;
    this.offroadCooldown = OFFROAD_PENALTY_COOLDOWN;
    this.fuel = Math.max(0, this.fuel - OFFROAD_ENTRY_FUEL);
    this.scoreFactor = Math.max(MIN_SCORE_FACTOR, this.scoreFactor - OFFROAD_SCORE_PENALTY);
    this.events.push('fuelPenalty');
  }

  /** Moves the car along the road, banks score and coins, handles checkpoints. Returns metres advanced. */
  private advance(dt: number): number {
    const before = this.distance;
    const metres = (this.speed / 3.6) * dt;
    this.distance += metres;
    this.path += metres;
    this.kmTime += dt;
    this.kmMetres += metres;
    this.score += metres * this.multiplier;
    this.coins = Math.floor(this.score / POINTS_PER_COIN);

    if (Math.floor(this.distance / CHECKPOINT) > Math.floor(before / CHECKPOINT)) {
      this.checkpoints = Math.floor(this.distance / CHECKPOINT);
      this.fuel = Math.min(100, this.fuel + CHECKPOINT_FUEL);
      this.events.push('checkpoint');
      this.kmTime = 0;
      this.kmMetres = 0;
      this.scoreFactor = 1;
    }
    return metres;
  }

  /** Returns false when the tank ran dry. */
  private burnFuel(dt: number): boolean {
    // The engine keeps sipping at rest; smoothly reach the existing driving rate by 40 km/h.
    const baseBurn = IDLE_FUEL_BURN + (DRIVING_FUEL_BURN - IDLE_FUEL_BURN) * clamp(this.speed / DRIVING_FUEL_SPEED, 0, 1);
    const grassBurn = this.offroad ? OFFROAD_FUEL_BURN : 0;
    this.fuel = Math.max(0, this.fuel - dt * (this.car.consumption * (baseBurn + this.speed / SPEED_FUEL_DIVISOR) + grassBurn));
    if (this.fuel > 0) return true;
    this.finish('fuel');
    return false;
  }

  private spawnEntities(dt: number, intensity: number, pressure: number): void {
    this.trafficTimer -= dt;
    this.fuelTimer -= dt;

    if (this.trafficTimer <= 0) {
      const lanes = pickWaveLanes(intensity, this.random);
      if (trafficOf(this.entities).length < maxTraffic(pressure)) {
        for (const lane of lanes) {
          if (!isLaneClear(this.entities, lane, TRAFFIC_SPAWN_Z, SPAWN_PROBE_SPEED)) continue;
          this.entities.push(createTraffic(lane, this.car, intensity, this.random));
        }
      }
      this.trafficTimer = 1.1 - intensity * 0.7 - pressure * 0.15 + this.random() * 0.3;
    }

    if (this.fuelTimer <= 0) {
      this.entities.push(createFuel(LANES[Math.floor(this.random() * LANE_COUNT)]!));
      this.fuelTimer = 12 + this.random() * 5;
    }
  }

  private updateEntities(dt: number, playerAdvance: number, intensity: number, pressure: number): void {
    const steering = { entities: this.entities, playerLane: lanePosition(this.x), random: this.random, pressure };
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

    const bike = this.car.shape === 'bike';
    const reach = (bike ? 0.19 : 0.27) * VEHICLE_SCALE * vehicleTuning(this.car).width / (bike ? 0.6 : 1);
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
