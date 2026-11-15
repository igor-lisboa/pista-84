import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

// These panel points come from the authored artwork, independently of runtime material masks.
const PANELS = [
  {id: 'puma', points: [[.5, .5], [.3, .5], [.3, .5]]},
  {id: 'gt', points: [[.1, .5], [.1, .5], [.1, .5]]},
  {id: 'marea', points: [[.5, .7], [.3, .7], [.3, .7]]},
  {id: 'marea', points: [[.5, .81], [.3, .81], [.3, .81]]},
  {id: 'chevette', points: [[.10, .60], [.66, .60], [.61, .60]]},
  {id: 'brasilia', points: [[.3, .6], [.3, .6], [.3, .6]]},
  {id: 'uno', points: [[.3, .6], [.3, .59], [.3, .59]]},
  {id: 'uno-normal', points: [[.3, .55], [.17, .55], [.17, .55]]},
  {id: 'uno-normal', points: [[.3, .65], [.80, .60], [.80, .60]]},
  {id: 'moto', points: [[.40, .45], [.46, .50], [.46, .50]]},
  {id: 'cg125', points: [[.5, .4], [.3, .36], [.3, .35]]},
  {id: 'superbike', points: [[.26, .45], [.14, .44], [.14, .43]]},
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
        return ['#12cbd0', '#101010', '#f0f0f0', '#7ad0c8'].map(color => {
          const tile = paintedTile({...car, color}, pose);
          const pixels = tile?.getContext('2d')?.getImageData(x - 1, y - 1, 3, 3).data;
          if (!pixels) throw new Error('Missing painted panel');
          let visible = 0, changed = 0, greenDifference = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if ((baseline[i + 3] ?? 0) < 200) continue;
            visible++;
            greenDifference += (pixels[i + 1] ?? 0) - (pixels[i] ?? 0);
            if (pixels[i] !== baseline[i] || pixels[i + 1] !== baseline[i + 1] || pixels[i + 2] !== baseline[i + 2]) changed++;
          }
          return {id, pose, color, visible, changed, greenDifference: greenDifference / visible};
        });
      });
    });
  }, PANELS);
  for (const result of results) {
    const label = `${result.id}:${result.pose}:${result.color}`;
    expect.soft(result.visible, label).toBeGreaterThan(5);
    expect.soft(result.changed / result.visible, label).toBeGreaterThan(.5);
    if (result.id.startsWith('uno') && result.color === '#7ad0c8') expect.soft(result.greenDifference, label).toBeGreaterThan(20);
  }
});

test('Hayabusa exhaust chrome retains its material in every paint and pose', async ({page}) => {
  await page.goto('/'); await loadHarness(page);
  const changes = await page.evaluate(async () => {
    const {CARS, PAINTS, BASE_PAINTS, loadSprites, paintedTile} = window.Pista;
    await loadSprites();
    const car = CARS.find(model => model.id === 'hayabusa'); if (!car) throw new Error('Missing motorcycle');
    return ([0, 1, 2] as const).flatMap(pose => {
      const original = paintedTile({...car, color: BASE_PAINTS.hayabusa ?? car.color}, pose);
      if (!original) throw new Error('Missing source');
      const baseline = original.getContext('2d')?.getImageData(0, 0, original.width, original.height).data;
      if (!baseline) throw new Error('Missing pixels');
      return PAINTS.map(paint => {
        const color = paint.color ?? car.color;
        const tile = paintedTile({...car, color}, pose);
        const pixels = tile?.getContext('2d')?.getImageData(0, 0, original.width, original.height).data;
        if (!pixels) throw new Error('Missing paint');
        let samples = 0, changed = 0;
        for (let y = Math.floor(original.height * .62); y < original.height * .78; y++) {
          for (let x = 0; x < original.width; x++) {
            const nx = x / original.width;
            const exhaust = pose === 0 ? nx > .12 && nx < .32 || nx > .68 && nx < .88 : nx > .02 && nx < .19;
            if (!exhaust) continue;
            const i = (y * original.width + x) * 4;
            const r = baseline[i] ?? 0, g = baseline[i + 1] ?? 0, b = baseline[i + 2] ?? 0;
            if ((baseline[i + 3] ?? 0) < 200 || Math.min(r, g, b) < 110 || Math.max(r, g, b) - Math.min(r, g, b) > 50) continue;
            samples++;
            if (r !== pixels[i] || g !== pixels[i + 1] || b !== pixels[i + 2]) changed++;
          }
        }
        return {pose, color, samples, changed};
      });
    });
  });
  for (const report of changes) {
    expect(report.samples, `${report.pose}:${report.color}`).toBeGreaterThan(5);
    expect(report.changed, `${report.pose}:${report.color}`).toBe(0);
  }
});

test('plates, rims and amber lenses retain their source material in every paint and pose', async ({page}) => {
  await page.goto('/'); await loadHarness(page);
  const results = await page.evaluate(async () => {
    const {CARS, PAINTS, BASE_PAINTS, loadSprites, paintedTile, brakeTile} = window.Pista;
    await loadSprites();
    const fixtures = [
      {id: 'moto', points: [[.5, .58], [.27, .58], [.25, .58]]},
      {id: 'superbike', points: [[.5, .575], [.26, .56], [.25, .55]]},
      {id: 'cg125', points: [[.5, .63], [.22, .60], [.24, .59]]},
      {id: 'uno', points: [[.5, .68], [.35, .68], [.30, .68]]},
      {id: 'uno-normal', points: [[.5, .60], [.35, .60], [.30, .59]]},
      // Amber lens samples are independent of runtime lamp masks.
      {id: 'uno-normal', points: [[.85, .55], [.64, .55], [.55, .55]]},
      {id: 'cg125', points: [[.32, .59], [.065, .51], [.075, .49]]},
      // Rim centers above the previous bottom-of-sprite tire check.
      {id: 'uno-normal', points: [[.12, .85], [.715, .75], [.65, .75]]},
      {id: 'uno-normal', points: [[.88, .85], [.955, .62], [.925, .62]]},
      {id: 'uno', points: [[.12, .88], [.715, .79], [.65, .79]]},
    ];
    return fixtures.flatMap(({id, points}) => {
      const car = CARS.find(value => value.id === id); if (!car) throw new Error('Missing vehicle');
      return ([0, 1, 2] as const).flatMap(pose => PAINTS.map(paint => {
        const original = paintedTile({...car, color: BASE_PAINTS[id] ?? car.color}, pose);
        const painted = paintedTile({...car, color: paint.color ?? car.color}, pose);
        if (!original || !painted) throw new Error('Missing vehicle pose');
        const point = points[pose]; if (!point) throw new Error('Missing plate point');
        const x = Math.floor((point[0] ?? .5) * original.width), y = Math.floor((point[1] ?? .6) * original.height);
        const source = original.getContext('2d')?.getImageData(x - 1, y - 1, 3, 3).data;
        const target = painted.getContext('2d')?.getImageData(x - 1, y - 1, 3, 3).data;
        const stopped = brakeTile(painted, id, pose).getContext('2d')?.getImageData(x - 1, y - 1, 3, 3).data;
        if (!source || !target || !stopped) throw new Error('Missing plate pixels');
        return {id, pose, color: paint.color, source: [...source], target: [...target], stopped: [...stopped]};
      }));
    });
  });
  for (const result of results) {
    const label = `fixed material:${result.id}:${result.pose}:${result.color}`;
    expect(result.target, label).toEqual(result.source);
    expect(result.stopped, label).toEqual(result.source);
  }
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
