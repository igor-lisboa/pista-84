import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

test('motorcycle helmets and rider clothing retain source colors across paints', async ({page}) => {
  await page.goto('/'); await loadHarness(page);
  const reports = await page.evaluate(async () => {
    const {CARS, PAINTS, BASE_PAINTS, paintedTile, loadSprites} = window.Pista;
    await loadSprites();
    return CARS.filter(car => ['moto', 'superbike', 'cg125'].includes(car.id)).flatMap(car => {
      return ([0, 1, 2] as const).flatMap(pose => {
        const source = paintedTile({...car, color: BASE_PAINTS[car.id] ?? car.color}, pose);
        if (!source) throw new Error('Missing source pose');
        // Authored helmet, jacket and trousers, independent of the runtime paint masks.
        const points = pose === 0 ? [[.5, .12], [.5, .23], [.25, .60]]
          : [[.64, .12], [.65, .25], [.65, .60]];
        const read = (tile: HTMLCanvasElement): number[] => points.flatMap(point => {
          const context = tile.getContext('2d'); if (!context) throw new Error('Missing pixels');
          return [...context.getImageData(Math.floor((point[0] ?? 0) * tile.width) - 1,
            Math.floor((point[1] ?? 0) * tile.height) - 1, 3, 3).data];
        });
        const baseline = read(source);
        return PAINTS.map(paint => {
          const tile = paintedTile({...car, color: paint.color ?? car.color}, pose);
          if (!tile) throw new Error('Missing painted pose');
          return {id: car.id, pose, color: paint.color, baseline, painted: read(tile)};
        });
      });
    });
  });
  for (const report of reports) {
    const label = `${report.id}:${report.pose}:${report.color}`;
    expect(report.baseline.filter((value, index) => index % 4 === 3 && value > 200).length, label).toBeGreaterThan(18);
    expect(report.painted, label).toEqual(report.baseline);
  }
});
