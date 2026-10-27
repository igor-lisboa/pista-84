import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

test('moving brakes produce an audible squeal that stops at rest and when paused', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const offlineSupported = await page.evaluate(() => Boolean(window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext));
  test.skip(!offlineSupported, 'This browser build does not provide offline Web Audio rendering.');
  const levels = await page.evaluate(async () => {
    const NativeContext = window.AudioContext;
    const OfflineContext = window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    async function render(braking: boolean, speed: number, status: 'running' | 'paused' = 'running'): Promise<number> {
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
        audio.update({ car: window.Pista.CARS.find((car) => car.id === 'gt')!, speed, status }, braking);
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
      idle: await render(false, 0),
      stopped: await render(true, 0),
      paused: await render(true, 150, 'paused'),
    };
  });
  expect(levels.braking).toBeGreaterThan(levels.coast * 2);
  expect(levels.stopped).toBeLessThanOrEqual(levels.idle * 1.1);
  expect(levels.paused).toBeLessThan(levels.coast * 0.1);
});
