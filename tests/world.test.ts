import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUDIO_PROFILES } from '../src/audio/audio.ts';
import { MENU_TRACK, RACE_TRACKS, STEPS_PER_BAR } from '../src/audio/tracks.ts';
import {
  CARS,
  PAINTS,
  Race,
  coinPrice,
  CALM_CONDITIONS,
  cycleSecondAt,
  environment,
  rollConditions,
  rollWeather,
  type Conditions,
  importSave,
  isPlayerId,
  kmhToUnit,
  metresToUnit,
  startNewPlayer,
  loadSave,
  paceMultiplier,
  roadCurve,
  MAX_CURVE,
} from '../src/game/index.ts';
import { blendColor } from '../src/render/renderer.ts';

test('the garage has eighteen distinct coin vehicles with accessible sports car prices', () => {
  assert.equal(CARS.length, 18);
  assert.equal(new Set(CARS.map((c) => c.id)).size, CARS.length);
  assert.equal(coinPrice(CARS.find((c) => c.id === 'gt')!), 30_000);
  assert.equal(coinPrice(CARS.find((c) => c.id === 'superbike')!), 20_000);
  for (const name of ['Fiat 147', 'Marea Turbo', 'Passat 85', 'Puma GT']) {
    assert.ok(CARS.some((car) => car.name === name), name);
  }
  for (const c of CARS) assert.ok(coinPrice(c) >= 0);
  assert.ok(CARS.every((c) => coinPrice(c) <= 30_000));
  assert.equal(coinPrice(CARS[0]!), 0);
});

test('every vehicle has its own engine voice', () => {
  assert.equal(Object.keys(AUDIO_PROFILES).length, CARS.length);
  assert.equal(new Set(Object.values(AUDIO_PROFILES).map((p) => p.base)).size, CARS.length);
  for (const c of CARS) assert.ok(AUDIO_PROFILES[c.id], c.id);
});

test('music: one calm menu loop and several distinct upbeat race tracks', () => {
  assert.ok(RACE_TRACKS.length >= 3);
  assert.equal(new Set(RACE_TRACKS.map((t) => t.id)).size, RACE_TRACKS.length);
  assert.ok(MENU_TRACK.bpm < Math.min(...RACE_TRACKS.map((t) => t.bpm)) - 30);
  assert.equal(MENU_TRACK.kick.length, 0);
  for (const track of [MENU_TRACK, ...RACE_TRACKS]) {
    assert.equal(track.chords.length, 4);
    assert.equal(track.bass.length, STEPS_PER_BAR);
    assert.equal(track.arp.length, STEPS_PER_BAR);
  }
  for (const track of RACE_TRACKS) assert.ok(track.kick.length > 0 && track.hats.length > 0);
});

const MIXED: Conditions = { cycleOffset: 0, weather: ['clear', 'rain', 'clear', 'fog'] };

test('environment includes every light and weather state and changes continuously', () => {
  const lights = new Set<string>();
  const weather = new Set<string>();
  for (let t = 0; t < 360; t++) {
    const e = environment(t, MIXED);
    lights.add(e.light);
    weather.add(e.weather);
  }
  assert.equal(lights.size, 4);
  assert.equal(weather.size, 3);

  for (const end of [65, 95, 155, 180]) {
    assert.ok(blendColor('#000000', '#ffffff', environment(end - 0.001, MIXED).mix).startsWith('#'));
    assert.ok(Math.abs(environment(end - 0.001, MIXED).night - environment(end + 0.001, MIXED).night) < 0.001);
  }
  for (let t = 1; t < 400; t++) {
    const a = environment(t - 0.001, MIXED);
    const b = environment(t + 0.001, MIXED);
    assert.ok(Math.abs(a.rain - b.rain) < 0.001);
    assert.ok(Math.abs(a.fog - b.fog) < 0.001);
  }
});

const at = (hours: number, minutes = 0): Date => new Date(2026, 10, 6, hours, minutes);

test('a run starts at the light matching the local clock of the player', () => {
  const lightAt = (date: Date): string => environment(0, { ...CALM_CONDITIONS, cycleOffset: cycleSecondAt(date) }).light;
  assert.equal(lightAt(at(9)), 'day');
  assert.equal(lightAt(at(14, 30)), 'day');
  assert.equal(lightAt(at(18)), 'sunset');
  assert.equal(lightAt(at(21)), 'night');
  assert.equal(lightAt(at(0)), 'night');
  assert.equal(lightAt(at(3)), 'night');
  assert.equal(lightAt(at(6)), 'dawn');
  assert.equal(cycleSecondAt(at(7)), 0);
  assert.ok(environment(0, { ...CALM_CONDITIONS, cycleOffset: cycleSecondAt(at(23)) }).night > 0.9);

  let previous = -1;
  for (let minute = 7 * 60; minute < 7 * 60 + 24 * 60; minute += 10) {
    const second = cycleSecondAt(at(Math.floor(minute / 60) % 24, minute % 60));
    assert.ok(second >= previous && second < 180, `cycle second ${second} at minute ${minute}`);
    previous = second;
  }
});

test('the light keeps cycling from the local starting point during the run', () => {
  const conditions: Conditions = { ...CALM_CONDITIONS, cycleOffset: cycleSecondAt(at(21)) };
  assert.equal(environment(0, conditions).light, 'night');
  const lights = new Set(Array.from({ length: 180 }, (_, t) => environment(t, conditions).light));
  assert.equal(lights.size, 4);
});

test('each run rolls its own weather, and any of it can be rain or fog from the start', () => {
  const plans = Array.from({ length: 40 }, () => rollWeather(Math.random).join());
  assert.ok(new Set(plans).size > 30, 'plans vary between runs');

  const counts = { clear: 0, rain: 0, fog: 0 };
  let state = 7;
  const seeded = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 200; i++) for (const weather of rollWeather(seeded)) counts[weather]++;
  const total = counts.clear + counts.rain + counts.fog;
  assert.ok(Math.abs(counts.clear / total - 0.5) < 0.05, `clear share ${counts.clear / total}`);
  assert.ok(counts.rain / total > 0.2 && counts.fog / total > 0.2);

  assert.equal(environment(0, { cycleOffset: 0, weather: ['rain'] }).rain, 1);
  assert.equal(environment(0, { cycleOffset: 0, weather: ['fog', 'clear'] }).fog, 1);
  assert.equal(environment(0, CALM_CONDITIONS).rain + environment(500, CALM_CONDITIONS).fog, 0);
});

test('a race rolls conditions from its clock and keeps the weather the menu was showing', () => {
  const race = new Race(undefined, Math.random, () => at(21));
  assert.equal(race.environment.light, 'night');
  const preview = race.conditions.weather;
  race.start();
  assert.equal(race.conditions.weather, preview);
  assert.equal(race.environment.light, 'night');
  race.finish('fuel');
  race.start();
  assert.notEqual(race.conditions.weather, preview, 'a restart after a run rolls new weather');
  assert.deepEqual(rollConditions(at(7), () => 0), { cycleOffset: 0, weather: Array(12).fill('clear') });
});

test('the endless road varies by seed and distance with smooth bounded bends and straights', () => {
  for (const seed of [0, 1, 12345, 4294967295]) {
    const signs = new Set<number>();
    for (const d of [0, 150, 400]) assert.equal(roadCurve(d, seed), 0);
    for (let d = 0; d < 100000; d += 3) {
      const curve = roadCurve(d, seed);
      signs.add(Math.sign(curve));
      assert.ok(Math.abs(curve) <= 0.64 * MAX_CURVE);
      assert.ok(Math.abs(curve - roadCurve(d - 0.01, seed)) < 0.02);
      assert.equal(curve, roadCurve(d, seed));
    }
    assert.equal(signs.size, 3);
  }
  const samples = (seed: number) => Array.from({ length: 200 }, (_, i) => roadCurve(i * 137, seed));
  assert.notDeepEqual(samples(1), samples(2));
  // Sampling far ahead never changes geometry that was already generated.
  const before = roadCurve(750, 12345);
  assert.ok(Number.isFinite(roadCurve(1e12, 12345)));
  assert.equal(roadCurve(750, 12345), before);
});

test('new races receive a new road seed while pause and second chance preserve it', () => {
  let value = 0;
  const race = new Race(CARS[0], () => (value += 0.1));
  race.start();
  const seed = race.roadSeed;
  race.status = 'paused';
  race.update(0.05);
  assert.equal(race.roadSeed, seed);
  race.finish('fuel');
  race.resume({ coins: 1000 });
  assert.equal(race.roadSeed, seed);
  race.start();
  assert.notEqual(race.roadSeed, seed);
});

test('the pace multiplier is bounded and rewards speed', () => {
  assert.equal(paceMultiplier(1000, 10), 3);
  assert.equal(paceMultiplier(0, 0), 0.2);
  assert.ok(paceMultiplier(1000, 30) > 0.99 && paceMultiplier(1000, 30) < 1.01);
});

// ---- saves ---------------------------------------------------------------

test('a corrupt save recovers and ownership is validated', () => {
  assert.equal(loadSave({ getItem: () => '{broken' }).selected, 'fusca');
  const save = loadSave({ getItem: () => JSON.stringify({ coins: -1, best: 100, selected: 'gt', owned: [] }) });
  assert.equal(save.coins, 0);
  assert.equal(save.selected, 'fusca');
  assert.equal(save.best, 100);
  assert.equal(loadSave({ getItem: () => 'null' }).selected, 'fusca');
});

test('save migration validates paints, duplicates and fractional coins', () => {
  const save = loadSave({
    getItem: () => JSON.stringify({ coins: 2.8, owned: ['fusca', 'fusca', 'bogus'], paints: ['cherry', 'bad'], paint: 'cherry' }),
  });
  assert.deepEqual(save.owned, ['fusca']);
  assert.deepEqual(save.paints, ['original', 'cherry']);
  assert.equal(save.paint, 'cherry');
  assert.equal(save.coins, 2);
  assert.equal(save.version, 2);
  assert.ok(PAINTS.some((p) => p.id === save.paint));
});

test('sound defaults to on and the chosen language is kept', () => {
  assert.equal(loadSave({ getItem: () => '{}' }).sound, true);
  assert.equal(loadSave({ getItem: () => JSON.stringify({ sound: false, lang: 'ja' }) }).sound, false);
  assert.equal(loadSave({ getItem: () => JSON.stringify({ lang: 'ja' }) }).lang, 'ja');
  assert.equal(loadSave({ getItem: () => '{}' }).lang, null);
});

test('a configured balance takes precedence over local and imported balances', () => {
  const stored = JSON.stringify({ coins: 45, owned: ['fusca', 'gol'], selected: 'gol' });
  for (const text of ['{}', 'null', '{broken', stored]) {
    assert.equal(loadSave({ getItem: () => text }, { coins: 10000 }).coins, 10000);
    assert.equal(loadSave({ getItem: () => text }, { coins: 0 }).coins, 0);
  }
  assert.equal(loadSave({ getItem: () => stored }, { coins: null }).coins, 45);
  assert.equal(loadSave({ getItem: () => stored }, { coins: 10000 }).selected, 'gol');
});

test('the player name is kept only when it fits the leaderboard rules', () => {
  const nameOf = (username: unknown): string | null => loadSave({ getItem: () => JSON.stringify({ username }) }).username;
  assert.equal(nameOf('  Igor_84 '), 'Igor_84');
  assert.equal(nameOf('Zé.Lisboa'), 'Zé.Lisboa');
  assert.equal(nameOf('ab'), null);
  assert.equal(nameOf('a'.repeat(17)), null);
  assert.equal(nameOf('has space'), null);
  assert.equal(nameOf('<script>'), null);
  assert.equal(nameOf(42), null);
  assert.equal(loadSave({ getItem: () => '{}' }).username, null);
});

test('the player GUID is generated once, survives a rename and rejects malformed values', () => {
  const first = loadSave({ getItem: () => '{}' });
  assert.match(first.playerId, /^[0-9a-f-]{36}$/);
  const stored = JSON.stringify({ playerId: first.playerId, username: 'Igor_84' });
  const renamed = loadSave({ getItem: () => JSON.stringify({ ...JSON.parse(stored), username: 'NewName' }) });
  assert.equal(renamed.playerId, first.playerId);
  assert.equal(renamed.username, 'NewName');
  const forged = loadSave({ getItem: () => JSON.stringify({ playerId: 'not-a-guid' }) });
  assert.notEqual(forged.playerId, 'not-a-guid');
  assert.ok(isPlayerId(forged.playerId));
});

test('distance and speed units convert, default to kilometres and survive new players and imports', () => {
  assert.equal(metresToUnit(1609.344, 'mi'), 1);
  assert.equal(metresToUnit(2500, 'km'), 2.5);
  assert.equal(Math.round(kmhToUnit(160.9344, 'mi')), 100);
  assert.equal(kmhToUnit(120, 'km'), 120);

  assert.equal(loadSave({ getItem: () => '{}' }).units, 'km');
  assert.equal(loadSave({ getItem: () => JSON.stringify({ units: 'furlongs' }) }).units, 'km');
  const miles = loadSave({ getItem: () => JSON.stringify({ units: 'mi', tutorialDone: true }) });
  assert.equal(miles.units, 'mi');
  assert.equal(miles.tutorialDone, true);

  // A new player keeps the device's unit but sees the tutorial again.
  const fresh = startNewPlayer(miles);
  assert.equal(fresh.units, 'mi');
  assert.equal(fresh.tutorialDone, false);

  // An import without these fields leaves them alone; one with them replaces them.
  assert.equal(importSave(miles, JSON.stringify({ coins: 1 })).units, 'mi');
  assert.equal(importSave(miles, JSON.stringify({ units: 'km', tutorialDone: false })).units, 'km');
});

test('a save records when it was created and legacy saves count as created now', () => {
  const before = Date.now();
  const legacy = loadSave({ getItem: () => JSON.stringify({ coins: 3 }) });
  assert.ok(legacy.createdAt >= before && legacy.updatedAt === legacy.createdAt);

  const stored = loadSave({ getItem: () => JSON.stringify({ createdAt: 1000, updatedAt: 2000 }) });
  assert.equal(stored.createdAt, 1000);
  assert.equal(stored.updatedAt, 2000);
  assert.equal(loadSave({ getItem: () => JSON.stringify({ createdAt: 'soon', updatedAt: -5 }) }).createdAt >= before, true);

  // Starting over is a new save; an import keeps the file's creation time, or ours if it has none.
  assert.ok(startNewPlayer(stored).createdAt >= before);
  assert.equal(importSave(stored, JSON.stringify({ createdAt: 500 })).createdAt, 500);
  assert.equal(importSave(stored, JSON.stringify({ coins: 1 })).createdAt, 1000);
});
