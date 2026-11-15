import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

// These panel points come from the authored artwork, independently of runtime material masks.
const PANELS = [
  {id: 'puma', points: [[.5, .5], [.3, .5], [.3, .5]]},
  {id: 'gt', points: [[.1, .5], [.1, .5], [.1, .5]]},
  {id: 'marea', points: [[.5, .7], [.3, .7], [.3, .7]]},
  {id: 'brasilia', points: [[.3, .6], [.3, .6], [.3, .6]]},
  {id: 'uno', points: [[.5, .6], [.3, .55], [.3, .55]]},
  {id: 'uno-normal', points: [[.3, .55], [.17, .55], [.17, .55]]},
] as const;

test('muted, shaded and neutral body panels receive the selected paint', async ({page}) => {
  await page.goto('/'); await loadHarness(page);
  const results = await page.evaluate(async fixtures => {
    const {CARS, BASE_PAINTS, loadSprites, paintedTile} = window.Pista;
    await loadSprites();
    return fixtures.flatMap(({id, points}) => {
      const car = CARS.find(value => value.id === id); if (!car) throw new Error('Missing car');
      return ([0, 1, 2] as const).flatMap(pose => {
        const original = paintedTile({...car, color: BASE_PAINTS[id] ?? car.color}, pose);
        const point = points[pose]; if (!original || !point) throw new Error('Missing source pose');
        const context = original.getContext('2d'); if (!context) throw new Error('No pixels');
        const x = Math.floor(point[0] * original.width), y = Math.floor(point[1] * original.height);
        const baseline = context.getImageData(x - 1, y - 1, 3, 3).data;
        return ['#12cbd0', '#101010', '#f0f0f0'].map(color => {
          const tile = paintedTile({...car, color}, pose);
          const pixels = tile?.getContext('2d')?.getImageData(x - 1, y - 1, 3, 3).data;
          if (!pixels) throw new Error('Missing painted panel');
          let visible = 0, changed = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if ((baseline[i + 3] ?? 0) < 200) continue;
            visible++;
            if (pixels[i] !== baseline[i] || pixels[i + 1] !== baseline[i + 1] || pixels[i + 2] !== baseline[i + 2]) changed++;
          }
          return {id, pose, color, visible, changed};
        });
      });
    });
  }, PANELS);
  for (const result of results) {
    const label = `${result.id}:${result.pose}:${result.color}`;
    expect.soft(result.visible, label).toBeGreaterThan(5);
    expect.soft(result.changed / result.visible, label).toBeGreaterThan(.5);
  }
});

test('urban motorcycle plates retain their source material in every pose', async ({page}) => {
  await page.goto('/'); await loadHarness(page);
  const results = await page.evaluate(async () => {
    const {CARS, BASE_PAINTS, loadSprites, paintedTile} = window.Pista;
    await loadSprites();
    const car = CARS.find(value => value.id === 'moto'); if (!car) throw new Error('Missing motorcycle');
    return ([0, 1, 2] as const).map(pose => {
      const original = paintedTile({...car, color: BASE_PAINTS.moto ?? car.color}, pose);
      const painted = paintedTile({...car, color: '#12cbd0'}, pose);
      if (!original || !painted) throw new Error('Missing motorcycle pose');
      const x = Math.floor(([.5, .27, .25][pose] ?? .5) * original.width), y = Math.floor(.58 * original.height);
      const source = original.getContext('2d')?.getImageData(x - 1, y - 1, 3, 3).data;
      const target = painted.getContext('2d')?.getImageData(x - 1, y - 1, 3, 3).data;
      if (!source || !target) throw new Error('Missing plate pixels');
      return {pose, source: [...source], target: [...target]};
    });
  });
  for (const result of results) expect(result.target, `plate:${result.pose}`).toEqual(result.source);
});

test('Puma braking changes circular lamps without lighting surrounding panels', async ({page}) => {
  await page.goto('/'); await loadHarness(page);
  const results = await page.evaluate(async () => {
    const {CARS, loadSprites, paintedTile, brakeTile} = window.Pista;
    await loadSprites();
    const car = CARS.find(value => value.id === 'puma'); if (!car) throw new Error('Missing Puma');
    return ([0, 1, 2] as const).flatMap(pose => ['#e04040', '#12cbd0', '#101010'].map(color => {
      const tile = paintedTile({...car, color}, pose); if (!tile) throw new Error('Missing Puma pose');
      const stopped = brakeTile(tile, car.id, pose);
      const read = (image: HTMLCanvasElement, x: number, y: number) => {
        const context = image.getContext('2d'); if (!context) throw new Error('Missing pixels');
        return [...context.getImageData(Math.floor(x * tile.width), Math.floor(y * tile.height), 1, 1).data];
      };
      const lampX = [.13, .065, .061][pose] ?? .13;
      return {pose, color, panel: read(tile, .3, .61), brakedPanel: read(stopped, .3, .61),
        lamp: read(tile, lampX, .62), brakedLamp: read(stopped, lampX, .62)};
    }));
  });
  for (const result of results) {
    const label = `Puma:${result.pose}:${result.color}`;
    expect(result.brakedPanel, label).toEqual(result.panel);
    expect(result.brakedLamp, label).not.toEqual(result.lamp);
  }
});
