import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

test('vans and SUVs are larger than compact cars at the same camera depth', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const sizes = await page.evaluate(async () => {
    const { CARS, loadSprites, spriteDimensions, paintCarPreview } = window.Pista;
    await loadSprites();
    return Object.fromEntries(CARS.map((car) => {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 110;
      paintCarPreview(canvas, car);
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, 180, 110).data;
      let top = 110;
      let bottom = 0;
      for (let y = 0; y < 110; y++) {
        for (let x = 0; x < 180; x++) {
          if (pixels[(y * 180 + x) * 4 + 3]! > 80) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
        }
      }
      return [car.id, { ...spriteDimensions(car), previewHeight: bottom - top }];
    }));
  });
  expect(sizes.kombi!.width).toBeGreaterThan(sizes.fusca!.width * 1.3);
  expect(sizes.kombi!.height).toBeGreaterThan(sizes.fusca!.height * 1.2);
  expect(sizes.kombi!.previewHeight).toBeGreaterThan(sizes.fusca!.previewHeight * 1.2);
  expect(sizes.suv!.width).toBeGreaterThan(sizes.gol!.width);
  expect(sizes.suv!.height).toBeGreaterThan(sizes.gol!.height * 1.2);
  expect(sizes.opala!.width).toBeGreaterThan(sizes.gol!.width);
  expect(sizes.cg125!.width).toBeLessThan(sizes.gol!.width * 0.6);
});

test('fog also veils the distant city above the road horizon', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const light = await page.evaluate(() => {
    const { Race, Renderer } = window.Pista;
    return [100, 120].map((time) => {
      const canvas = document.createElement('canvas');
      const race = new Race(undefined, () => 0.25);
      race.start();
      race.time = time;
      const renderer = new Renderer(canvas);
      renderer.draw(race, time);
      const pixels = canvas.getContext('2d')!.getImageData(250, 100, 460, 85).data;
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 4) sum += (pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3;
      return sum / (pixels.length / 4);
    });
  });
  expect(light[1]!).toBeGreaterThan(light[0]! + 30);
});
