import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';
import type {InputController} from '../../src/ui/input.ts';

declare global {
  interface Window {
    tiltProbe: {locks: string[]; unlocks: number; fullscreens: number; exits: number;
      finishLock?: () => void; input?: InputController};
  }
}

async function fakeSensors(page: import('@playwright/test').Page, pending = false, existingFullscreen = false, denied = false): Promise<void> {
  await page.addInitScript(({pending, existingFullscreen, denied}) => {
    window.tiltProbe = {locks: [], unlocks: 0, fullscreens: 0, exits: 0};
    let fullscreen = existingFullscreen;
    Object.defineProperty(screen, 'orientation', {configurable: true, value: {
      angle: 90, addEventListener() {},
      lock: async (mode: string) => {
        window.tiltProbe.locks.push(mode);
        if (pending) await new Promise<void>(resolve => { window.tiltProbe.finishLock = resolve; });
      },
      unlock() { window.tiltProbe.unlocks++; },
    }});
    Object.defineProperty(document, 'fullscreenElement', {configurable: true, get: () => fullscreen ? document.documentElement : null});
    Element.prototype.requestFullscreen = async () => { window.tiltProbe.fullscreens++; fullscreen = true; };
    document.exitFullscreen = async () => { window.tiltProbe.exits++; fullscreen = false; };
    const orientation = window.DeviceOrientationEvent ?? class {};
    Object.defineProperty(orientation, 'requestPermission', {value: async () => denied ? 'denied' : 'granted', configurable: true});
    Object.defineProperty(window, 'DeviceOrientationEvent', {value: orientation, configurable: true});
    if (window.DeviceMotionEvent) Object.defineProperty(DeviceMotionEvent, 'requestPermission', {value: async () => 'granted', configurable: true});
  }, {pending, existingFullscreen, denied});
}

for (const existingFullscreen of [false, true]) {
  test(`tilt locks landscape and releases only its own fullscreen (${existingFullscreen})`, async ({page}) => {
    await page.setViewportSize({width: 667, height: 375});
    await fakeSensors(page, false, existingFullscreen);
    await page.goto('/');
    await page.locator('#settingsNav').click();
    await expect(page.locator('#calibrate')).toHaveCount(0);
    await page.locator('#tilt').click();
    await expect(page.locator('body')).toHaveAttribute('data-tilt', 'on');
    await expect.poll(() => page.evaluate(() => window.tiltProbe.locks)).toEqual(['landscape']);
    expect(await page.evaluate(() => window.tiltProbe.fullscreens)).toBe(existingFullscreen ? 0 : 1);
    await page.locator('#tilt').click();
    await expect(page.locator('body')).toHaveAttribute('data-tilt', 'off');
    expect(await page.evaluate(() => window.tiltProbe.unlocks)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.tiltProbe.exits)).toBe(existingFullscreen ? 0 : 1);
  });
}

test('a landscape lock completing after tilt is disabled is released again', async ({page}) => {
  await page.setViewportSize({width: 667, height: 375});
  await fakeSensors(page, true);
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#tilt').click();
  await expect.poll(() => page.evaluate(() => window.tiltProbe.locks.length)).toBe(1);
  await page.locator('#tilt').click();
  await page.evaluate(() => window.tiltProbe.finishLock?.());
  await expect.poll(() => page.evaluate(() => window.tiltProbe.unlocks)).toBeGreaterThanOrEqual(2);
  await expect(page.locator('body')).toHaveAttribute('data-tilt', 'off');
});

test('the first tilted sample steers immediately and level returns to center without calibration', async ({page}) => {
  await page.setViewportSize({width: 667, height: 375});
  await fakeSensors(page);
  await page.goto('/');
  await loadHarness(page);
  const steer = await page.evaluate(async () => {
    const input = new window.Pista.InputController(); window.tiltProbe.input = input;
    await input.toggleTilt();
    const motion = new Event('devicemotion');
    Object.defineProperty(motion, 'accelerationIncludingGravity', {value: {x: -9.81 * Math.cos(Math.PI / 9), y: -9.81 * Math.sin(Math.PI / 9), z: 0}});
    window.dispatchEvent(motion);
    return input.read().steer;
  });
  expect(steer).toBeGreaterThan(0.79);
  await expect.poll(() => page.evaluate(() => {
    const motion = new Event('devicemotion');
    Object.defineProperty(motion, 'accelerationIncludingGravity', {value: {x: -9.81, y: 0, z: 0}});
    window.dispatchEvent(motion);
    return Math.abs(window.tiltProbe.input?.read().steer ?? 1);
  })).toBeLessThan(0.01);
});

test('orientation-only upright wheel steering works immediately and sensor silence restores buttons', async ({page}) => {
  await page.setViewportSize({width: 667, height: 375});
  await fakeSensors(page);
  await page.clock.install();
  await page.goto('/');
  await loadHarness(page);
  const steer = await page.evaluate(async () => {
    const input = new window.Pista.InputController(); window.tiltProbe.input = input;
    await input.toggleTilt();
    const orientation = new Event('deviceorientation');
    Object.defineProperties(orientation, {beta: {value: -20}, gamma: {value: 90}});
    window.dispatchEvent(orientation);
    return input.read().steer;
  });
  expect(steer).toBeGreaterThan(0.79);
  await page.clock.fastForward(6000);
  expect(await page.evaluate(() => window.tiltProbe.input?.tiltEnabled)).toBe(false);
  expect(await page.evaluate(() => window.tiltProbe.input?.read().steer)).toBe(0);
  expect(await page.evaluate(() => window.tiltProbe.unlocks)).toBeGreaterThan(0);
});

test('denied permission releases orientation resources and leaves buttons available', async ({page}) => {
  await fakeSensors(page, false, false, true);
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#tilt').click();
  await expect(page.locator('body')).not.toHaveAttribute('data-tilt', 'on');
  await expect(page.locator('#toast')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.tiltProbe.unlocks)).toBeGreaterThan(0);
});

test('sensor timeout updates the open settings switch and restores button steering', async ({page}) => {
  await page.setViewportSize({width: 667, height: 375});
  await fakeSensors(page);
  await page.clock.install();
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#tilt').click();
  await expect(page.locator('#tilt')).toHaveAttribute('aria-pressed', 'true');
  await page.clock.fastForward(6000);
  await expect(page.locator('#tilt')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('body')).toHaveAttribute('data-tilt', 'off');
});

test('wheel-hold help fits all locales in portrait and landscape on phones, tablets and desktop', async ({page}, testInfo) => {
  await page.goto('/');
  await loadHarness(page);
  for (const [width, height] of [[375, 667], [667, 375], [768, 1024], [1024, 768], [900, 1440], [1440, 900]] as const) {
    await page.setViewportSize({width, height});
    const reports = await page.evaluate(() => {
      const {LANGS, setLang, t} = window.Pista;
      const toast = document.getElementById('toast'); if (!toast) throw new Error('Missing toast');
      toast.style.display = 'block';
      return Object.keys(LANGS).map(lang => {
        setLang(lang as keyof typeof LANGS);
        toast.textContent = t('tilt.hold');
        const box = toast.getBoundingClientRect();
        return {lang, text: toast.textContent, fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
          && toast.scrollWidth <= toast.clientWidth + 1 && toast.scrollHeight <= toast.clientHeight + 1};
      });
    });
    for (const report of reports) { expect(report.text).toBeTruthy(); expect(report.fits, `${width}x${height}:${report.lang}`).toBe(true); }
    if (width === 375 || width === 667) await page.screenshot({path: testInfo.outputPath(`tilt-help-${width}x${height}.png`)});
  }
});
