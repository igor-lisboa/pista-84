import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CARS, CHECKPOINT_FUEL, FUEL_PICKUP, PAR_SPEED, PLAYER_DEPTH, Race} from '../src/game/index.ts';
import {car, fuelCan, quietRace} from './support/game.ts';

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

test('fuel is scarce: a can restores an eighth of a tank, a checkpoint a twenty-fifth', () => {
  assert.equal(FUEL_PICKUP, 12);
  assert.equal(CHECKPOINT_FUEL, 4);
});

test('a fuel can restores its amount, caps at 100 and is consumed once', () => {
  const half = quietRace();
  half.fuel = 50;
  half.entities = [fuelCan(0, PLAYER_DEPTH)];
  half.update(0.02);
  assert.ok(Math.abs(half.fuel - (50 + FUEL_PICKUP)) < 0.5, `got ${half.fuel}`);

  const race = quietRace();
  race.fuel = 90;
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

test('every kilometre is a checkpoint that refuels once', () => {
  const race = quietRace();
  race.distance = 999.9;
  race.fuel = 50;
  race.speed = 150;
  race.update(0.05, { accelerate: true });
  assert.ok(race.events.includes('checkpoint'));
  assert.equal(race.checkpoints, 1);
  assert.ok(race.fuel > 50 + CHECKPOINT_FUEL - 1, `got ${race.fuel}`);
  assert.ok(race.fuel < 50 + CHECKPOINT_FUEL + 0.01);
  race.update(0.05, { accelerate: true });
  assert.ok(!race.events.includes('checkpoint'));
});

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
  const par = drive(PAR_SPEED);
  const fast = drive(200);
  assert.ok(slow.score < par.score && par.score < fast.score);
  assert.ok(Math.abs(par.score - par.distance) < par.distance * 0.03);
  assert.ok(Math.abs(slow.score - slow.distance * (50 / PAR_SPEED)) < slow.distance * 0.03);
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
