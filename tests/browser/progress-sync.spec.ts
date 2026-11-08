import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

test('a returning offline player uploads the existing garage after reconnecting', async ({page}) => {
  let online = false;
  const uploads: {save: {coins: number; owned: string[]; playerId: string}; revision: number}[] = [];
  await page.addInitScript(() => {
    // LAN HTTP does not expose randomUUID; device IDs must use the shared fallback.
    Object.defineProperty(crypto, 'randomUUID', {value: undefined, configurable: true});
    if (!localStorage.getItem('migration-test')) {
      localStorage.setItem('pista84', JSON.stringify({coins: 987, owned: ['fusca', 'gol'], selected: 'gol', username: 'Existing', tutorialDone: true}));
      localStorage.setItem('migration-test', 'yes');
    }
  });
  await page.route('**/runtime-config.json', route => route.fulfill({json: {coins: null}}));
  await page.route('**/api/progress?device=*', async route => {
    if (!online) return route.abort();
    if (route.request().method() === 'GET') return route.fulfill({json: {save: null, revision: 0}});
    uploads.push(route.request().postDataJSON());
    await route.fulfill({json: {revision: 1}});
  });
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  expect(uploads).toHaveLength(0);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).playerId);
  online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => uploads.length).toBe(1);
  expect(uploads[0]!.save).toMatchObject({coins: 987, owned: ['fusca', 'gol'], playerId: id});
  await page.reload();
  await expect(page.locator('#start')).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).playerId)).toBe(id);
});
