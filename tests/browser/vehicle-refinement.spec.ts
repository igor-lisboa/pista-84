import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

test('all twelve new atlas cells have complete transparent borders and distinct turn poses', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const result = await page.evaluate(async () => {
    const { loadSprites, spritesReady, drawCar, spriteDimensions, CARS } = window.Pista;
    await loadSprites();
    const image = new Image();
    image.src = '/assets/vehicle-brazilian-v1.png';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const cuts = [0, 320, 675, 1024];
    const cells = Array.from({ length: 12 }, (_, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      let opaque = 0;
      let edge = 0;
      for (let y = row * 384; y < (row + 1) * 384; y++) {
        for (let x = cuts[col]!; x < cuts[col + 1]!; x++) {
          if (data[(y * image.width + x) * 4 + 3]! <= 80) continue;
          opaque++;
          if (x === cuts[col] || x === cuts[col + 1]! - 1 || y === row * 384 || y === (row + 1) * 384 - 1) edge++;
        }
      }
      return { index, opaque, edge };
    });
    canvas.width = 280;
    canvas.height = 200;
    const cars = Object.fromEntries(['fiat147', 'marea', 'passat', 'puma'].map((id) => {
      const car = CARS.find((car) => car.id === id)!;
      const frames = [0, 0.45, 1, -1].map((turn) => {
        ctx.clearRect(0, 0, 280, 200);
        drawCar(ctx, 140, 180, 1.4, car, false, turn);
        return canvas.toDataURL();
      });
      ctx.clearRect(0, 0, 280, 200);
      drawCar(ctx, 140, 180, 1.4, { ...car, color: '#2852b8' });
      return [id, { ...spriteDimensions(car), unique: new Set(frames).size, repainted: canvas.toDataURL() !== frames[0] }];
    }));
    return { ready: spritesReady(), cells, cars };
  });
  expect(result.ready).toBe(true);
  for (const cell of result.cells) {
    expect(cell.edge, `cell ${cell.index} clipped`).toBe(0);
    expect(cell.opaque).toBeGreaterThan(20_000);
  }
  for (const car of Object.values(result.cars)) {
    expect(car.unique).toBe(4);
    expect(car.repainted).toBe(true);
  }
  expect(result.cars.marea!.width).toBeGreaterThan(result.cars.fiat147!.width);
  expect(result.cars.puma!.height).toBeLessThan(result.cars.fiat147!.height);
});

test('engine audio switches between geared models and legacy vehicles without errors', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  test.skip(!await page.evaluate(() => !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)),
    'This browser build does not expose Web Audio');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const enabled = await page.evaluate(async () => {
    const { AudioEngine, CARS } = window.Pista;
    const audio = new AudioEngine();
    await audio.toggle();
    for (const id of ['fiat147', 'marea', 'passat', 'puma', 'gt', 'fusca', 'marea']) {
      const car = CARS.find((car) => car.id === id)!;
      for (const speed of [0, 35, 80, car.max]) {
        audio.update({ status: 'running', speed, car }, false, true);
      }
      audio.update({ status: 'paused', speed: 80, car }, true);
    }
    await audio.toggle();
    return audio.enabled;
  });
  expect(enabled).toBe(false);
  expect(errors).toEqual([]);
});
