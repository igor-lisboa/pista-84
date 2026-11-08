import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

test('a delayed audio unlock cannot override the player switching sound off', async ({page}) => {
  await page.goto('/');
  await loadHarness(page);
  const supported = await page.evaluate(() => Boolean(window.AudioContext ||
    (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext));
  test.skip(!supported, 'This browser build does not provide Web Audio.');
  const enabled = await page.evaluate(async () => {
    const NativeContext = window.AudioContext ||
      (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    let context: AudioContext | undefined;
    let finishUnlock!: () => void;
    let calls = 0;
    window.AudioContext = function () {
      context = new NativeContext();
      context.resume = () => ++calls === 1
        ? new Promise<void>(resolve => { finishUnlock = resolve; })
        : Promise.resolve();
      return context;
    } as unknown as typeof AudioContext;
    try {
      const audio = new window.Pista.AudioEngine();
      const unlocking = audio.setEnabled(true);
      await audio.setEnabled(false);
      finishUnlock();
      await unlocking;
      return audio.enabled;
    } finally {
      window.AudioContext = NativeContext;
      await context?.close();
    }
  });
  expect(enabled).toBe(false);
});

test('brake friction is audible, throttle stands out, and effects stop at rest or pause', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const offlineSupported = await page.evaluate(() => Boolean(window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext));
  test.skip(!offlineSupported, 'This browser build does not provide offline Web Audio rendering.');
  const levels = await page.evaluate(async () => {
    const NativeContext = window.AudioContext;
    const OfflineContext = window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    async function render(braking: boolean, speed: number, status: 'running' | 'paused' = 'running', accelerating = false): Promise<number> {
      // Render the actual sound graph, measuring high-frequency energy above the engine.
      const context = new OfflineContext(1, 16384, 44100);
      context.resume = async () => {};
      window.AudioContext = function () { return context; } as unknown as typeof AudioContext;
      // Offline rendering runs faster than the wall clock. Keep the music scheduler out of
      // this effects measurement so machine load cannot add different notes to each sample.
      const nativeInterval = window.setInterval;
      window.setInterval = (() => 0) as unknown as typeof window.setInterval;
      const audio = new window.Pista.AudioEngine();
      try {
        await audio.toggle();
        audio.update({ car: window.Pista.CARS.find((car) => car.id === 'gt')!, speed, status }, braking, accelerating);
        const buffer = await context.startRendering();
        const samples = buffer.getChannelData(0);
        let energy = 0;
        const start = samples.length / 2;
        for (let i = start; i < samples.length; i++) energy += (samples[i]! - samples[i - 1]!) ** 2;
        return Math.sqrt(energy / (samples.length - start));
      } finally {
        await audio.toggle();
        window.AudioContext = NativeContext;
        window.setInterval = nativeInterval;
      }
    }
    return {
      coast: await render(false, 150),
      braking: await render(true, 150),
      throttle: await render(false, 150, 'running', true),
      idle: await render(false, 0),
      stopped: await render(true, 0),
      paused: await render(true, 150, 'paused'),
    };
  });
  expect(levels.braking).toBeGreaterThan(levels.coast * 1.05);
  expect(levels.throttle).toBeGreaterThan(levels.coast * 1.4);
  expect(levels.stopped).toBeLessThanOrEqual(levels.idle * 1.1);
  expect(levels.paused).toBeLessThan(levels.coast * 0.1);
});
