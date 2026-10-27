import { CARS, type CarSpec } from './cars.ts';
import { clamp } from './math.ts';
import { FIRST_LANE, LAST_LANE, LANES, LANE_COUNT, LANE_WIDTH, PATH_UNIT, PLAYER_DEPTH } from './road.ts';

export interface TrafficEntity {
  readonly type: 'traffic';
  /** Current lateral position in lane units; fractional while changing lanes. */
  lane: number;
  targetLane: number;
  /** Depth ahead of the player in `PATH_UNIT`s (1 = horizon, 0 = camera). */
  z: number;
  /** Speed in km/h. */
  speed: number;
  /** 0..1 personality: how close to the speed ceiling this driver cruises. */
  readonly cruise: number;
  readonly car: CarSpec;
  /** Seconds until the next lane-change consideration. */
  timer: number;
  /** Seconds before a blocked driver may try another lane. */
  cooldown: number;
  passed: boolean;
}

export interface FuelEntity {
  readonly type: 'fuel';
  readonly lane: number;
  z: number;
  passed: boolean;
  collected: boolean;
}

export type Entity = TrafficEntity | FuelEntity;

export type Random = () => number;

export const TRAFFIC_SPAWN_Z = 1.1;
/** Seconds of play over which traffic density and speed ramp up to their maximum. */
export const TRAFFIC_RAMP = 240;
export const MAX_TRAFFIC = 16;
/** Smallest bumper-to-bumper depth between two cars sharing a lane. */
const MIN_FOLLOW_GAP = 0.03;
/** Depth within which a car starts matching the speed of the one ahead. */
const FOLLOW_ZONE = 0.1;
const FOLLOW_BRAKE_KMH_PER_S = 60;
const SPEED_CHANGE_KMH_PER_S = 3;
const LANE_CHANGE_LANES_PER_S = 0.9;
const LANE_OVERLAP = 0.85;
const NEW_CAR_SPEED_GUESS = 90;
/** Traffic never changes lanes closer than this to the player. */
const NO_CUT_IN_DEPTH = PLAYER_DEPTH + 0.14;
const NEAR_PLAYER_DEPTH = 0.6;
const NEAR_PLAYER_LANES = 1.3;
const BLOCKED_DEPTH = 0.26;

export const trafficIntensity = (time: number): number => clamp(time / TRAFFIC_RAMP, 0, 1);

/** Cruising speed of an NPC, bounded by both the player's and its own top speed. */
export function trafficSpeed(playerCar: CarSpec, trafficCar: CarSpec, intensity: number, cruise: number): number {
  return Math.min(trafficCar.max * 0.85, playerCar.max * (0.34 + 0.16 * intensity + cruise * (0.18 + 0.14 * intensity)));
}

export function createTraffic(lane: number, playerCar: CarSpec, intensity: number, random: Random): TrafficEntity {
  const car = CARS[Math.floor(random() * CARS.length)]!;
  const cruise = random();
  return {
    type: 'traffic',
    lane,
    targetLane: lane,
    z: TRAFFIC_SPAWN_Z,
    speed: trafficSpeed(playerCar, car, intensity, cruise),
    cruise,
    car,
    timer: 1.5 + random() * 4,
    cooldown: 0,
    passed: false,
  };
}

export function createFuel(lane: number): FuelEntity {
  return { type: 'fuel', lane, z: TRAFFIC_SPAWN_Z, passed: false, collected: false };
}

export const trafficOf = (entities: readonly Entity[]): TrafficEntity[] =>
  entities.filter((e): e is TrafficEntity => e.type === 'traffic');

/** Lanes for one spawn wave: one to three distinct lanes, always leaving two open. */
export function pickWaveLanes(intensity: number, random: Random): number[] {
  const first = LANES[Math.floor(random() * LANE_COUNT)]!;
  const lanes = [first];
  if (random() < 0.25 + intensity * 0.6) {
    const offset = 1 + Math.floor(random() * (LANE_COUNT - 1));
    lanes.push(LANES[(LANES.indexOf(first) + offset) % LANE_COUNT]!);
  }
  if (intensity > 0.4 && random() < intensity * 0.55) {
    const free = LANES.filter((lane) => !lanes.includes(lane));
    lanes.push(free[Math.floor(random() * free.length)]!);
  }
  return lanes;
}

/**
 * Whether a car at depth `z` and `speed` fits in `lane` without crowding any other
 * traffic (ignoring `except`). Faster closing speeds demand a larger gap.
 */
export function isLaneClear(entities: readonly Entity[], lane: number, z: number, speed: number, except?: TrafficEntity): boolean {
  for (const other of trafficOf(entities)) {
    if (other === except) continue;
    const occupies = Math.abs(other.lane - lane) < 0.9 || Math.abs(other.targetLane - lane) < 0.9;
    if (!occupies) continue;
    const closing = (Math.abs(other.speed - speed) / 3.6) * 1.5 / PATH_UNIT;
    if (Math.abs(other.z - z) < 0.12 + closing) return false;
  }
  return true;
}

/** The nearest car ahead that overlaps `car` laterally, if any. */
export function findLeader(entities: readonly Entity[], car: TrafficEntity): TrafficEntity | null {
  let leader: TrafficEntity | null = null;
  for (const other of trafficOf(entities)) {
    if (other === car || other.z <= car.z || Math.abs(other.lane - car.lane) >= LANE_OVERLAP) continue;
    if (!leader || other.z < leader.z) leader = other;
  }
  return leader;
}

/** Matches the car's speed to its leader as the gap closes. */
export function followLeader(car: TrafficEntity, leader: TrafficEntity | null, dt: number): void {
  if (!leader) return;
  const limit = leader.speed * clamp((leader.z - car.z - 0.05) / FOLLOW_ZONE, 0, 1);
  if (car.speed > limit) car.speed = Math.max(limit, car.speed - FOLLOW_BRAKE_KMH_PER_S * dt);
}

/** Existing cars drift gradually toward their cruising speed, never jumping. */
export function approachCruise(car: TrafficEntity, playerCar: CarSpec, intensity: number, dt: number): void {
  const target = trafficSpeed(playerCar, car.car, intensity, car.cruise);
  car.speed += clamp(target - car.speed, -SPEED_CHANGE_KMH_PER_S * dt, SPEED_CHANGE_KMH_PER_S * dt);
}

export interface SteeringContext {
  readonly entities: readonly Entity[];
  /** Player position in lane units. */
  readonly playerLane: number;
  readonly random: Random;
}

/**
 * Lane-change behaviour: finish a manoeuvre in progress, otherwise every few
 * seconds (or at once when stuck behind a slower car) consider an adjacent lane
 * that is clear and not just ahead of the player.
 */
export function steerTraffic(car: TrafficEntity, dt: number, leader: TrafficEntity | null, ctx: SteeringContext): void {
  car.cooldown = Math.max(0, car.cooldown - dt);

  if (car.lane !== car.targetLane) {
    const step = LANE_CHANGE_LANES_PER_S * dt;
    const diff = car.targetLane - car.lane;
    car.lane = Math.abs(diff) <= step ? car.targetLane : car.lane + Math.sign(diff) * step;
    return;
  }

  car.timer -= dt;
  const blocked = leader !== null && leader.z - car.z < BLOCKED_DEPTH && leader.speed < car.speed - 4;
  const shouldConsider = (blocked && car.cooldown <= 0) || car.timer <= 0;
  if (!shouldConsider) return;

  car.timer = 2.5 + ctx.random() * 4.5;
  if (car.z < NO_CUT_IN_DEPTH) return;
  if (!blocked && ctx.random() > 0.8) return;

  const first = ctx.random() < 0.5 ? -1 : 1;
  for (const direction of [first, -first]) {
    const target = car.lane + direction;
    if (target < FIRST_LANE || target > LAST_LANE) continue;
    if (car.z < NEAR_PLAYER_DEPTH && Math.abs(target - ctx.playerLane) < NEAR_PLAYER_LANES) continue;
    if (!isLaneClear(ctx.entities, target, car.z, car.speed, car)) continue;
    car.targetLane = target;
    car.cooldown = 2;
    return;
  }
}

/** Hard stop against overlap: a car can never end up inside the one ahead. */
export function separateTraffic(entities: readonly Entity[]): void {
  const cars = trafficOf(entities).sort((a, b) => b.z - a.z);
  for (let i = 1; i < cars.length; i++) {
    for (let j = 0; j < i; j++) {
      const follower = cars[i]!;
      const leader = cars[j]!;
      if (Math.abs(follower.lane - leader.lane) >= LANE_OVERLAP || follower.z <= leader.z - MIN_FOLLOW_GAP) continue;
      follower.z = leader.z - MIN_FOLLOW_GAP;
      follower.speed = Math.min(follower.speed, leader.speed);
    }
  }
}

export const lanePosition = (x: number): number => x / LANE_WIDTH;
export const SPAWN_PROBE_SPEED = NEW_CAR_SPEED_GUESS;
