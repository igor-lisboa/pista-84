import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WheelAxes, type ScreenReading} from '../src/ui/tilt-axes.ts';
import {WheelSteering} from '../src/ui/tilt-math.ts';

const G = 9.81;
const stale: ScreenReading = {landscape: true, angle: 0, legacyAngle: null, type: 'portrait-primary'};

test('stale portrait metadata cannot route landscape front/back pitch into steering', () => {
  for (const side of [-1, 1]) {
    const axes = new WheelAxes(), wheel = new WheelSteering();
    for (let degrees = -50; degrees <= 50; degrees += 10) {
      const gx = side * G * Math.cos(degrees * Math.PI / 180);
      const angle = axes.resolve(gx, 0, stale);
      assert.equal(wheel.motion(gx, 0, angle, degrees * 10 + 500), 0);
    }
  }
});

test('wheel rotation is independent of front/back pitch with stale display metadata', () => {
  for (const side of [-1, 1]) for (const pitch of [-40, 0, 40]) {
    const axes = new WheelAxes(), wheel = new WheelSteering();
    const strength = G * Math.cos(pitch * Math.PI / 180);
    const gx = side * strength * Math.cos(20 * Math.PI / 180);
    const gy = side * strength * Math.sin(20 * Math.PI / 180);
    assert.ok(wheel.motion(gx, gy, axes.resolve(gx, gy, stale), 0) > .79);
  }
});

test('screen axes prefer a consistent legacy angle and support landscape-natural tablets', () => {
  assert.equal(new WheelAxes().resolve(-G, 0, {...stale, legacyAngle: 90}), 90);
  assert.equal(new WheelAxes().resolve(0, G, {...stale, type: 'landscape-primary'}), 0);
  assert.equal(new WheelAxes().resolve(-G, 0, {...stale, type: 'landscape-primary'}), 90);
  assert.equal(new WheelAxes().resolve(0, G, {...stale, landscape: false}), 0);
});
