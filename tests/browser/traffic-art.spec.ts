import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

test('traffic paint changes every model in straight and turning poses', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const reports = await page.evaluate(async () => {
    const { CARS, loadSprites, drawCar } = window.Pista;
    await loadSprites();
    return CARS.flatMap((car) => [0, 0.45, 1].map((turn) => {
      const pixels = ['#3f83c4', '#c34448'].map((color) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        drawCar(ctx, 128, 230, 1, { ...car, color }, false, turn);
        return ctx.getImageData(0, 0, 256, 256).data;
      });
      let changed = 0;
      let alphaChanged = 0;
      for (let i = 0; i < pixels[0]!.length; i += 4) {
        if (pixels[0]![i] !== pixels[1]![i] || pixels[0]![i + 1] !== pixels[1]![i + 1]) changed++;
        if (pixels[0]![i + 3] !== pixels[1]![i + 3]) alphaChanged++;
      }
      return { id: car.id, turn, changed, alphaChanged };
    }));
  });
  for (const report of reports) {
    expect(report.changed, `${report.id}:${report.turn}`).toBeGreaterThan(30);
    expect(report.alphaChanged, `${report.id}:${report.turn}`).toBe(0);
  }
});
