import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CARS,
  LANES,
  LANE_COUNT,
  LANE_DIVIDERS,
  LANE_WIDTH,
  OFFROAD_LIMIT,
  PLAYER_DEPTH,
  PLAYER_T,
  Race,
  depthToScreen,
  laneCenter,
  roadCurve,
  screenToDepth,
} from '../src/game/index.ts';
import { car, fuelCan, quietRace, step, trafficCar } from './support/game.ts';
import { vehicleAcceleration } from '../src/game/vehicle-tuning.ts';

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

test('running out of fuel ends the run and the car cannot move afterwards', () => {
  const race = new Race();
  race.start();
  race.fuel = 0.001;
  race.update(0.05);
  assert.equal(race.status, 'over');
  assert.equal(race.endReason, 'fuel');
  assert.equal(race.crashed, false);
  const distance = race.distance;
  race.update(0.05);
  assert.equal(race.distance, distance);
});

test('a fuel can restores 32, caps at 100 and is consumed once', () => {
  const race = quietRace();
  race.fuel = 80;
  race.entities = [fuelCan(0, PLAYER_DEPTH)];
  race.update(0.02);
  assert.equal(race.fuel, 100);
  assert.equal(race.entities.length, 0);
  race.update(0.02);
  assert.ok(race.fuel < 100);
});

test('the second chance requires 1000 coins, debits once, and clears the road', () => {
  const race = new Race();
  race.start();
  race.finish('fuel');
  race.fuel = 0;
  const poor = { coins: 999 };
  assert.equal(race.resume(poor), false);
  assert.equal(poor.coins, 999);
  assert.equal(race.status, 'over');
  const wallet = { coins: 2000 };
  assert.equal(race.resume(wallet), true);
  assert.equal(wallet.coins, 1000);
  assert.equal(race.fuel, 45);
  assert.equal(race.invincible, 3);
  race.finish('fuel');
  assert.equal(race.resume(wallet), false);
  assert.equal(wallet.coins, 1000);
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

test('every car slowly consumes fuel at rest according to its consumption rating, and pause stops it', () => {
  for (const spec of CARS) {
    const race = quietRace(spec);
    for (let i = 0; i < 1200; i++) race.update(0.05);
    const used = 100 - race.fuel;
    assert.ok(used > 0 && used < 5, `${spec.id} should slowly use fuel at idle`);
    assert.ok(Math.abs(used - spec.consumption * 2.4) < 1e-8, spec.id);
    assert.equal(race.speed, 0);
    assert.equal(race.distance, 0);
    race.status = 'paused';
    const fuel = race.fuel;
    for (let i = 0; i < 100; i++) race.update(0.05);
    assert.equal(race.fuel, fuel, spec.id);
    race.status = 'running';
    race.speed = 100;
    const before = race.fuel;
    race.update(0.05);
    assert.ok(before - race.fuel > (used / 60) * 0.05 * 10, `${spec.id} uses far less fuel at idle than driving`);
  }
});

test('the Veloce GT tops out at 350 km/h', () => {
  const gt = car('gt');
  assert.equal(gt.max, 350);
  const race = quietRace(gt);
  race.fuel = 1e9;
  for (let i = 0; i < 4000; i++) {
    race.x = 0;
    race.update(0.02, { accelerate: true });
  }
  assert.ok(race.speed > 345 && race.speed <= 350);
});

test('rain reduces motorcycle steering grip', () => {
  const dry = quietRace(car('moto'));
  const wet = quietRace(car('moto'));
  dry.speed = wet.speed = 100;
  dry.time = 10;
  wet.time = 50;
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

test('every kilometre is a checkpoint that refuels once', () => {
  const race = quietRace();
  race.distance = 999.9;
  race.fuel = 50;
  race.speed = 150;
  race.update(0.05, { accelerate: true });
  assert.ok(race.events.includes('checkpoint'));
  assert.equal(race.checkpoints, 1);
  assert.ok(race.fuel > 60);
  race.update(0.05, { accelerate: true });
  assert.ok(!race.events.includes('checkpoint'));
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

test('the projected contact plane lines up with the camera perspective', () => {
  assert.ok(Math.abs(depthToScreen(PLAYER_DEPTH) - PLAYER_T) < 1e-12);
  for (const t of [0, 0.1, 0.5, 1]) assert.ok(Math.abs(depthToScreen(screenToDepth(t)) - t) < 1e-12);

  const race = quietRace();
  race.entities = [trafficCar({ lane: 0, z: 0.1 })];
  race.update(0.02);
  assert.equal(race.status, 'running');
  race.entities[0]!.z = PLAYER_DEPTH;
  race.update(0.02);
  assert.equal(race.crashes, 1);
  assert.equal(race.status, 'over');
});

test('all five lanes align with collisions and pickups; adjacent lanes stay clear', () => {
  assert.equal(LANE_COUNT, 5);
  assert.deepEqual(LANES, [-2, -1, 0, 1, 2]);
  assert.equal(LANE_DIVIDERS.length, 4);
  for (const lane of LANES) {
    assert.ok(Math.abs(laneCenter(lane)) + LANE_WIDTH / 2 <= 0.931);
    for (const target of LANES) {
      const race = quietRace();
      race.x = laneCenter(lane);
      race.entities = [trafficCar({ lane: target, z: PLAYER_DEPTH })];
      race.update(0.02);
      assert.equal(race.status, lane === target ? 'over' : 'running');
    }
    const race = quietRace();
    race.x = laneCenter(lane);
    race.fuel = 40;
    race.entities = [fuelCan(lane, PLAYER_DEPTH)];
    race.update(0.02);
    assert.ok(race.fuel > 71);
    assert.equal(race.entities.length, 0);
  }
});

// ---- crashes -------------------------------------------------------------

test('touching traffic at any speed is a fatal crash; another lane is safe', () => {
  for (const lane of [0, 1]) {
    for (const speed of [10, 45, 120]) {
      const race = quietRace();
      race.speed = speed;
      race.entities = [trafficCar({ lane, z: PLAYER_DEPTH })];
      race.update(0.02);
      const crashed = lane === 0;
      assert.equal(race.crashed, crashed);
      assert.equal(race.status, crashed ? 'over' : 'running');
      assert.equal(race.crashes, crashed ? 1 : 0);
      if (crashed) {
        assert.equal(race.endReason, 'traffic');
        assert.ok(race.crashSpeed >= speed - 1);
        assert.equal(race.speed, 0);
      }
    }
  }
});

test('the barrier is a fatal crash, except right after a second chance', () => {
  const wall = quietRace();
  wall.speed = 150;
  wall.x = -1.34;
  wall.update(0.05, { steer: -1 });
  assert.equal(wall.status, 'over');
  assert.equal(wall.endReason, 'wall');
  assert.equal(wall.crashed, true);

  const protectedCar = quietRace();
  protectedCar.speed = 150;
  protectedCar.invincible = 2;
  protectedCar.x = -1.34;
  protectedCar.update(0.05, { steer: -1 });
  assert.equal(protectedCar.status, 'running');
  assert.ok(Math.abs(protectedCar.x) < 1.3);
});

// ---- grass ---------------------------------------------------------------

test('entering the grass drags the speed down to about 40 km/h within a second', () => {
  const race = quietRace(car('gt'));
  race.speed = 300;
  race.x = 1.05;
  step(race, 1, { accelerate: true });
  assert.ok(race.offroad);
  assert.ok(race.speed < OFFROAD_LIMIT + 8, `speed was ${race.speed}`);
  assert.ok(race.speed >= OFFROAD_LIMIT - 1);
  assert.equal(OFFROAD_LIMIT, 40);
});

test('on the grass the engine barely pulls, so speed cannot climb past the limit', () => {
  const road = quietRace();
  road.speed = 20;
  road.update(0.05, { accelerate: true });
  const grass = quietRace();
  grass.speed = 20;
  grass.x = 1.05;
  grass.update(0.05, { accelerate: true });
  assert.ok(grass.speed - 20 < (road.speed - 20) * 0.2);

  const long = quietRace(car('gt'));
  for (let i = 0; i < 100; i++) {
    long.x = 1.05;
    long.update(0.05, { accelerate: true });
  }
  assert.ok(long.speed <= OFFROAD_LIMIT + 4);
});

test('leaving the asphalt raises a single offroad event', () => {
  const race = quietRace();
  race.speed = 100;
  race.x = 0.95;
  const events: string[] = [];
  for (let i = 0; i < 30; i++) {
    race.update(0.02, { steer: 1 });
    events.push(...race.events);
  }
  assert.equal(events.filter((event) => event === 'offroad').length, 1);
});

test('braking on the shoulder reaches a standstill without ending the run', () => {
  const race = quietRace();
  race.x = 1.1;
  race.speed = 100;
  step(race, 3, { brake: true });
  assert.equal(race.status, 'running');
  assert.equal(race.speed, 0);
});

// ---- score ---------------------------------------------------------------

test('score pays per metre scaled by the average speed of the current kilometre', () => {
  const drive = (speed: number): Race => {
    const race = quietRace({ ...CARS[0]!, max: 400 });
    for (let i = 0; i < 1200; i++) {
      race.x = 0;
      race.speed = speed;
      race.update(0.05);
    }
    return race;
  };
  const slow = drive(50);
  const par = drive(100);
  const fast = drive(200);
  assert.ok(slow.score < par.score && par.score < fast.score);
  assert.ok(Math.abs(par.score - par.distance) < par.distance * 0.03);
  assert.ok(Math.abs(slow.score - slow.distance * 0.5) < slow.distance * 0.03);
});

test('a checkpoint resets the kilometre clock, and coins come from score', () => {
  const race = quietRace();
  race.kmMetres = 500;
  race.kmTime = 100;
  race.distance = 999.9;
  race.speed = 100;
  race.update(0.05, { accelerate: true });
  assert.ok(race.events.includes('checkpoint'));
  assert.equal(race.kmTime, 0);
  assert.equal(race.kmMetres, 0);

  const fast = quietRace(car('gt'));
  const slow = quietRace(car('gt'));
  for (let i = 0; i < 600; i++) {
    fast.x = slow.x = 0;
    fast.speed = 200;
    slow.speed = 50;
    fast.update(0.05);
    slow.update(0.05);
  }
  assert.equal(fast.coins, Math.floor(fast.score / 25));
  assert.ok(fast.coins > slow.coins * 2);
});
