import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gravityOnScreen, screenLean } from '../src/ui/input.ts';
import {orientationGravity, WheelSteering} from '../src/ui/tilt-math.ts';

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

test('tilt has an absolute upright center even when enabled while already turning', () => {
  const wheel = new WheelSteering();
  assert.ok(wheel.motion(-G * Math.sin(at(15)), G * Math.cos(at(15)), 0, 0) > 0.59);
  wheel.motion(0, G, 0, 250);
  assert.ok(Math.abs(wheel.value) < 0.003);
  for (let i = 1; i <= 50; i++) wheel.motion(-G * Math.sin(at(15)), G * Math.cos(at(15)), 0, 250 + i * 20);
  assert.ok(wheel.value > 0.59, 'holding a turn never redefines neutral');
});

test('both screen-facing landscape grips and inverted gravity conventions steer consistently', () => {
  for (const angle of [90, 270]) for (const sign of [1, -1]) {
    const wheel = new WheelSteering();
    const screenX = -G * Math.sin(at(20)), screenY = G * Math.cos(at(20));
    const gx = angle === 90 ? -screenY : screenY;
    const gy = angle === 90 ? screenX : -screenX;
    assert.ok(wheel.motion(gx * sign, gy * sign, angle, 0) > 0.79);
    assert.ok(wheel.motion(gx * sign, -gy * sign, angle, 250) < -0.79);
  }
});

test('orientation-only fallback converts the full pose before mapping screen roll', () => {
  assert.ok(new WheelSteering().orientation(0, 90, 90, 0) === 0);
  assert.ok(new WheelSteering().orientation(0, -90, 270, 0) === 0);
  assert.ok(new WheelSteering().orientation(-20, 90, 90, 0) > 0.79);
  assert.ok(new WheelSteering().orientation(20, -90, 270, 0) > 0.79);
  const [x, y] = orientationGravity(90, 0);
  assert.ok(Math.abs(x) < 1e-9 && Math.abs(y - G) < 1e-9);
});

test('sensor noise is smoothed, flat readings stay neutral and non-finite readings are ignored', () => {
  const wheel = new WheelSteering();
  wheel.motion(0, G, 0, 0);
  const partial = wheel.motion(-G, G, 0, 10);
  assert.ok(partial > 0 && partial < 0.3);
  assert.equal(wheel.motion(NaN, G, 0, 20), partial);
  wheel.motion(0, 0, 0, 250);
  assert.ok(wheel.value < 0.003);
  assert.equal(new WheelSteering().motion(0.01, 0.01, 0, 0), 0);
});
