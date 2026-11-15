import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CARS, Race, roadCurve} from '../src/game/index.ts';
import {car, quietRace, step} from './support/game.ts';

import {vehicleAcceleration} from '../src/game/vehicle-tuning.ts';

test('every vehicle smoothly loses pull above 70% and approaches its own top speed', () => {
  for (const spec of CARS) {
    let previous = Infinity;
    for (let percent = 0; percent <= 100; percent++) {
      const pull = vehicleAcceleration(spec, spec.max * percent / 100);
      assert.ok(Number.isFinite(pull) && pull >= 0 && pull <= previous, spec.id);
      if (percent < 100) assert.ok(pull > 0, `${spec.id} must still gain speed`);
      previous = pull;
    }
    assert.equal(vehicleAcceleration(spec, spec.max), 0);
    assert.equal(vehicleAcceleration(spec, spec.max + 10), 0);
    const threshold = spec.max * 0.7;
    assert.ok(Math.abs(vehicleAcceleration(spec, threshold - 0.001) - vehicleAcceleration(spec, threshold + 0.001)) < 0.001, spec.id);
    // The last 15% offers much less pull than at the threshold.
    const gains = [0.7, 0.85, 0.95].map(ratio => {
      const race = quietRace(spec);
      race.speed = spec.max * ratio;
      const before = race.speed;
      race.update(0.02, { accelerate: true });
      return race.speed - before;
    });
    assert.ok(gains[1]! < gains[0]! * 0.5, `${spec.id}: fade after 70%`);
    assert.ok(gains[2]! < gains[1]! * 0.35, `${spec.id}: gradual approach to maximum`);
  }
});

test('vehicle profiles differ in both initial gain and high-speed endurance', () => {
  const initialGains = CARS.map(spec => vehicleAcceleration(spec, 0));
  assert.equal(new Set(initialGains).size, CARS.length);
  const retainedPull = (id: string) => {
    const spec = car(id);
    return vehicleAcceleration(spec, spec.max * 0.9) / vehicleAcceleration(spec, spec.max * 0.7);
  };
  assert.ok(retainedPull('kombi') < retainedPull('fusca'));
  assert.ok(retainedPull('fusca') < retainedPull('gol'));
  assert.ok(retainedPull('gol') < retainedPull('gt'));
});

/** First road distance with a strong right-hand bend. */
const rightBendPath = (): number =>
  Array.from({ length: 1000 }, (_, i) => 420 + i * 20).find((d) => roadCurve(d, 0) > 55)!;

test('highway speeds require corner correction and extreme speeds keep increasing the load', () => {
  const drift = [60, 120, 150, 350].map((speed) => {
    const race = quietRace(car('gt'));
    race.speed = speed;
    race.path = rightBendPath();
    race.roadSeed = 0;
    race.update(0.001);
    return Math.abs(race.drift);
  });
  assert.ok(drift[1]! > drift[0]! * 3.9);
  assert.ok(drift[2]! > drift[1]! * 1.5);
  assert.ok(drift[3]! > drift[2]! * 3);
  assert.ok(drift[1]! > 0.24, '120 km/h should require active correction on a strong bend');
});

test('start, acceleration, distance and fuel are simulated', () => {
  const race = quietRace();
  step(race, 2, { accelerate: true });
  assert.ok(race.speed > 10 && race.speed < 16);
  assert.ok(race.distance > 3);
  assert.ok(race.fuel < 100);
});

test('braking reaches zero without ending the run; the accelerator restarts the car', () => {
  const race = quietRace();
  race.speed = 120;
  step(race, 4, { brake: true });
  assert.equal(race.speed, 0);
  assert.equal(race.status, 'running');
  const path = race.path;
  step(race, 1);
  assert.equal(race.path, path);
  step(race, 1, { accelerate: true });
  assert.ok(race.speed > 5 && race.speed < 8);
  assert.ok(race.path > path);
});

test('throttle, coast and brake give distinct speed changes and brake wins over throttle', () => {
  const inputs = [{ accelerate: true }, {}, { brake: true }, { accelerate: true, brake: true }];
  const [throttle, coast, brake, both] = inputs.map((input) => {
    const race = quietRace();
    race.speed = 100;
    step(race, 0.5, input);
    return race;
  }) as [Race, Race, Race, Race];
  assert.ok(throttle.speed > 100);
  assert.ok(coast.speed < 100);
  assert.ok(brake.speed < coast.speed - 8);
  assert.equal(brake.speed, both.speed);
});

test('Fusca acceleration builds gradually and sports cars accelerate and brake more strongly', () => {
  const timeTo = (id: string, target: number): number => {
    const race = quietRace(car(id));
    for (let i = 0; i < 5000; i++) {
      race.x = 0;
      race.update(0.02, { accelerate: true });
      if (race.speed >= target) return (i + 1) * 0.02;
    }
    throw new Error(`${id} did not reach ${target}`);
  };
  const fusca100 = timeTo('fusca', 100);
  assert.ok(fusca100 > 16 && fusca100 < 22);
  assert.ok(timeTo('fusca', car('fusca').max * 0.95) > fusca100 + 20);
  assert.ok(timeTo('gt', 100) < 8);
  const brake = (id: string): number => {
    const race = quietRace(car(id));
    race.speed = 100;
    step(race, 1, { brake: true });
    return race.speed;
  };
  assert.ok(brake('kombi') > brake('fusca'));
  assert.ok(brake('fusca') > brake('gol'));
  assert.ok(brake('gol') > brake('gt'));
});

test('pause freezes the simulation and reset clears the run', () => {
  const race = new Race();
  race.start();
  race.status = 'paused';
  race.update(0.05, { accelerate: true });
  assert.equal(race.distance, 0);
  assert.equal(race.fuel, 100);
  race.start();
  assert.equal(race.continued, false);
  assert.equal(race.status, 'running');
});

test('vehicles differ in acceleration and fuel consumption', () => {
  const slow = quietRace(car('fusca'));
  const fast = quietRace(car('gt'));
  for (const race of [slow, fast]) step(race, 1, { accelerate: true });
  assert.ok(fast.speed > slow.speed);
  assert.ok(fast.fuel < slow.fuel);
});

test('the Veloce GT tops out at 350 km/h', () => {
  const gt = car('gt');
  assert.equal(gt.max, 350);
  const race = quietRace(gt);
  for (let i = 0; i < 4000; i++) {
    race.x = 0;
    race.fuel = 100; // top speed is the question here, not how long a tank lasts
    race.update(0.02, { accelerate: true });
  }
  assert.ok(race.speed > 345 && race.speed <= 350);
});

test('rain reduces motorcycle steering grip', () => {
  const dry = quietRace(car('moto'));
  const wet = quietRace(car('moto'));
  dry.speed = wet.speed = 100;
  wet.conditions = { cycleOffset: 0, weather: ['rain'] };
  dry.update(0.05, { steer: 1 });
  wet.update(0.05, { steer: 1 });
  assert.ok(wet.x < dry.x);
});

test('a right-hand bend pushes an unattended car outward and steering counters it', () => {
  const unattended = quietRace();
  const steered = quietRace();
  for (const race of [unattended, steered]) {
    race.speed = 180;
    race.roadSeed = 0;
    race.path = rightBendPath();
  }
  for (let t = 0; t < 0.5; t += 0.02) {
    unattended.update(0.02, { accelerate: true });
    steered.update(0.02, { accelerate: true, steer: 1 });
  }
  assert.ok(unattended.x < -0.05);
  assert.ok(steered.x > unattended.x + 0.3);
});

test('braking reduces outward cornering force and a stopped car cannot slide sideways', () => {
  const accelerating = quietRace();
  const braking = quietRace();
  for (const race of [accelerating, braking]) {
    race.speed = 180;
    race.roadSeed = 0;
    race.path = rightBendPath();
  }
  step(accelerating, 0.5, { accelerate: true });
  step(braking, 0.5, { brake: true });
  assert.ok(Math.abs(braking.x) < Math.abs(accelerating.x));

  const stopped = quietRace();
  stopped.roadSeed = 0;
  stopped.path = rightBendPath();
  step(stopped, 1, { steer: 1 });
  assert.equal(stopped.x, 0);
});

test('straight driving stays centred and path advancement matches distance', () => {
  const race = quietRace();
  step(race, 5, { accelerate: true });
  assert.equal(race.x, 0);
  assert.equal(race.drift, 0);
  assert.equal(race.path, race.distance);
});

test('steering responds smoothly and returns to neutral when released', () => {
  const race = quietRace();
  race.update(0.02, { steer: 1 });
  assert.ok(race.steer > 0 && race.steer < 0.5);
  step(race, 0.3, { steer: 1 });
  assert.ok(race.steer > 0.95);
  step(race, 0.5);
  assert.ok(race.steer < 0.01);
});

test('road travel is proportional to speed and freezes when stopped or paused', () => {
  const travel = (speed: number): number => {
    const race = quietRace(car('gt'));
    race.speed = speed;
    race.update(0.05);
    return race.path;
  };
  const slow = travel(60);
  const fast = travel(180);
  assert.ok(fast > slow * 2.9 && fast < slow * 3.1);
  assert.equal(travel(0), 0);

  const paused = quietRace();
  paused.speed = 180;
  paused.status = 'paused';
  paused.update(0.05, { accelerate: true });
  assert.equal(paused.path, 0);
});

test('120 km/h for one simulated minute covers exactly 2 km, and pause preserves the units', () => {
  const race = quietRace({ ...CARS[0]!, max: 120 });
  race.speed = 120;
  for (let i = 0; i < 1200; i++) {
    race.x = 0;
    race.update(0.05, { accelerate: true });
  }
  assert.ok(Math.abs(race.distance - 2000) < 1e-8);
  assert.ok(Math.abs(race.time - 60) < 1e-8);
  assert.equal(race.path, race.distance);

  const distance = race.distance;
  const time = race.time;
  race.status = 'paused';
  step(race, 10, { accelerate: true });
  assert.equal(race.distance, distance);
  assert.equal(race.time, time);
});
