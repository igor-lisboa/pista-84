import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

test('traffic paint changes every model in straight and turning poses', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const reports = await page.evaluate(async () => {
    const { CARS, loadSprites, drawCar } = window.Pista;
    await loadSprites();
    return CARS.flatMap((car) => [0, 0.45, 1].map((turn) => {
      const pixels = ['#3f83c4', '#c34448', '#202431', '#f1f0e8'].map((color) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        drawCar(ctx, 128, 230, 1, { ...car, color }, false, turn);
        return ctx.getImageData(0, 0, 256, 256).data;
      });
      let changed = 0;
      let alphaChanged = 0;
      let neutralChanged = 0;
      let brightnessDifference = 0;
      for (let i = 0; i < pixels[0]!.length; i += 4) {
        if (pixels[0]![i] !== pixels[1]![i] || pixels[0]![i + 1] !== pixels[1]![i + 1]) changed++;
        if (pixels[0]![i + 3] !== pixels[1]![i + 3]) alphaChanged++;
        if (pixels[2]![i] !== pixels[3]![i] || pixels[2]![i + 1] !== pixels[3]![i + 1]) {
          neutralChanged++;
          for (let channel = 0; channel < 3; channel++) brightnessDifference += pixels[3]![i + channel]! - pixels[2]![i + channel]!;
        }
        if (pixels[2]![i + 3] !== pixels[3]![i + 3]) alphaChanged++;
      }
      return { id: car.id, turn, changed, alphaChanged, neutralChanged, brightnessDifference: brightnessDifference / Math.max(1, neutralChanged * 3) };
    }));
  });
  for (const report of reports) {
    expect(report.changed, `${report.id}:${report.turn}`).toBeGreaterThan(30);
    expect(report.alphaChanged, `${report.id}:${report.turn}`).toBe(0);
    expect(report.neutralChanged, `${report.id}:${report.turn}`).toBeGreaterThan(30);
    expect(report.brightnessDifference, `${report.id}:${report.turn}`).toBeGreaterThan(30);
  }
});
