import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSave, importSave, loadSave, SAVE_KEY } from '../src/game/save.ts';
import { reconcileStoredSave } from '../src/game/merge-progress.ts';
import { DEMO_CAR_ID } from '../src/game/cars.ts';

const storageWith = (value: unknown) => ({ getItem: (key: string) => (key === SAVE_KEY ? JSON.stringify(value) : null) });

test('a new save has not used its demo run yet, and the demo car is the Veloce GT', () => {
  assert.equal(defaultSave().demoUsed, false);
  assert.equal(DEMO_CAR_ID, 'gt');
});

test('saves from before the demo existed keep their car: a finished tutorial counts as demo-used', () => {
  assert.equal(loadSave(storageWith({ version: 2, tutorialDone: true })).demoUsed, true);
  assert.equal(loadSave(storageWith({ version: 2, tutorialDone: false })).demoUsed, false);
  assert.equal(loadSave(storageWith({ version: 2, tutorialDone: true, demoUsed: false })).demoUsed, false);
  assert.equal(loadSave(storageWith({ version: 2, demoUsed: 'yes' })).demoUsed, false);
});

test('importing an older file cannot bring back a demo that was already played', () => {
  const current = { ...defaultSave(), demoUsed: true };
  const olderFile = JSON.stringify({ version: 2, tutorialDone: false, demoUsed: false });
  assert.equal(importSave(current, olderFile).demoUsed, true);
  const fresh = defaultSave();
  assert.equal(importSave(fresh, JSON.stringify({ version: 2, demoUsed: true })).demoUsed, true);
});

test('merges keep a played demo: account snapshots and other-tab saves never reset it', () => {
  const local = { ...defaultSave(), demoUsed: false };
  const stored = { ...defaultSave(), demoUsed: true };
  assert.equal(reconcileStoredSave(stored, local).demoUsed, true);
  assert.equal(reconcileStoredSave(local, stored).demoUsed, true);
});
