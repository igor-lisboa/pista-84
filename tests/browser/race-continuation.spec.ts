import {expect, test} from '@playwright/test';

test.describe('fuel result synchronization', () => {
  test.use({serviceWorkers: 'block'});

  test('fuel exhaustion offers one paid continuation and deducts 1000 coins', async ({ page }) => {
    // Only a signed-in device uploads; this test signs the device in.
    await page.addInitScript(() => localStorage.setItem('pista84.account', JSON.stringify({id: '6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b', username: 'Tester'})));
    const uploads: {coins: number}[] = [];
    const progressRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/progress?device=')) progressRequests.push(request.method());
    });
    await page.route('**/api/progress?device=*', route => {
      if (route.request().method() === 'PUT') uploads.push(route.request().postDataJSON().save);
      return route.fulfill({json: {revision: 0}});
    });
    await page.addInitScript(() => localStorage.setItem('pista84', JSON.stringify({ username: 'Tester', tutorialDone: true, demoUsed: true, coins: 2000, owned: ['fusca'], selected: 'fusca' })));
    await page.route('**/runtime-config.json', (route) => route.fulfill({ json: { coins: null } }));
    await page.route(/\/(?:game\.js|chunks\/[^/]+\.js)$/, async (route) => {
      const response = await route.fetch();
      const source = (await response.text()).replaceAll('this.fuel=100', 'this.fuel=.02').replace(/Math\.max\(\w+,this\.fuel\)/g, 'Math.max(.02,this.fuel)');
      await route.fulfill({ response, body: source });
    });
    await page.goto('/');
    // First entry uploads the signed-in device's save once.
    await expect.poll(() => progressRequests).toEqual(['GET', 'PUT']);
    expect(uploads.at(-1)!.coins).toBe(2000);
    await page.locator('#start').click();
    await expect(page.locator('#restart')).toBeVisible();
    await expect(page.locator('#continue')).toContainText('1.000');
    // Game end uploads the settled balance before the player chooses to continue.
    await expect.poll(() => uploads.at(-1)?.coins).toBe(2000);
    await page.locator('#continue').click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).coins)).toBe(1000);
    await expect(page.locator('#restart')).toBeVisible();
    await expect(page.locator('#continue')).toHaveCount(0);
    await expect.poll(() => uploads.at(-1)?.coins).toBe(1000);
  });
});
