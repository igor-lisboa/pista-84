import {test, expect} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

test('every vehicle keeps grounded poses and mirrored wet-road lamps', async ({page}, testInfo) => {
  await page.setViewportSize({width: 3000, height: 3520});
  await page.goto('/'); await loadHarness(page);
  const reports = await page.evaluate(async () => {
    const {CARS, BASE_PAINTS, loadSprites, spriteDimensions, carPlacement, paintVehicleGround, drawCar} = window.Pista;
    await loadSprites(); document.body.replaceChildren();
    const sheet = document.createElement('canvas'); sheet.width = 3000; sheet.height = 3520;
    document.body.style.overflow = 'auto'; document.body.append(sheet);
    const ctx = sheet.getContext('2d'); if (!ctx) throw new Error('No canvas');
    ctx.fillStyle = '#525a67'; ctx.fillRect(0, 0, sheet.width, sheet.height); ctx.imageSmoothingEnabled = false;
    return CARS.flatMap((model, row) => {
      const car = {...model, color: BASE_PAINTS[model.id] ?? model.color};
      return [0, .45, 1].map((turn, pose) => {
        const placement = carPlacement(car, turn), scale = 1;
        const sides = [1, -1].map(direction => {
          const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 300;
          const c = canvas.getContext('2d'); if (!c) throw new Error('No canvas');
          c.imageSmoothingEnabled = false;
          // Integer source scaling makes a pixel-perfect mirror meaningful.
          const sourceScale = placement.source.height / spriteDimensions(car).height;
          paintVehicleGround(c, 300, 150, sourceScale, car, turn * direction, 1, 1, true);
          return c.getImageData(0, 0, 600, 300).data;
        });
        const right = sides[0], left = sides[1]; if (!right || !left) throw new Error('No ground');
        let reflectionPixels = 0, compositeErrors = 0;
        let maxCompositeDelta = 0, worstPixel = '';
        const roadColor = [82, 90, 103] as const;
        for (let y = 155; y < 300; y++) for (let x = 0; x < 600; x++) {
          const i = (y * 600 + x) * 4;
          if (right[i + 3]! > 0) reflectionPixels++;
          if (turn > 0) for (let channel = 0; channel < 4; channel++) {
            const oppositePixel = (y * 600 + 599 - x) * 4;
            const opposite = oppositePixel + channel;
            if (channel < 3) {
              const rightAlpha = right[i + 3]!, leftAlpha = left[oppositePixel + 3]!;
              const rightComposite = (right[i + channel]! * rightAlpha
                + roadColor[channel]! * (255 - rightAlpha)) / 255;
              const leftComposite = (left[opposite]! * leftAlpha
                + roadColor[channel]! * (255 - leftAlpha)) / 255;
              const delta = Math.abs(rightComposite - leftComposite);
              if (delta > maxCompositeDelta) {
                maxCompositeDelta = delta;
                worstPixel = JSON.stringify({
                  x, y, channel,
                  right: [right[i], right[i + 1], right[i + 2], right[i + 3]],
                  left: [left[oppositePixel], left[oppositePixel + 1],
                    left[oppositePixel + 2], left[oppositePixel + 3]],
                  rightComposite, leftComposite,
                });
              }
              if (delta > 3) compositeErrors++;
            }
          }
        }
        for (const [condition, rain] of [[0, 0], [1, 1]] as const) {
          for (const [side, direction] of [[0, 1], [1, -1]] as const) {
            const x = pose * 1000 + condition * 500 + side * 250 + 125, y = row * 160 + 132;
            paintVehicleGround(ctx, x, y, scale, car, turn * direction, 1, rain, true);
            drawCar(ctx, x, y, scale, car, true, turn * direction);
          }
        }
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(`${car.id}: pose ${pose}; dry/wet`, pose * 1000 + 5, row * 160 + 155);
        return {id: car.id, pose, reflectionPixels, compositeErrors, maxCompositeDelta, worstPixel,
          height: placement.height, expectedHeight: spriteDimensions(car).height};
      });
    });
  });
  await page.locator('canvas').screenshot({path: testInfo.outputPath('fleet-ground-night.png')});
  for (const report of reports) {
    expect(report.height, `${report.id}:${report.pose}`).toBe(report.expectedHeight);
    expect(report.reflectionPixels, `${report.id}:${report.pose}`).toBeGreaterThan(0);
    // Canvas rasterization can vary slightly by engine; compare visible pixels over asphalt.
    expect(report.compositeErrors, JSON.stringify(report)).toBe(0);
  }
});

test('turning vehicles share scene lighting and road placement', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1920, height: 1440});
  await page.goto('/'); await loadHarness(page);
  await page.evaluate(async () => {
    const {CARS, Race, Renderer, loadSprites} = window.Pista;
    await loadSprites(); document.body.replaceChildren();
    const sheet = document.createElement('canvas'); sheet.width = 1920; sheet.height = 1440;
    document.body.style.overflow = 'auto'; document.body.append(sheet);
    const ctx = sheet.getContext('2d'); if (!ctx) throw new Error('No canvas');
    ['puma', 'gt', 'marea', 'harley'].forEach((id, index) => {
      const car = CARS.find(model => model.id === id); if (!car) throw new Error('Missing vehicle');
      const race = new Race({...car, color: '#d6283b'}, () => .4);
      race.status = 'running'; race.speed = 80; race.steer = index % 2 ? -1 : .45; race.path = 125;
      race.conditions = {cycleOffset: 120, weather: [index % 2 ? 'rain' : 'clear']};
      race.entities = [];
      const scene = document.createElement('canvas'); new Renderer(scene).draw(race, 1, {brake: true});
      ctx.drawImage(scene, index % 2 * 960, Math.floor(index / 2) * 720);
      ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
      ctx.fillText(`${id}: night ${index % 2 ? 'rain / left' : 'dry / right'}`, index % 2 * 960 + 20, Math.floor(index / 2) * 720 + 30);
    });
  });
  await page.locator('canvas').screenshot({path: testInfo.outputPath('turning-gameplay-night.png')});
  await expect(page.locator('canvas')).toHaveCount(1);
});
