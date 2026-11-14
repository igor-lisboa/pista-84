import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUDIO_PROFILES, engineVoice } from '../src/audio/audio.ts';
import { vehicleAcceleration } from '../src/game/vehicle-tuning.ts';
import { car, quietRace } from './support/game.ts';

test('new classics have plausible acceleration, speed ceilings and fuel tradeoffs', () => {
  const ranges = { fiat147: [22, 25], marea: [7, 8], passat: [12, 13], puma: [8.1, 8.4], gt: [1.8, 2] };
  for (const [id, [min, max]] of Object.entries(ranges)) {
    const spec = car(id);
    let speed = 0;
    let seconds = 0;
    while (speed < 100 && seconds < 60) {
      speed += vehicleAcceleration(spec, speed) * 0.01;
      seconds += 0.01;
    }
    assert.ok(seconds > min! && seconds < max!, `${id}: 0–100 in ${seconds}s`);
    assert.equal(vehicleAcceleration(spec, spec.max), 0);
  }
  const burn = (id: string) => {
    const race = quietRace(car(id));
    for (let i = 0; i < 100; i++) {
      race.x = 0;
      race.speed = 80;
      race.update(0.05);
    }
    return 100 - race.fuel;
  };
  assert.ok(burn('fiat147') < burn('puma'));
  assert.ok(burn('puma') < burn('passat'));
  assert.ok(burn('passat') < burn('marea'));
  assert.ok(car('puma').handling > car('passat').handling);
});

test('Puma arcade tuning approaches 250 km/h smoothly with acceleration rating 45', () => {
  const spec = car('puma');
  assert.equal(spec.max, 250);
  assert.equal(spec.accel, 45);
  assert.equal(spec.purchase.price, 1200);
  assert.ok(Math.abs(vehicleAcceleration(spec, 0) - 12.825) < 1e-10);
  assert.equal(vehicleAcceleration(spec, 250), 0);
  assert.ok(vehicleAcceleration(spec, 249) > 0);
  const race = quietRace(spec);
  race.speed = 249;
  for (let i = 0; i < 1000; i++) {
    race.x = 0;
    race.fuel = 100;
    race.update(0.02, {accelerate: true});
    assert.ok(race.speed <= 250);
  }
  assert.ok(race.speed > 249);
  const profile = AUDIO_PROFILES.puma;
  assert.ok(profile?.gears);
  assert.equal(profile.gears.at(-1), 250);
  assert.ok(engineVoice(profile, 249, true).frequency > engineVoice(profile, 180, true).frequency);
});

test('Veloce GT acceleration 150 strengthens launch while retaining its 350 km/h ceiling', () => {
  const spec = car('gt');
  assert.equal(spec.accel, 150);
  assert.equal(spec.max, 350);
  assert.equal(vehicleAcceleration(spec, 0), 54);
  assert.equal(vehicleAcceleration(spec, 350), 0);
  assert.ok(vehicleAcceleration(spec, 349) > 0);
  const race = quietRace(spec);
  const targets = [100, 245, 315, 332.5];
  const times = targets.map(() => 0);
  while (race.speed < 332.5 && race.time < 20) {
    race.x = 0;
    race.fuel = 100;
    race.update(0.02, {accelerate: true});
    targets.forEach((speed, i) => { if (times[i] === 0 && race.speed >= speed) times[i] = race.time; });
  }
  [1.92, 5.62, 9.90, 12.90].forEach((expected, i) => assert.ok(Math.abs((times[i] ?? 0) - expected) < 0.04));
});

test('modelled engines rise through each gear, drop pitch on shifts and reserve turbo hiss for load', () => {
  for (const id of ['fiat147', 'marea', 'passat', 'puma', 'gt']) {
    const profile = AUDIO_PROFILES[id]!;
    assert.ok(profile.harmonics!.length >= 5);
    const idle = engineVoice(profile, 0, false);
    assert.ok(idle.frequency >= 25 && idle.frequency < 70);
    assert.equal(idle.turbo, 0);
    profile.gears!.slice(0, -1).forEach((limit, index) => {
      const before = engineVoice(profile, limit - 0.1, true);
      const after = engineVoice(profile, limit + 0.1, true);
      assert.equal(after.gear, index + 2);
      assert.ok(after.frequency < before.frequency * 0.95, `${id} gear ${index + 2}`);
    });
    assert.ok(engineVoice(profile, profile.gears![0]! * 0.9, true).frequency > idle.frequency);
    assert.equal(engineVoice(profile, car(id).max * 0.9, false).turbo, 0);
  }
  assert.ok(engineVoice(AUDIO_PROFILES.marea!, 45, true).turbo > 0);
  assert.equal(engineVoice(AUDIO_PROFILES.puma!, 35, true).turbo, 0);
});

test('ladder Uno is a deliberate 400 km/h meme while the normal Uno retains its previous tuning', () => {
  const normal = car('uno-normal');
  const ladder = car('uno');
  const gt = car('gt');
  assert.equal(normal.max, 150);
  assert.equal(normal.accel, 30);
  assert.equal(ladder.max, 400);
  assert.ok(Math.abs(vehicleAcceleration(normal, 0) - 7.8) < 1e-10);
  assert.ok(vehicleAcceleration(ladder, 0) > 30);
  assert.ok(vehicleAcceleration(ladder, 0) < vehicleAcceleration(gt, 0));
  assert.equal(vehicleAcceleration(ladder, 400), 0);
  assert.ok(vehicleAcceleration(ladder, 399) > 0);
});
