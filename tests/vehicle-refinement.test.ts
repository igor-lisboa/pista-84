import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUDIO_PROFILES, engineVoice } from '../src/audio/audio.ts';
import { vehicleAcceleration } from '../src/game/vehicle-tuning.ts';
import { car, quietRace } from './support/game.ts';

test('new classics have plausible acceleration, speed ceilings and fuel tradeoffs', () => {
  const ranges = { fiat147: [22, 25], marea: [7, 8], passat: [12, 13], puma: [13, 14], gt: [4.7, 5.1] };
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
