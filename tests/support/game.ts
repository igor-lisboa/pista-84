import { CARS, Race, type CarSpec, type DriveInput, type FuelEntity, type Random, type TrafficEntity } from '../../src/game/index.ts';

export const car = (id: string): CarSpec => {
  const found = CARS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown car ${id}`);
  return found;
};

/** Deterministic pseudo-random numbers in [0, 1) (linear congruential generator). */
export function seededRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Advances a race in 20 ms steps. */
export function step(race: Race, seconds: number, input: DriveInput = {}): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) race.update(0.02, input);
}

/** A running race with no traffic or fuel cans spawning by themselves. */
export function quietRace(spec: CarSpec = CARS[0]!, random?: Random): Race {
  const race = new Race(spec, random);
  race.start();
  race.entities = [];
  race.trafficTimer = 1e9;
  race.fuelTimer = 1e9;
  return race;
}

/** A traffic car that never changes lanes, for placing obstacles precisely. */
export function trafficCar(options: { lane: number; z: number; speed?: number; spec?: CarSpec }): TrafficEntity {
  return {
    type: 'traffic',
    lane: options.lane,
    targetLane: options.lane,
    z: options.z,
    speed: options.speed ?? 0,
    cruise: 0.5,
    car: options.spec ?? car('brasilia'),
    timer: 1e9,
    cooldown: 0,
    passed: false,
  };
}

export function fuelCan(lane: number, z: number): FuelEntity {
  return { type: 'fuel', lane, z, passed: false, collected: false };
}
