import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARS, PAINTS } from '../src/game/index.ts';
import { LANGS, LOCALES, detectLang, isLang } from '../src/i18n/index.ts';
import { ptBR } from '../src/i18n/locales/pt-BR.ts';

const SOURCE_KEYS = Object.keys(ptBR);
const placeholders = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort();

test('seven languages are offered', () => {
  assert.deepEqual(Object.keys(LANGS).sort(), ['de', 'en', 'fr', 'it', 'ja', 'pt-BR', 'pt-PT']);
  assert.ok(isLang('ja'));
  assert.ok(!isLang('xx'));
});

test('every full locale translates every key and keeps the same placeholders', () => {
  for (const lang of ['en', 'fr', 'it', 'ja', 'de'] as const) {
    const table = LOCALES[lang] as Record<string, string>;
    for (const key of SOURCE_KEYS) {
      if (key === 'hud.speedUnit') continue;
      assert.ok(table[key], `${lang} is missing ${key}`);
      assert.deepEqual(placeholders(table[key]!), placeholders((ptBR as Record<string, string>)[key]!), `${lang}:${key}`);
    }
  }
});

test('no locale defines keys that the source language lacks', () => {
  for (const [lang, table] of Object.entries(LOCALES)) {
    for (const key of Object.keys(table)) assert.ok(SOURCE_KEYS.includes(key), `${lang} has unknown key ${key}`);
  }
});

test('every car and paint has a tagline or name in the source language', () => {
  for (const car of CARS) assert.ok(`tag.${car.id}` in ptBR, car.id);
  for (const paint of PAINTS) assert.ok(`paint.${paint.id}` in ptBR, paint.id);
});

test('the browser language is mapped to the closest supported one', () => {
  assert.equal(detectLang(['pt-BR']), 'pt-BR');
  assert.equal(detectLang(['pt-PT']), 'pt-PT');
  assert.equal(detectLang(['pt']), 'pt-BR');
  assert.equal(detectLang(['fr-CA', 'en']), 'fr');
  assert.equal(detectLang(['ja-JP']), 'ja');
  assert.equal(detectLang(['de-AT']), 'de');
  assert.equal(detectLang(['es-ES']), 'en');
  assert.equal(detectLang([]), 'en');
});
