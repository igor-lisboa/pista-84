import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

test('complete fleet shares one camera scale with distinct compact, touring and van silhouettes', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1440, height: 1100});
  await page.goto('/');
  await loadHarness(page);
  const sizes = await page.evaluate(async () => {
    const {CARS, loadSprites, drawCar, spriteDimensions} = window.Pista;
    await loadSprites();
    document.body.replaceChildren();
    const sheet = document.createElement('canvas');
    sheet.width = 1440; sheet.height = 1100; document.body.append(sheet);
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#160a30'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.imageSmoothingEnabled = false;
    return Object.fromEntries(CARS.map((car, i) => {
      const x = (i % 6) * 240 + 120, baseline = Math.floor(i / 6) * 270 + 215;
      ctx.strokeStyle = '#6b45b8'; ctx.beginPath(); ctx.moveTo(x - 108, baseline); ctx.lineTo(x + 108, baseline); ctx.stroke();
      drawCar(ctx, x, baseline, 1, car);
      ctx.fillStyle = '#fff6dc'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(car.name, x, baseline + 28);
      return [car.id, spriteDimensions(car)];
    }));
  });
  expect(sizes.harley!.width).toBeGreaterThan(sizes.hayabusa!.width * 1.2);
  expect(sizes.cg125!.width).toBeLessThan(sizes.gol!.width * .6);
  expect(sizes.kombi!.height).toBeGreaterThan(sizes.fusca!.height * 1.2);
  await page.screenshot({path: testInfo.outputPath('fleet-common-scale.png')});
});
