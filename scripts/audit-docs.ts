import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {CARS, PAINTS} from '../src/game/cars.ts';
import {VEHICLE_TUNING} from '../src/game/vehicle-tuning.ts';
import {AUDIO_PROFILES} from '../src/audio/audio.ts';
import {defaultSave} from '../src/game/save.ts';
import {ptBR} from '../src/i18n/locales/pt-BR.ts';
import {ptPT} from '../src/i18n/locales/pt-PT.ts';

const read = (path: string): string => readFileSync(path, 'utf8');
const catalog = read('specs/03-vehicles-and-economy.md');
const audio = read('specs/05-art-and-audio.md');
const rows = (text: string): string[][] => text.split('\n').filter(line => line.startsWith('| '))
  .map(line => line.split('|').slice(1, -1).map(cell => cell.trim().replaceAll('`', '')));
const catalogRows = rows(catalog);
const audioRows = rows(audio);

for (const car of CARS) {
  const row = catalogRows.find(row => row[0] === car.id && row[1] === car.name);
  assert.ok(row, `Missing catalog row: ${car.id}`);
  assert.equal(row[2], car.shape, `${car.id} shape`);
  assert.deepEqual(row.slice(3, 7).map(Number), [car.max, car.accel, car.consumption, car.handling], `${car.id} stats`);
  const price = Number(row[7]!.replaceAll(',', '').match(/\d+/)?.[0]);
  assert.equal(price, car.purchase.price, `${car.id} price`);
  const tuning = VEHICLE_TUNING[car.id]!;
  const tuningRow = catalogRows.find(row => row[0] === car.id && row.length === 5);
  assert.ok(tuningRow, `Missing tuning row: ${car.id}`);
  assert.deepEqual(tuningRow.slice(1).map(Number), [tuning.accelerationGain, tuning.accelerationFalloff, tuning.width, tuning.braking], `${car.id} tuning`);
  const profile = AUDIO_PROFILES[car.id]!;
  const audioRow = audioRows.find(row => row[0] === car.id);
  assert.ok(audioRow, `Missing audio row: ${car.id}`);
  assert.deepEqual(audioRow.slice(1, 3).map(Number), [profile.base, profile.ratio], `${car.id} engine pitch`);
  assert.equal(audioRow[3], profile.wave, `${car.id} waveform`);
  assert.deepEqual(audioRow.slice(4, 7).map(Number), [profile.filter, profile.brake, profile.cylinders], `${car.id} engine`);
  assert.equal(audioRow[7]!.replace(' (turbo)', ''), `${profile.idleRpm} / ${profile.redlineRpm}`, `${car.id} RPM`);
}
assert.equal(catalogRows.filter(row => row.length === 8 && CARS.some(car => car.id === row[0])).length, CARS.length);
assert.equal(Object.keys(VEHICLE_TUNING).length, CARS.length);
assert.equal(Object.keys(AUDIO_PROFILES).length, CARS.length);
for (const paint of PAINTS) {
  const row = catalogRows.find(row => row[0] === paint.id && row.length === 4);
  assert.ok(row, `Missing paint row: ${paint.id}`);
  assert.equal(row[1], ptBR[`paint.${paint.id}` as keyof typeof ptBR], `${paint.id} name`);
  assert.equal(row[2], paint.color ?? 'Preserve model artwork', `${paint.id} color`);
  assert.equal(Number(row[3]), paint.price, `${paint.id} price`);
}

const baseline = read('specs/README.md');
const pkg = JSON.parse(read('package.json')) as {version: string};
assert.ok(baseline.includes(`application **${pkg.version}**`), 'Application version baseline');
const cacheVersion = read('web/sw.ts').match(/const CACHE = `\$\{CACHE_PREFIX\}(v\d+)`/)?.[1];
assert.ok(cacheVersion && baseline.includes(`pista84-${cacheVersion}`), 'Offline cache baseline');
assert.ok(baseline.includes(`save format **${defaultSave().version}**`), 'Save format baseline');
const interfaceSpec = read('specs/04-interface-and-controls.md');
assert.ok(interfaceSpec.includes(`${Object.keys(ptBR).length} today`), 'Translation key count');
assert.ok(interfaceSpec.includes(`overrides ${Object.keys(ptPT).length} keys`), 'pt-PT key count');

let linkCount = 0;
const documents = ['README.md', 'AGENTS.md', ...['specs', 'docs'].flatMap(dir =>
  readdirSync(dir).filter(name => name.endsWith('.md')).map(name => `${dir}/${name}`))];
for (const file of documents) {
  for (const match of read(file).matchAll(/`((?:src|api|worker|scripts|tests|web)\/[^`]+)`/g)) {
    const path = match[1]!;
    if (/[*{}<> ?,]/.test(path)) continue;
    assert.ok(existsSync(path), `${file}: missing source reference ${path}`);
  }
  for (const match of read(file).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1]!.split('#')[0]!.replace(/^<|>$/g, '');
    if (!href || /^[a-z]+:/i.test(href)) continue;
    assert.ok(existsSync(resolve(dirname(file), decodeURIComponent(href))), `${file}: broken link ${href}`);
    linkCount++;
  }
}
console.log(`Documentation checks passed: ${CARS.length} catalog/tuning/audio rows, version/cache baseline, ${documents.length} documents and ${linkCount} local links. Human behavior/prose review is still required.`);
