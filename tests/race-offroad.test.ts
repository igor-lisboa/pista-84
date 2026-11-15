import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MIN_SCORE_FACTOR, OFFROAD_ENTRY_FUEL, OFFROAD_FUEL_BURN, OFFROAD_LIMIT, OFFROAD_SCORE_PENALTY} from '../src/game/index.ts';
import type {Race} from '../src/game/index.ts';
import {car, quietRace, step} from './support/game.ts';

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

test('dropping onto the grass costs fuel at once and keeps draining it', () => {
  const road = quietRace();
  road.speed = 100;
  road.x = 0;
  road.update(0.02);
  const grass = quietRace();
  grass.speed = 100;
  grass.x = 1.05;
  grass.update(0.02);
  assert.ok(grass.offroad);
  const extra = (100 - grass.fuel) - (100 - road.fuel);
  assert.ok(Math.abs(extra - (OFFROAD_ENTRY_FUEL + OFFROAD_FUEL_BURN * 0.02)) < 0.05, `extra burn ${extra}`);

  const before = grass.fuel;
  for (let i = 0; i < 50; i++) {
    grass.x = 1.05;
    grass.update(0.02);
  }
  assert.ok(before - grass.fuel > OFFROAD_FUEL_BURN * 0.9, 'a second on the grass drains at least the grass burn');
});

test('a charged grass excursion raises one fuelPenalty event, none while the cooldown runs', () => {
  const race = quietRace();
  race.speed = 60;
  const events: string[] = [];
  for (let i = 0; i < 10; i++) {
    race.x = i % 2 === 0 ? 1.05 : 0;
    race.update(0.02);
    events.push(...race.events);
  }
  assert.equal(events.filter((event) => event === 'fuelPenalty').length, 1);
  assert.ok(events.filter((event) => event === 'offroad').length > 1);
});

test('each grass excursion cuts the score multiplier until the next checkpoint', () => {
  const race = quietRace();
  race.speed = 100;
  race.x = 0;
  race.update(0.02);
  const clean = race.multiplier;
  race.x = 1.05;
  race.update(0.02);
  assert.equal(race.scoreFactor, 1 - OFFROAD_SCORE_PENALTY);
  assert.ok(race.multiplier < clean);

  race.distance = 999.9;
  race.x = 0;
  race.speed = 100;
  race.update(0.05);
  assert.ok(race.events.includes('checkpoint'));
  assert.equal(race.scoreFactor, 1);
});

test('the grass penalty stacks per excursion down to a floor, but riding the edge is billed once', () => {
  const race = quietRace();
  race.speed = 60;
  for (let i = 0; i < 10; i++) {
    race.x = i % 2 === 0 ? 1.05 : 0;
    race.update(0.02);
  }
  assert.equal(race.scoreFactor, 1 - OFFROAD_SCORE_PENALTY, 'wobbling across the edge within the cooldown');

  for (let i = 0; i < 10; i++) {
    race.x = 0;
    step(race, 2);
    race.x = 1.05;
    race.update(0.02);
  }
  assert.equal(race.scoreFactor, MIN_SCORE_FACTOR);
});

test('the grass is no free brake: dodging through it scores less than staying on the asphalt', () => {
  const drive = (dodge: boolean): Race => {
    const race = quietRace();
    for (let i = 0; i < 400; i++) {
      race.x = dodge && i % 100 < 20 ? 1.05 : 0;
      race.fuel = 100;
      race.update(0.05, { accelerate: true });
    }
    return race;
  };
  assert.ok(drive(true).score < drive(false).score * 0.6);
});
