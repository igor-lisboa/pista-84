import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gravityOnScreen, screenLean } from '../src/ui/input.ts';

const G = 9.81;
const at = (degrees: number) => (degrees * Math.PI) / 180;

test('upright phone reads zero lean in portrait and both gravity sign conventions', () => {
  assert.ok(Math.abs(screenLean(0, G, 0, 1)) < 1e-9);
  assert.ok(Math.abs(screenLean(0, -G, 0, -1)) < 1e-9);
});

test('leaning the top to the right steers right (positive) whichever sign convention the platform uses', () => {
  const reaction = screenLean(-G * Math.sin(at(30)), G * Math.cos(at(30)), 0, 1);
  const inverted = screenLean(G * Math.sin(at(30)), -G * Math.cos(at(30)), 0, -1);
  assert.ok(Math.abs(reaction - 30) < 1e-6, `reaction ${reaction}`);
  assert.ok(Math.abs(inverted - 30) < 1e-6, `inverted ${inverted}`);
});

test('steering keeps its direction past 90 degrees instead of flipping like Euler gamma', () => {
  const past = screenLean(-G * Math.sin(at(120)), G * Math.cos(at(120)), 0, 1);
  assert.ok(Math.abs(past - 120) < 1e-6, `past ${past}`);
});

test('landscape reads the same roll on the screen axes', () => {
  // Phone turned to landscape: screen-up is the device's x axis, so the same lean shows on x.
  const [x, y] = gravityOnScreen(0, G, 90);
  assert.ok(Math.abs(x - G) < 1e-9 && Math.abs(y) < 1e-9);
  assert.ok(Math.abs(screenLean(0, G, 90, 1)) > 0);
});
