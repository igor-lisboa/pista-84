import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

for (const viewport of [{width: 1280, height: 720}, {width: 390, height: 844}, {width: 844, height: 390}]) {
  for (const progressTools of [true, false]) {
    test(`garage progress tools ${progressTools ? 'shown' : 'hidden'} at ${viewport.width}x${viewport.height}`, async ({page}) => {
      await page.setViewportSize(viewport);
      await page.route('**/runtime-config.json', route => route.fulfill({json: {coins: 5000, progressTools}}));
      await page.route('**/health', route => route.fulfill({json: {ok: true, cloudBackup: true}}));
      await page.goto('/');
      await page.locator('#garageNav').click();
      await expect(page.locator('#garageGrid .car-card')).toHaveCount(21);
      // Cloud buttons no longer exist: uploads are automatic for signed-in devices.
      await expect(page.locator('#cloudUpload, #cloudRestore, #cloudTools, .cloud-note')).toHaveCount(0);
      for (const id of ['exportSave', 'importSave']) {
        await expect(page.locator(`#${id}`)).toHaveCount(progressTools ? 1 : 0);
      }
      expect(await page.locator('#modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      // Buying still works when progress tools are hidden, including after garage rerender.
      await page.locator('.car-card').filter({has: page.getByRole('heading', {name: 'Uno com Escada'})}).getByRole('button').click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).coins)).toBe(1800);
      await expect(page.locator('#exportSave')).toHaveCount(progressTools ? 1 : 0);
    });
  }
}
