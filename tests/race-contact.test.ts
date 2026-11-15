import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FUEL_PICKUP, LANES, LANE_COUNT, LANE_DIVIDERS, LANE_WIDTH, PLAYER_DEPTH, PLAYER_T, depthToScreen, laneCenter, screenToDepth} from '../src/game/index.ts';
import {fuelCan, quietRace, trafficCar} from './support/game.ts';

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
    assert.ok(race.fuel > 40 + FUEL_PICKUP - 1, `got ${race.fuel}`);
    assert.equal(race.entities.length, 0);
  }
});

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
