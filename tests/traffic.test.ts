import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CARS,
  LANES,
  MAX_TRAFFIC,
  Race,
  TRAFFIC_RAMP,
  TRAFFIC_PAINTS,
  createTraffic,
  trafficIntensity,
  trafficOf,
  trafficSpeed,
} from '../src/game/index.ts';
import { car, fuelCan, quietRace, seededRandom, step, trafficCar } from './support/game.ts';

test('highway models spawn in varied paints without changing catalog colors or performance', () => {
  const defaults = CARS.map((car) => ({ ...car }));
  const random = seededRandom(321);
  const colors = new Map<string, Set<string>>();
  for (let i = 0; i < 2000; i++) {
    const traffic = createTraffic(0, CARS[0]!, 0, random);
    const model = CARS.find((car) => car.id === traffic.car.id)!;
    assert.ok(TRAFFIC_PAINTS.some((paint) => paint === traffic.car.color));
    assert.notEqual(traffic.car, model);
    assert.deepEqual({ ...traffic.car, color: model.color }, model);
    if (!colors.has(model.id)) colors.set(model.id, new Set());
    colors.get(model.id)!.add(traffic.car.color);
  }
  assert.equal(colors.size, CARS.length);
  for (const [id, paints] of colors) assert.ok(paints.size >= 5, id);
  assert.deepEqual(CARS, defaults);
});

/** Runs one spawn wave on an empty road and reports what appeared. */
function spawnWave(race: Race): void {
  race.entities = [];
  race.trafficTimer = 0;
  race.fuelTimer = 0;
  race.update(0);
}

test('traffic and fuel cans spawn in all five lanes, and waves use distinct lanes', () => {
  const race = new Race(CARS[0], seededRandom(123));
  race.start();
  race.time = TRAFFIC_RAMP;
  const trafficLanes = new Set<number>();
  const fuelLanes = new Set<number>();
  let doubles = 0;
  for (let i = 0; i < 300; i++) {
    spawnWave(race);
    const cars = trafficOf(race.entities);
    assert.equal(new Set(cars.map((c) => c.lane)).size, cars.length);
    if (cars.length >= 2) doubles++;
    for (const entity of race.entities) {
      assert.ok(LANES.includes(entity.lane));
      (entity.type === 'traffic' ? trafficLanes : fuelLanes).add(entity.lane);
    }
  }
  assert.equal(trafficLanes.size, 5);
  assert.equal(fuelLanes.size, 5);
  assert.ok(doubles > 0);
});

test('traffic keeps its own speed: braking lets it pull away while pickups stay fixed', () => {
  const race = quietRace();
  race.entities = [trafficCar({ lane: 2, z: 0.5, speed: 90 }), fuelCan(2, 0.5)];
  step(race, 1);
  assert.ok(race.entities[0]!.z > 0.5);
  assert.equal(race.entities[1]!.z, 0.5);
  race.speed = 180;
  const z = race.entities[0]!.z;
  race.update(0.05);
  assert.ok(race.entities[0]!.z < z);
});

test('elapsed time increases traffic density and speed, with caps for every vehicle', () => {
  const sample = (time: number) => {
    const race = new Race(CARS[0], seededRandom(123));
    race.start();
    race.time = time;
    race.fuelTimer = 1e9;
    let count = 0;
    let interval = 0;
    let speed = 0;
    for (let i = 0; i < 300; i++) {
      race.entities = [];
      race.trafficTimer = 0;
      race.update(0);
      const cars = trafficOf(race.entities);
      count += cars.length;
      interval += race.trafficTimer;
      assert.ok(cars.length <= 3);
      assert.equal(new Set(cars.map((c) => c.lane)).size, cars.length);
      for (const c of cars) speed += c.speed;
    }
    return { rate: count / interval, speed: speed / count };
  };

  const start = sample(0);
  const middle = sample(TRAFFIC_RAMP / 2);
  const late = sample(TRAFFIC_RAMP);
  assert.ok(middle.rate > start.rate);
  assert.ok(late.rate > middle.rate * 1.5);
  assert.ok(late.rate >= 2.5);
  assert.ok(middle.speed > start.speed);
  assert.ok(late.speed > middle.speed);
  assert.deepEqual(sample(3600), late);

  for (const player of CARS) {
    for (const npc of CARS) {
      for (const bias of [0, 0.5, 1]) {
        const first = trafficSpeed(player, npc, trafficIntensity(0), bias);
        const last = trafficSpeed(player, npc, trafficIntensity(TRAFFIC_RAMP), bias);
        assert.ok(last >= first);
        assert.ok(last <= player.max * 0.82 + 1e-8);
        assert.ok(last <= npc.max * 0.85 + 1e-8);
      }
    }
  }
});

test('existing traffic accelerates gradually and difficulty freezes while paused', () => {
  const race = new Race(CARS.find((c) => c.id === 'gt'));
  race.start();
  race.time = 90;
  race.trafficTimer = 1000;
  race.fuelTimer = 1000;
  const npc = car('gt');
  const cruise = 0.5;
  const speed = trafficSpeed(race.car, npc, 0, cruise);
  const entity = { ...trafficCar({ lane: 2, z: 0.2, speed, spec: npc }), cruise };
  race.entities = [entity];
  race.update(0.05);
  assert.ok(entity.speed > speed);
  assert.ok(entity.speed <= speed + 0.15 + 1e-8);

  const before = structuredClone(race.entities);
  const time = race.time;
  race.status = 'paused';
  step(race, 2);
  assert.equal(race.time, time);
  assert.deepEqual(race.entities, before);
  race.start();
  assert.equal(trafficIntensity(race.time), 0);
});

test('traffic changes lanes, stays on the road and never overlaps other traffic', () => {
  const race = new Race(CARS[0], seededRandom(7));
  race.start();
  race.fuelTimer = 1e9;
  const changing = new Set<object>();
  let closest = Infinity;
  for (let i = 0; i < 9000; i++) {
    race.x = 0;
    race.speed = Math.max(race.speed, 40);
    race.invincible = 1;
    race.time = 170;
    race.update(0.02);
    const cars = trafficOf(race.entities);
    for (const c of cars) {
      assert.ok(c.lane >= -2 - 1e-9 && c.lane <= 2 + 1e-9);
      if (c.lane !== c.targetLane) changing.add(c);
    }
    for (let a = 0; a < cars.length; a++) {
      for (let b = a + 1; b < cars.length; b++) {
        if (Math.abs(cars[a]!.lane - cars[b]!.lane) < 0.85) closest = Math.min(closest, Math.abs(cars[a]!.z - cars[b]!.z));
      }
    }
  }
  assert.ok(changing.size > 3);
  assert.ok(closest >= 0.03 - 1e-9);
});

test('heavy traffic never overlaps and stays within the cap', () => {
  const race = new Race(CARS[0], seededRandom(99));
  race.start();
  race.fuelTimer = 1e9;
  race.invincible = 1e9;
  let busiest = 0;
  for (let i = 0; i < 20000; i++) {
    race.time = TRAFFIC_RAMP;
    race.x = 0;
    race.speed = i % 1500 < 750 ? 60 : 140;
    race.update(0.02);
    const cars = trafficOf(race.entities);
    busiest = Math.max(busiest, cars.length);
    assert.ok(cars.length <= MAX_TRAFFIC + 3);
    for (let a = 0; a < cars.length; a++) {
      for (let b = a + 1; b < cars.length; b++) {
        if (Math.abs(cars[a]!.lane - cars[b]!.lane) < 0.85) {
          assert.ok(Math.abs(cars[a]!.z - cars[b]!.z) >= 0.03 - 1e-9);
        }
      }
    }
  }
  assert.ok(busiest >= 6);
});

test('a new run starts with cars already ahead, and', () => {
  const race = new Race(car('fusca'), seededRandom(7));
  race.start();
  assert.ok(trafficOf(race.entities).length >= 1);
  assert.ok(race.entities.every((entity) => entity.z >= 0.4 && entity.z <= 0.9));
  assert.equal(TRAFFIC_RAMP, 120);
});
