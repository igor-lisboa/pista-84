import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AUDIO_PROFILES, engineVoice} from '../src/audio/engine-voices.ts';
import {vehicleAcceleration, vehicleTuning} from '../src/game/vehicle-tuning.ts';
import {importSave, loadSave} from '../src/game/save.ts';
import {car, quietRace} from './support/game.ts';

test('Harley is a large, heavier cruiser with deliberate arcade acceleration and ceiling', () => {
  const spec = car('harley');
  assert.equal(spec.shape, 'bike');
  assert.equal(spec.purchase.price, 6000);
  assert.ok(vehicleTuning(spec).width > vehicleTuning(car('hayabusa')).width);
  assert.ok(spec.handling < car('moto').handling);
  assert.equal(vehicleAcceleration(spec, spec.max), 0);
  assert.ok(vehicleAcceleration(spec, spec.max - 1) > 0);
  const race = quietRace(spec);
  const targets = [100, spec.max * 0.7, spec.max * 0.9, spec.max * 0.95];
  const times = targets.map(() => 0);
  while (race.speed < spec.max * 0.95 && race.time < 60) {
    race.x = 0;
    race.fuel = 100;
    race.update(0.02, {accelerate: true});
    assert.ok(race.speed <= spec.max);
    targets.forEach((target, i) => { if (times[i] === 0 && race.speed >= target) times[i] = race.time; });
  }
  [9.86, 12.18, 23.34, 33.34].forEach((expected, i) => assert.ok(Math.abs((times[i] ?? 0) - expected) < 0.04));
});

test('Harley ownership and selection survive saves/import without disturbing existing vehicles', () => {
  const owned = ['fusca', 'uno', 'puma', 'gt', 'hayabusa', 'harley'];
  const save = loadSave({getItem: () => JSON.stringify({owned, selected: 'harley', coins: 120})});
  assert.deepEqual(save.owned, owned);
  assert.equal(save.selected, 'harley');
  const imported = importSave(save, JSON.stringify(save));
  assert.equal(imported.playerId, save.playerId);
  assert.equal(imported.coins, 120);
  assert.equal(imported.selected, 'harley');
  assert.deepEqual(imported.owned, owned);
});

test('Harley has a low two-cylinder four-gear synthesized voice with audible pitch drops', () => {
  const profile = AUDIO_PROFILES.harley;
  assert.ok(profile?.gears);
  assert.equal(profile.cylinders, 2);
  assert.equal(profile.gears.length, 4);
  assert.equal(profile.gears.at(-1), car('harley').max);
  const sport = AUDIO_PROFILES.hayabusa;
  assert.ok(sport);
  assert.ok(engineVoice(profile, 0, false).frequency < engineVoice(sport, 0, false).frequency);
  for (const limit of profile.gears.slice(0, -1)) {
    assert.ok(engineVoice(profile, limit + 0.1, true).frequency < engineVoice(profile, limit - 0.1, true).frequency);
  }
  assert.ok(engineVoice(profile, 160, true).frequency > engineVoice(profile, 115, false).frequency);
});
