import { CARS, type CarSpec } from './cars.ts';
import { environment, rollConditions, type Conditions, type Environment } from './environment.ts';
import { clamp } from './math.ts';
import { CHECKPOINT } from './road.ts';
import { POINTS_PER_COIN, paceMultiplier } from './scoring.ts';
import { separateTraffic, trafficIntensity, trafficPressure, type Entity, type Random } from './traffic.ts';
import { driveRace, keepRaceOnRoad, OFFROAD_FUEL_BURN } from './race-driving.ts';
import { seedRaceTraffic, spawnRaceEntities, updateRaceEntities } from './race-entities.ts';
export { OFFROAD_LIMIT, OFFROAD_ENTRY_FUEL, OFFROAD_FUEL_BURN, OFFROAD_SCORE_PENALTY, MIN_SCORE_FACTOR } from './race-driving.ts';
export { FUEL_PICKUP } from './race-entities.ts';

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

const MAX_STEP_SECONDS = 0.05;
export const SECOND_CHANCE_PRICE = 1000;
/** Fuel (percent of a tank) restored at every checkpoint. */
export const CHECKPOINT_FUEL = 4;
const IDLE_FUEL_BURN = 0.04;
const DRIVING_FUEL_BURN = 0.45;
const DRIVING_FUEL_SPEED = 40;
/** Higher divisor = the speed-dependent part of the burn grows more slowly. */
const SPEED_FUEL_DIVISOR = 300;
const SECOND_CHANCE_SPEED = 90;
const SECOND_CHANCE_FUEL = 45;
const SECOND_CHANCE_INVINCIBLE = 3;
const FIRST_TRAFFIC_DELAY = 0.6;
const FIRST_FUEL_DELAY = 8;

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
    seedRaceTraffic(this);
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

    driveRace(this, dt, input);
    if (!keepRaceOnRoad(this, dt)) return;
    const advance = this.advance(dt);
    if (!this.burnFuel(dt)) return;

    spawnRaceEntities(this, dt, intensity, pressure);
    updateRaceEntities(this, dt, advance, intensity, pressure);
    separateTraffic(this.entities);
    this.entities = this.entities.filter((e) => e.z > -0.15 && e.z < 1.5 && !(e.type === 'fuel' && e.collected));
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

}
