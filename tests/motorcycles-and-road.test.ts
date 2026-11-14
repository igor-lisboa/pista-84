import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AUDIO_PROFILES, engineVoice} from '../src/audio/engine-voices.ts';
import {loadSave, importSave} from '../src/game/save.ts';
import {roadCurve} from '../src/game/road.ts';
import {vehicleAcceleration} from '../src/game/vehicle-tuning.ts';
import {car, quietRace} from './support/game.ts';

test('new bikes have distinct acceleration, efficiency and geared engine voices', () => {
  const times: number[] = [];
  for (const id of ['biz125', 'hayabusa']) {
    const spec = car(id);
    const race = quietRace(spec);
    while (race.speed < 100 && race.time < 60) {
      race.x = 0;
      race.fuel = 100;
      race.update(0.02, {accelerate: true});
    }
    times.push(race.time);
    assert.ok(race.speed >= 100);
    assert.equal(vehicleAcceleration(spec, spec.max), 0);
    assert.ok(vehicleAcceleration(spec, spec.max - 1) > 0);
    const profile = AUDIO_PROFILES[id];
    assert.ok(profile?.gears);
    for (const limit of profile.gears.slice(0, -1)) {
      assert.ok(engineVoice(profile, limit + 0.1, true).frequency < engineVoice(profile, limit - 0.1, true).frequency);
    }
  }
  assert.ok(times[0] && times[0] > 22 && times[0] < 23);
  assert.ok(times[1] && times[1] > 2.7 && times[1] < 3);
  assert.ok(car('biz125').consumption < car('cg125').consumption);
});

test('ladder Uno costs more than Maverick and legacy ownership survives price changes and new bikes', () => {
  assert.ok(car('uno').purchase.price > car('maverick').purchase.price);
  const owned = ['fusca', 'uno', 'biz125', 'hayabusa'];
  const save = loadSave({getItem: () => JSON.stringify({owned, selected: 'uno', coins: 3})});
  assert.deepEqual(save.owned, owned);
  assert.equal(save.selected, 'uno');
  assert.equal(save.coins, 3);
  const restored = importSave(save, JSON.stringify(save));
  assert.deepEqual(restored.owned, owned);
  assert.equal(restored.selected, 'uno');
});

test('arcade Hayabusa keeps its launch pull and approaches its 370 km/h ceiling without overshooting', () => {
  const spec = car('hayabusa');
  assert.equal(spec.max, 370);
  assert.equal(spec.purchase.price, 24000);
  assert.equal(vehicleAcceleration(spec, 0), 36.75);
  assert.equal(vehicleAcceleration(spec, 370), 0);
  assert.ok(vehicleAcceleration(spec, 369) > 0);
  const race = quietRace(spec);
  race.speed = 369;
  for (let i = 0; i < 1000; i++) {
    race.x = 0;
    race.fuel = 100;
    race.update(0.02, {accelerate: true});
    assert.ok(race.speed <= 370);
  }
  assert.ok(race.speed > 369);
  const profile = AUDIO_PROFILES.hayabusa;
  assert.ok(profile?.gears);
  assert.equal(profile.gears.at(-1), 370);
  assert.ok(engineVoice(profile, 369, true).frequency > engineVoice(profile, 300, true).frequency);
});

test('road section caching preserves original curves across seeds, random access and eviction', () => {
  const distances = [480, 640, 880, 1980, 2180, 2530, 5070];
  const snapshots = [
    [0, [0, 0, 0, 3.733342170596394, 50.28536807298661, 0.17610032811663112, 0]],
    [1, [9.288262977000624, 58.48311924040318, 58.48311924040318, 0, -55.14526166365122, -60.711505150989346, 0]],
    [1234, [10.009578870256213, 70.14116486012935, 70.14116486012935, 0, 0, 0, 0]],
    [4294967295, [-9.750107460581656, -54.62530763447285, -54.16260368453131, -42.017994560322826, -64.48452593386173, 0, 0]],
  ] as const;
  for (let pass = 0; pass < 3; pass++) {
    for (const [seed, expected] of snapshots) {
      assert.deepEqual(distances.map(distance => roadCurve(distance, seed)), [...expected]);
      for (let section = 20; section < 40; section++) roadCurve(section * 1600 + 500, seed);
    }
  }
});
