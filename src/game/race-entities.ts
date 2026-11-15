import type { Race } from './race.ts';
import { vehicleTuning } from './vehicle-tuning.ts';
import { LANES, LANE_COUNT, PATH_UNIT, PLAYER_DEPTH, VEHICLE_SCALE, laneCenter } from './road.ts';
import { maxTraffic, SPAWN_PROBE_SPEED, TRAFFIC_SPAWN_Z, approachCruise, createFuel, createTraffic,
  findLeader, followLeader, isLaneClear, lanePosition, pickWaveLanes, steerTraffic, trafficOf, type Entity } from './traffic.ts';

type EntityState = Pick<Race, 'car' | 'random' | 'entities' | 'trafficTimer' | 'fuelTimer' | 'x' | 'fuel' | 'events' | 'crash'>;

export const FUEL_PICKUP = 12;
const PICKUP_DEPTH_WINDOW = 0.018;
const OPENING_TRAFFIC = 3;
const OPENING_TRAFFIC_MIN_Z = 0.4;
const OPENING_TRAFFIC_MAX_Z = 0.9;

/** Cars already on the road at the start line, so the highway is never empty while the car gathers speed. */
export function seedRaceTraffic(state: EntityState): void {
  for (let i = 0; i < OPENING_TRAFFIC; i++) {
    const lane = LANES[Math.floor(state.random() * LANE_COUNT)]!;
    const z = OPENING_TRAFFIC_MIN_Z + state.random() * (OPENING_TRAFFIC_MAX_Z - OPENING_TRAFFIC_MIN_Z);
    if (!isLaneClear(state.entities, lane, z, SPAWN_PROBE_SPEED)) continue;
    const entity = createTraffic(lane, state.car, 0, state.random);
    entity.z = z;
    state.entities.push(entity);
  }
}

export function spawnRaceEntities(state: EntityState, dt: number, intensity: number, pressure: number): void {
  state.trafficTimer -= dt;
  state.fuelTimer -= dt;

  if (state.trafficTimer <= 0) {
    const lanes = pickWaveLanes(intensity, state.random);
    if (trafficOf(state.entities).length < maxTraffic(pressure)) {
      for (const lane of lanes) {
        if (!isLaneClear(state.entities, lane, TRAFFIC_SPAWN_Z, SPAWN_PROBE_SPEED)) continue;
        state.entities.push(createTraffic(lane, state.car, intensity, state.random));
      }
    }
    state.trafficTimer = 1.1 - intensity * 0.7 - pressure * 0.15 + state.random() * 0.3;
  }

  if (state.fuelTimer <= 0) {
    state.entities.push(createFuel(LANES[Math.floor(state.random() * LANE_COUNT)]!));
    state.fuelTimer = 12 + state.random() * 5;
  }
}

export function updateRaceEntities(state: EntityState, dt: number, playerAdvance: number, intensity: number, pressure: number): void {
  const steering = { entities: state.entities, playerLane: lanePosition(state.x), random: state.random, pressure };
  for (const entity of state.entities) {
    let ownAdvance = 0;
    if (entity.type === 'traffic') {
      approachCruise(entity, state.car, intensity, dt);
      const leader = findLeader(state.entities, entity);
      steerTraffic(entity, dt, leader, steering);
      followLeader(entity, leader, dt);
      ownAdvance = (entity.speed / 3.6) * dt;
    }
    const previousZ = entity.z;
    entity.z += (ownAdvance - playerAdvance) / PATH_UNIT;
    checkContact(state, entity, previousZ);
  }
}

/** Pickups and collisions happen when an entity sweeps through the player's plane. */
function checkContact(state: EntityState, entity: Entity, previousZ: number): void {
  const crossed =
    Math.min(previousZ, entity.z) <= PLAYER_DEPTH + PICKUP_DEPTH_WINDOW &&
    Math.max(previousZ, entity.z) >= PLAYER_DEPTH - PICKUP_DEPTH_WINDOW;
  if (entity.passed || !crossed) return;

  const bike = state.car.shape === 'bike';
  const reach = (bike ? 0.19 : 0.27) * VEHICLE_SCALE * vehicleTuning(state.car).width / (bike ? 0.6 : 1);
  if (Math.abs(state.x - laneCenter(entity.lane)) >= reach) return;

  entity.passed = true;
  if (entity.type === 'fuel') {
    state.fuel = Math.min(100, state.fuel + FUEL_PICKUP);
    entity.collected = true;
    state.events.push('fuel');
  } else {
    state.crash('traffic');
  }
}
