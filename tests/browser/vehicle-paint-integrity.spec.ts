import {test, expect} from '@playwright/test';
import {loadHarness} from './support/harness.ts';
import {CARS} from '../../src/game/cars.ts';
import {TRAFFIC_PAINTS} from '../../src/game/traffic.ts';
import {BASE_PAINTS} from '../../src/render/sprite-paint.ts';

for (const model of CARS) {
  test(`${model.id}: every paint preserves lenses and tires in every authored pose`, async ({page}, testInfo) => {
    await page.setViewportSize({width: 2700, height: 900});
    await page.goto('/'); await loadHarness(page);
    const reports = await page.evaluate(async ({id, traffic}) => {
      const {CARS, PAINTS, BASE_PAINTS, loadSprites, paintedTile, brakeTile, lampMask, drawCar, spriteDimensions} = window.Pista;
      await loadSprites();
      const car = CARS.find(car => car.id === id); if (!car) throw new Error('Missing car');
      const colors = PAINTS.map(paint => paint.color ?? BASE_PAINTS[id] ?? car.color).concat(traffic);
      document.body.replaceChildren();
      const sheet = document.createElement('canvas'); sheet.width = 2700; sheet.height = 900; document.body.append(sheet);
      const ctx = sheet.getContext('2d'); if (!ctx) throw new Error('No canvas');
      ctx.fillStyle = '#24183b'; ctx.fillRect(0, 0, 2700, 900); ctx.imageSmoothingEnabled = false;
      const read = (tile: HTMLCanvasElement) => {
        const context = tile.getContext('2d'); if (!context) throw new Error('No pixels');
        return context.getImageData(0, 0, tile.width, tile.height).data;
      };
      return ([0, 1, 2] as const).flatMap(pose => {
        const original = paintedTile({...car, color: BASE_PAINTS[id] ?? car.color}, pose);
        if (!original) throw new Error('Missing authored pose');
        const baseline = read(original), mask = lampMask(original, id, pose);
        return colors.map((color, col) => {
          const tile = paintedTile({...car, color}, pose); if (!tile) throw new Error('Missing paint');
          const pixels = read(tile), stopped = brakeTile(tile, id, pose), lit = read(stopped);
          let lensChanges = 0, tireChanges = 0, alphaChanges = 0, bodyChanges = 0, brakeChanges = 0, outsideLens = 0, riderChanges = 0;
          let touringPanelPixels = 0, touringPanelChanges = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const x = (i / 4 % tile.width) / tile.width, y = Math.floor(i / 4 / tile.width) / tile.height;
            const lens = mask[i / 4] === 1;
            const changed = baseline[i] !== pixels[i] || baseline[i + 1] !== pixels[i + 1] || baseline[i + 2] !== pixels[i + 2];
            if (id === 'harley' && y > .5 && y < .8 && (baseline[i + 1] ?? 0) > 80
              && (baseline[i + 1] ?? 0) > (baseline[i] ?? 0) * 1.5 && (baseline[i + 1] ?? 0) > (baseline[i + 2] ?? 0) * .9) {
              touringPanelPixels++; if (changed) touringPanelChanges++;
            }
            if (changed) {
              bodyChanges++; if (lens) lensChanges++; if (y > .88) tireChanges++;
              // Cargo and tail panels overlap the rider's bounding box. Check authored
              // blue denim there instead of misclassifying all flanking bodywork as clothing.
              const denim = (baseline[i + 1] ?? 0) > (baseline[i] ?? 0) * 1.2
                && (baseline[i + 2] ?? 0) > (baseline[i + 1] ?? 0) * 1.1;
              if (['moto', 'superbike', 'cg125'].includes(id) && denim && y > .43 && y < .70
                && (pose === 0 ? x < .3 || x > .7 : x > .5)) riderChanges++;
            }
            if (baseline[i + 3] !== pixels[i + 3] || pixels[i + 3] !== lit[i + 3]) alphaChanges++;
            if (pixels[i] !== lit[i] || pixels[i + 1] !== lit[i + 1] || pixels[i + 2] !== lit[i + 2]) {
              brakeChanges++; if (!lens) outsideLens++;
            }
          }
          for (const [braking, image] of [[0, tile], [1, stopped]] as const) {
            const scale = Math.min(92 / tile.width, 115 / tile.height);
            ctx.drawImage(image, col * 100 + 4, pose * 290 + braking * 140 + 12, image.width * scale, image.height * scale);
          }
          let mirroredChanges = 0;
          if (pose > 0) for (const brake of [false, true]) {
            const views = [1, -1].map(direction => {
              const canvas = document.createElement('canvas'); canvas.width = tile.width * 2 + 20; canvas.height = tile.height + 20;
              const context = canvas.getContext('2d'); if (!context) throw new Error('No canvas');
              context.imageSmoothingEnabled = false;
              // Compare source-resolution output: fractional nearest-neighbor sampling is direction-sensitive in Canvas.
              const scale = tile.height / spriteDimensions(car).height;
              drawCar(context, canvas.width / 2, canvas.height - 10, scale, {...car, color}, brake, (pose === 1 ? .45 : 1) * direction);
              return read(canvas);
            });
            const right = views[0], left = views[1]; if (!right || !left) throw new Error('No mirrored pose');
            const width = tile.width * 2 + 20, height = tile.height + 20;
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++) {
              if (right[(y * width + x) * 4 + c] !== left[(y * width + width - 1 - x) * 4 + c]) mirroredChanges++;
            }
          }
          return {pose, color, lensChanges, tireChanges, alphaChanges, bodyChanges, brakeChanges, outsideLens, riderChanges, mirroredChanges, touringPanelPixels, touringPanelChanges};
        });
      });
    }, {id: model.id, traffic: [...TRAFFIC_PAINTS]});
    for (const report of reports) {
      const label = `${model.id}:${report.pose}:${report.color}`;
      expect(report.lensChanges, label).toBe(0); expect(report.tireChanges, label).toBe(0);
      expect(report.alphaChanges, label).toBe(0); expect(report.outsideLens, label).toBe(0);
      expect(report.riderChanges, label).toBe(0); expect(report.mirroredChanges, label).toBe(0);
      expect(report.brakeChanges, label).toBeGreaterThan(0);
      if (report.color !== BASE_PAINTS[model.id]) expect(report.bodyChanges, label).toBeGreaterThan(30);
      if (model.id === 'harley' && report.color !== BASE_PAINTS[model.id]) {
        expect(report.touringPanelPixels, label).toBeGreaterThan(30);
        expect(report.touringPanelChanges / report.touringPanelPixels, label).toBeGreaterThan(.7);
      }
    }
    expect(reports.some(report => report.bodyChanges > 30)).toBe(true);
    await page.locator('canvas').screenshot({path: testInfo.outputPath(`${model.id}-all-paints.png`)});
  });
}

test('authored vehicle pose review sheet', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1080, height: 4400});
  await page.goto('/'); await loadHarness(page);
  await page.evaluate(async () => {
    const {CARS, loadSprites, paintedTile, BASE_PAINTS} = window.Pista;
    await loadSprites(); document.body.replaceChildren();
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 4400;
    document.body.style.overflow = 'auto'; document.body.append(canvas);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No canvas');
    ctx.fillStyle = '#24183b'; ctx.fillRect(0, 0, 1080, 4400); ctx.imageSmoothingEnabled = false;
    CARS.forEach((car, row) => {
      for (const pose of [0, 1, 2] as const) {
        const tile = paintedTile({...car, color: BASE_PAINTS[car.id] ?? car.color}, pose);
        if (!tile) throw new Error('Missing tile');
        const scale = Math.min(280 / tile.width, 160 / tile.height);
        ctx.drawImage(tile, pose * 360 + 40, row * 200 + 20, tile.width * scale, tile.height * scale);
        ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.fillText(`${car.id}:${pose}`, pose * 360 + 40, row * 200 + 196);
      }
    });
  });
  await page.locator('canvas').screenshot({path: testInfo.outputPath('factory-poses.png')});
  await expect(page.locator('canvas')).toHaveCount(1);
});
