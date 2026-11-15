import type { Race, DriveInput } from './race.ts';
import { clamp } from './math.ts';
import { vehicleAcceleration, vehicleTuning } from './vehicle-tuning.ts';
import { EDGE, WALL, PATH_UNIT, PLAYER_DEPTH, VEHICLE_SCALE, roadBend } from './road.ts';

type DrivingState = Pick<Race, 'car' | 'environment' | 'x' | 'speed' | 'steer' | 'drift' | 'path' | 'roadSeed' |
  'offroad' | 'offroadCooldown' | 'fuel' | 'scoreFactor' | 'events' | 'wall' | 'status' | 'crash'>;

/** Shoulder speed target in km/h; drag never increases a slower car's speed. */
export const OFFROAD_LIMIT = 40;
const OFFROAD_TRACTION = 0.1;
const OFFROAD_DRAG = 5.5;
/** Tank percentage points charged once on shoulder entry. */
export const OFFROAD_ENTRY_FUEL = 15;
/** Extra tank percentage points per second on the shoulder. */
export const OFFROAD_FUEL_BURN = 3;
export const OFFROAD_SCORE_PENALTY = 0.25;
export const MIN_SCORE_FACTOR = 0.25;
const OFFROAD_PENALTY_COOLDOWN = 1.5;
const STEER_RESPONSE = 22;
const BARRIER_BOUNCE = 0.16;

/** Throttle, coasting, braking, steering and curve drift. */
export function driveRace(state: DrivingState, dt: number, input: DriveInput): void {
  // Accelerator, coast and brake are distinct. Automatic gearing gives strong
  // low-speed pull and less acceleration near the vehicle's top speed.
  // Road contact owns `offroad` so it can detect the moment the car leaves the asphalt.
  const onGrass = Math.abs(state.x) > EDGE;
  const speedRatio = clamp(state.speed / state.car.max, 0, 1);
  const traction = onGrass ? OFFROAD_TRACTION : 1;
  const acceleration = vehicleAcceleration(state.car, state.speed) * traction;
  const coast = -(12 + state.speed * 0.025);
  const brakingGrip = 1 - state.environment.rain * (state.car.shape === 'bike' ? 0.25 : 0.15);
  const deceleration = vehicleTuning(state.car).braking * brakingGrip;
  const force = input.brake ? -deceleration : input.accelerate ? acceleration : coast;
  state.speed = clamp(state.speed + force * dt, 0, state.car.max);

  const grip = 1 - state.environment.rain * (state.car.shape === 'bike' ? 0.22 : 0.1);
  const rolling = clamp(state.speed / 90, 0, 1);
  // Corners need attention at ordinary highway speeds and braking at extreme speeds.
  const load = clamp((state.speed / 120) ** 2, 0, 6);
  state.steer += (clamp(input.steer ?? 0, -1, 1) - state.steer) * (1 - Math.exp(-dt * STEER_RESPONSE));
  state.drift =
    (roadBend(state.path + PATH_UNIT * PLAYER_DEPTH, state.roadSeed) * load * 0.9 * VEHICLE_SCALE) /
    Math.sqrt(state.car.handling) /
    grip;
  const authority = (1.35 - 0.25 * speedRatio) * rolling * state.car.handling * grip * VEHICLE_SCALE;
  state.x += (state.steer * authority - state.drift) * dt;
}

/**
 * Grass slows the car to a crawl and costs fuel and score multiplier, so it is
 * never a free emergency brake; the barrier ends the run. Returns false if the run ended.
 */
export function keepRaceOnRoad(state: DrivingState, dt: number): boolean {
  const wasOffroad = state.offroad;
  state.offroad = Math.abs(state.x) > EDGE;
  if (state.offroad && !wasOffroad) {
    state.events.push('offroad');
    penaliseOffroad(state);
  }
  if (state.offroad && state.speed > OFFROAD_LIMIT) {
    // Ease toward the limit instead of snapping: a violent but smooth deceleration.
    state.speed = OFFROAD_LIMIT + (state.speed - OFFROAD_LIMIT) * Math.exp(-OFFROAD_DRAG * dt);
  }
  state.wall = 0;
  if (Math.abs(state.x) >= WALL) {
    state.wall = Math.sign(state.x);
    state.x = state.wall * (WALL - BARRIER_BOUNCE);
    state.crash('wall');
  }
  return state.status === 'running';
}

/** One charge per excursion; the cooldown stops a car riding the edge from being billed every frame. */
function penaliseOffroad(state: DrivingState): void {
  if (state.offroadCooldown > 0) return;
  state.offroadCooldown = OFFROAD_PENALTY_COOLDOWN;
  state.fuel = Math.max(0, state.fuel - OFFROAD_ENTRY_FUEL);
  state.scoreFactor = Math.max(MIN_SCORE_FACTOR, state.scoreFactor - OFFROAD_SCORE_PENALTY);
  state.events.push('fuelPenalty');
}
