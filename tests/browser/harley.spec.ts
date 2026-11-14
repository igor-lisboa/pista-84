import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

test('Harley purchase is unavailable below its price', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('pista84', JSON.stringify({tutorialDone: true, demoUsed: true, coins: 5999})));
  await page.goto('/');
  await page.locator('#garageNav').click();
  const card = page.locator('.car-card').filter({has: page.getByRole('heading', {name: 'Harley Electra Glide', exact: true})});
  await expect(card.locator('button')).toBeDisabled();
});

for (const viewport of [{width: 375, height: 667}, {width: 667, height: 375}]) {
  test(`Harley purchase, paint, driving and ownership at ${viewport.width}x${viewport.height}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const save = JSON.parse(localStorage.getItem('pista84') ?? '{}');
      if (!save.owned?.includes('harley')) localStorage.setItem('pista84', JSON.stringify({tutorialDone: true, demoUsed: true,
        owned: ['fusca', 'uno'], selected: 'fusca', coins: 6100}));
    });
    await page.goto('/');
    await page.locator('#garageNav').click();
    const card = page.locator('.car-card').filter({has: page.getByRole('heading', {name: 'Harley Electra Glide', exact: true})});
    await expect(card.locator('dd').nth(0)).toHaveText('165 km/h');
    await card.locator('button').click();
    await expect(card.locator('button')).toBeDisabled();
    const ocean = page.locator('.paint-option').filter({hasText: 'Azul oceano'});
    await ocean.click();
    await page.locator('#closeModal').click();
    await page.clock.install();
    await page.reload();
    await expect(page.locator('#carName')).toHaveText('HARLEY ELECTRA GLIDE');
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84') ?? '{}'));
    expect(save.coins).toBe(40);
    expect(save.paint).toBe('ocean');
    expect(save.owned).toEqual(expect.arrayContaining(['fusca', 'uno', 'harley']));
    await page.locator('#start').click();
    await page.keyboard.down('ArrowUp');
    await page.clock.runFor(4000);
    await expect.poll(async () => Number.parseInt(await page.locator('#speed').innerText(), 10)).toBeGreaterThan(25);
    await page.screenshot({path: testInfo.outputPath(`harley-gameplay-${viewport.width}x${viewport.height}.png`)});
    await page.keyboard.up('ArrowUp');
    await page.locator('#pause').click();
    await expect(page.locator('#resume')).toBeVisible();
    await page.locator('#toMenu').click();
    await expect(page.locator('#menu')).toBeVisible();
  });
}

test('Harley authored poses keep complete bags, neutral trim and a larger common-scale silhouette', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1440, height: 760});
  await page.goto('/');
  await loadHarness(page);
  const reports = await page.evaluate(async () => {
    const {loadSprites, drawCar, CARS, spriteDimensions} = window.Pista;
    await loadSprites();
    const image = new Image(); image.src = '/assets/vehicle-harley-v1.png'; await image.decode();
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    const context = source.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, source.width, source.height).data;
    const cuts = [0, 470, 960, 1536];
    const cells = cuts.slice(0, -1).map((start, i) => {
      const end = cuts[i + 1]; if (!end) throw new Error('Missing cut');
      let edge = 0, count = 0;
      for (let y = 0; y < source.height; y++) for (let x = start; x < end; x++) {
        if ((pixels[(y * source.width + x) * 4 + 3] ?? 0) <= 80) continue;
        count++;
        if (x === start || x === end - 1 || y === 0 || y === source.height - 1) edge++;
      }
      return {edge, count};
    });
    const harley = CARS.find(car => car.id === 'harley'), hayabusa = CARS.find(car => car.id === 'hayabusa');
    if (!harley || !hayabusa) throw new Error('Missing bike');
    document.body.replaceChildren();
    const sheet = document.createElement('canvas'); sheet.width = 1440; sheet.height = 760; document.body.append(sheet);
    const ctx = sheet.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#24183b'; ctx.fillRect(0, 0, 1440, 760);
    const signatures = [0, 0.45, 1, -0.45, -1, 0].map((turn, col) => {
      const tile = document.createElement('canvas'); tile.width = 240; tile.height = 340;
      const tileCtx = tile.getContext('2d'); if (!tileCtx) throw new Error('Canvas unavailable');
      drawCar(tileCtx, 120, 320, 1.2, col === 5 ? {...harley, color: '#efbd32'} : harley, col === 5, turn);
      ctx.drawImage(tile, col * 240, 20);
      return tile.toDataURL();
    });
    const paintSamples = [harley, {...harley, color: '#efbd32'}].map(car => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 400;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
      context.imageSmoothingEnabled = false;
      drawCar(context, 200, 380, 1, car);
      return context.getImageData(0, 0, 400, 400).data;
    });
    const original = paintSamples[0], painted = paintSamples[1];
    if (!original || !painted) throw new Error('Missing paint sample');
    let neutralChanges = 0, neutralPixels = 0;
    for (let i = 0; i < original.length; i += 4) {
      const r = original[i] ?? 0, g = original[i + 1] ?? 0, b = original[i + 2] ?? 0;
      if ((original[i + 3] ?? 0) > 80 && Math.min(r, g, b) > 160 && Math.max(r, g, b) - Math.min(r, g, b) < 12) {
        neutralPixels++;
        if (r !== painted[i] || g !== painted[i + 1] || b !== painted[i + 2]) neutralChanges++;
      }
    }
    for (const [id, x] of [['moto', 250], ['hayabusa', 720], ['harley', 1190]] as const) {
      const car = CARS.find(car => car.id === id); if (!car) throw new Error('Missing bike');
      ctx.fillStyle = '#fff6dc'; ctx.font = '20px sans-serif'; ctx.fillText(car.name, x - 100, 415);
      drawCar(ctx, x, 735, 1.2, car);
    }
    return {cells, signatures, neutralChanges, neutralPixels, width: spriteDimensions(harley).width, otherWidth: spriteDimensions(hayabusa).width};
  });
  for (const cell of reports.cells) { expect(cell.edge).toBe(0); expect(cell.count).toBeGreaterThan(10000); }
  expect(new Set(reports.signatures).size).toBe(6);
  expect(reports.width).toBeGreaterThan(reports.otherWidth * 1.2);
  expect(reports.neutralPixels).toBeGreaterThan(50);
  expect(reports.neutralChanges).toBe(0);
  await page.screenshot({path: testInfo.outputPath('harley-poses.png')});
});
