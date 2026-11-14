import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';
import {accountBackend} from './support/account-backend.ts';
import {ptBR} from '../../src/i18n/locales/pt-BR.ts';

test.use({serviceWorkers: 'block'});

for (const viewport of [{width: 375, height: 667}, {width: 667, height: 375}, {width: 768, height: 1024}, {width: 1440, height: 900}]) {
  test(`motorcycle taglines fit all locales at ${viewport.width}x${viewport.height}`, async ({page}, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const lang of ['pt-BR', 'en', 'pt-PT', 'fr', 'it', 'ja', 'de', 'es', 'hi', 'zh-CN', 'id', 'ur', 'bn', 'ru', 'am']) {
      await page.locator('#settingsNav').click();
      await page.locator(`.flag[data-lang="${lang}"]`).click();
      await page.locator('#closeModal').click();
      await page.locator('#garageNav').click();
      for (const name of ['Biz 125', 'Hayabusa']) {
        const card = page.locator('.car-card').filter({has: page.getByRole('heading', {name, exact: true})});
        const text = card.locator('.car-tagline');
        expect(await text.innerText()).not.toContain('tag.');
        expect(await text.evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1), `${lang}:${name}`).toBe(true);
      }
      expect(await page.locator('#modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1), lang).toBe(true);
      if (lang === 'ur' || lang === 'en') {
        await page.getByRole('heading', {name: 'Hayabusa', exact: true}).scrollIntoViewIfNeeded();
        await page.screenshot({path: testInfo.outputPath(`garage-${lang}.png`)});
      }
      await page.locator('#closeModal').click();
    }
  });
}

for (const viewport of [{width: 375, height: 667}, {width: 667, height: 375}]) {
  test(`new motorcycles drive, pause and return at ${viewport.width}x${viewport.height}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    for (const id of ['biz125', 'hayabusa']) {
      await page.addInitScript(id => {
        const save = JSON.parse(localStorage.getItem('pista84') ?? '{}');
        Object.assign(save, {tutorialDone: true, demoUsed: true, selected: id, owned: ['fusca', id]});
        localStorage.setItem('pista84', JSON.stringify(save));
      }, id);
      await page.goto('/');
      await expect(page.locator('#carName')).toHaveText(id === 'biz125' ? 'BIZ 125' : 'HAYABUSA');
      await page.locator('#start').click();
      await page.keyboard.down('ArrowUp');
      await expect.poll(async () => Number.parseInt(await page.locator('#speed').innerText(), 10)).toBeGreaterThan(20);
      await page.screenshot({path: testInfo.outputPath(`${id}-${viewport.width}x${viewport.height}.png`)});
      await page.keyboard.up('ArrowUp');
      await page.locator('#pause').click();
      await expect(page.locator('#resume')).toBeVisible();
      await page.locator('#toMenu').click();
      await expect(page.locator('#menu')).toBeVisible();
    }
  });
}

for (const viewport of [{width: 375, height: 667}, {width: 667, height: 375}]) {
  test(`optional account note disappears after signing in at ${viewport.width}x${viewport.height}`, async ({page, context}) => {
    await page.setViewportSize(viewport);
    await accountBackend(context);
    await page.goto('/');
    await page.locator('#settingsNav').click();
    await expect(page.getByText(ptBR['account.optional'], {exact: true})).toBeVisible();
    await page.locator('#account').click();
    await page.locator('#accountTab-signup').click();
    await page.locator('#accountUsername').fill('biker');
    await page.locator('#accountPassword').fill('abcde');
    await page.locator('#accountForm button[type=submit]').click();
    await expect(page.locator('#modal')).toBeHidden();
    await page.locator('#settingsNav').click();
    await expect(page.locator('#account')).toContainText('biker');
    await expect(page.getByText(ptBR['account.optional'], {exact: true})).toHaveCount(0);
  });
}

test('new motorcycle purchases persist and an already-owned ladder Uno stays selectable', async ({page}) => {
  await page.addInitScript(() => {
    const save = JSON.parse(localStorage.getItem('pista84') ?? '{}');
    if (!save.owned?.includes('uno')) localStorage.setItem('pista84', JSON.stringify({tutorialDone: true, demoUsed: true,
      owned: ['fusca', 'uno'], selected: 'fusca', coins: 24200}));
  });
  await page.goto('/');
  for (const name of ['Biz 125', 'Hayabusa', 'Uno com Escada']) {
    await page.locator('#garageNav').click();
    const card = page.locator('.car-card').filter({has: page.getByRole('heading', {name, exact: true})});
    await card.locator('button').click();
    await expect(card.locator('button')).toBeDisabled();
    await page.locator('#closeModal').click();
    await expect(page.locator('#modal')).toBeHidden();
    await expect(page.locator('#carName')).toHaveText(name.toUpperCase());
  }
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84') ?? '{}'));
  expect(save.coins).toBe(0);
  expect(save.owned).toEqual(expect.arrayContaining(['uno', 'biz125', 'hayabusa']));
  await page.reload();
  await expect(page.locator('#carName')).toHaveText('UNO COM ESCADA');
  await page.locator('#garageNav').click();
  await expect(page.locator('.car-card').filter({has: page.getByRole('heading', {name: 'Hayabusa', exact: true})}).locator('button')).toBeEnabled();
});

test('motorcycle atlas has complete alpha cells and distinct painted/braking turn poses', async ({page}, testInfo) => {
  await page.goto('/');
  await loadHarness(page);
  const reports = await page.evaluate(async () => {
    const {CARS, loadSprites, drawCar} = window.Pista;
    await loadSprites();
    const image = new Image(); image.src = '/assets/vehicle-motorcycles-v1.png'; await image.decode();
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    const sourceCtx = source.getContext('2d'); if (!sourceCtx) throw new Error('Canvas unavailable');
    sourceCtx.drawImage(image, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
    const cells = Array.from({length: 6}, (_, index) => {
      const x0 = index % 3 * 512, y0 = Math.floor(index / 3) * 512;
      let opaque = 0, edge = 0;
      for (let y = y0; y < y0 + 512; y++) for (let x = x0; x < x0 + 512; x++) {
        if ((pixels[(y * source.width + x) * 4 + 3] ?? 0) <= 80) continue;
        opaque++;
        if (x === x0 || x === x0 + 511 || y === y0 || y === y0 + 511) edge++;
      }
      return {opaque, edge};
    });
    document.body.replaceChildren();
    const sheet = document.createElement('canvas'); sheet.width = 1200; sheet.height = 680;
    document.body.append(sheet); const ctx = sheet.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#24183b'; ctx.fillRect(0, 0, 1200, 680);
    const poses = [0, 0.45, 1, -0.45, -1, 0];
    const signatures = ['biz125', 'hayabusa'].map((id, row) => {
      const car = CARS.find(car => car.id === id); if (!car) throw new Error('Unknown motorcycle');
      ctx.fillStyle = '#fff6dc'; ctx.font = '18px sans-serif'; ctx.fillText(car.name, 20, row * 340 + 28);
      return poses.map((turn, col) => {
        const tile = document.createElement('canvas'); tile.width = 200; tile.height = 300;
        const tileCtx = tile.getContext('2d'); if (!tileCtx) throw new Error('Canvas unavailable');
        drawCar(tileCtx, 100, 280, 1.8, col === 5 ? {...car, color: '#efbd32'} : car, col === 5, turn);
        ctx.drawImage(tile, col * 200, row * 340 + 36);
        return tile.toDataURL();
      });
    });
    return {cells, signatures};
  });
  for (const cell of reports.cells) { expect(cell.edge).toBe(0); expect(cell.opaque).toBeGreaterThan(10000); }
  for (const row of reports.signatures) expect(new Set(row).size).toBe(6);
  await page.screenshot({path: testInfo.outputPath('motorcycle-poses.png')});
});
