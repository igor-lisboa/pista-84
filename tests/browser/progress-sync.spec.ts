import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

// Only a signed-in device uploads; guests never contact the server. These tests sign the device in.
const ACCOUNT_ID = '6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b';
const ACCOUNT = JSON.stringify({id: ACCOUNT_ID, username: 'Existing'});

test('hidden garage tools preserve offline progress and sync on pause after reconnecting', async ({page}) => {
  let online = false;
  const uploads: {save: {coins: number; owned: string[]; playerId: string}; revision: number}[] = [];
  await page.addInitScript((account: string) => {
    // LAN HTTP does not expose randomUUID; device IDs must use the shared fallback.
    Object.defineProperty(crypto, 'randomUUID', {value: undefined, configurable: true});
    if (!localStorage.getItem('migration-test')) {
      localStorage.setItem('pista84', JSON.stringify({coins: 987, owned: ['fusca', 'gol'], selected: 'gol', username: 'Existing', tutorialDone: true}));
      localStorage.setItem('pista84.account', account);
      localStorage.setItem('migration-test', 'yes');
    }
  }, ACCOUNT);
  await page.route('**/runtime-config.json', route => route.fulfill({json: {coins: null, progressTools: false}}));
  await page.route('**/api/progress?device=*', async route => {
    if (!online) return route.abort();
    if (route.request().method() === 'GET') return route.fulfill({json: {save: null, revision: 0}});
    uploads.push(route.request().postDataJSON());
    await route.fulfill({json: {revision: 1}});
  });
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#garageNav').click();
  await expect(page.locator('#exportSave, #importSave, #cloudUpload, #cloudRestore')).toHaveCount(0);
  await page.locator('#closeModal').click();
  expect(uploads).toHaveLength(0);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).playerId);
  await page.locator('#start').click();
  online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  expect(uploads).toHaveLength(0);
  await page.locator('#pause').click();
  await expect.poll(() => uploads.length).toBe(1);
  expect(uploads[0]!.save).toMatchObject({coins: 987, owned: ['fusca', 'gol'], playerId: id});
  await page.reload();
  await expect(page.locator('#start')).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).playerId)).toBe(id);
});

test('autosaves and reconnection stay local during play; pause and exit upload once per boundary', async ({page}) => {
  test.setTimeout(180_000);
  await page.clock.install();
  await page.addInitScript((account: string) => {
    localStorage.setItem('pista84', JSON.stringify({
      coins: 987, owned: ['fusca', 'gol'], selected: 'gol', username: 'Existing',
      tutorialDone: true, best: 100, bestScore: 300, sound: false,
    }));
    localStorage.setItem('pista84.account', account);
  }, ACCOUNT);
  const requests: string[] = [];
  await page.route('**/health', route => {
    requests.push('health');
    return route.fulfill({json: {cloudBackup: true}});
  });
  await page.route('**/api/score', route => {
    requests.push('score');
    return route.fulfill({json: {ok: true}});
  });
  await page.route('**/api/progress?device=*', route => {
    requests.push(route.request().method());
    return route.fulfill({json: {revision: 0}});
  });
  await page.goto('/');
  // First entry uploads the signed-in device's offline save (GET + PUT) and its score.
  await expect.poll(() => requests.includes('score') && requests.filter(method => method === 'PUT').length === 1).toBe(true);
  const launched = [...requests];
  expect(launched).toContain('health');
  await page.locator('#start').click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).updatedAt);
  await page.clock.runFor(35_000);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.clock.runFor(1_000);
  expect(requests).toEqual(launched);
  const local = await page.evaluate(() => ({
    save: JSON.parse(localStorage.getItem('pista84')!),
    pending: JSON.parse(localStorage.getItem('pista84.progress-outbox')!),
  }));
  expect(local.save.updatedAt).toBeGreaterThan(before);
  expect(local.pending[local.save.playerId]).toMatchObject({coins: 987, owned: ['fusca', 'gol']});
  await page.locator('#pause').click();
  await expect.poll(() => requests.filter(method => method === 'PUT').length).toBe(2);
  expect(requests.filter(method => method === 'score')).toHaveLength(1);
  await page.locator('#resume').click();
  const afterPause = [...requests];
  await page.clock.runFor(35_000);
  expect(requests).toEqual(afterPause);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(() => requests.filter(method => method === 'PUT').length).toBe(3);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pista84.progress-outbox'))).toBe('{}');
});

test('failed uploads preserve local progress and retry on the next entry', async ({page}) => {
  let available = false;
  let attempts = 0;
  const uploads: {save: {coins: number; owned: string[]; playerId: string}}[] = [];
  await page.addInitScript((account: string) => {
    if (!localStorage.getItem('failure-test')) {
      localStorage.setItem('pista84', JSON.stringify({
        coins: 432, owned: ['fusca', 'gol'], selected: 'gol', username: 'Existing', tutorialDone: true,
      }));
      localStorage.setItem('pista84.account', account);
      localStorage.setItem('failure-test', 'yes');
    }
  }, ACCOUNT);
  await page.route('**/api/progress?device=*', route => {
    attempts++;
    if (!available) return route.fulfill({status: 503, json: {error: 'Unavailable'}});
    if (route.request().method() === 'PUT') uploads.push(route.request().postDataJSON());
    return route.fulfill({json: {revision: 0}});
  });
  await page.goto('/');
  // The first-entry upload fails while the server is unavailable.
  await expect.poll(() => attempts).toBeGreaterThanOrEqual(1);
  await page.locator('#start').click();
  await page.locator('#pause').click();
  await expect.poll(() => attempts).toBeGreaterThanOrEqual(2);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));
  expect(saved.coins).toBe(432);
  expect(await page.evaluate(() => localStorage.getItem('pista84.progress-outbox'))).not.toBe('{}');
  // The server recovers; the next entry uploads the kept save without any button.
  available = true;
  await page.reload();
  await expect.poll(() => uploads.length).toBe(1);
  await page.locator('#start').click();
  await page.locator('#pause').click();
  expect(uploads[0]!.save).toMatchObject({coins: 432, owned: ['fusca', 'gol'], playerId: saved.playerId});
  await page.locator('#toMenu').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pista84.progress-outbox'))).toBe('{}');
});

test('a crash uploads the final locally settled run', async ({page}) => {
  const uploads: {save: {best: number; bestScore: number}}[] = [];
  await page.addInitScript((account: string) => {
    if (!localStorage.getItem('pista84.account')) localStorage.setItem('pista84.account', account);
  }, ACCOUNT);
  await page.route('**/api/progress?device=*', route => {
    if (route.request().method() === 'PUT') uploads.push(route.request().postDataJSON());
    return route.fulfill({json: {revision: 0}});
  });
  await page.goto('/');
  await page.locator('#start').click();
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#overlay')).toHaveClass(/crash/, {timeout: 20_000});
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));
  // Entry (launch) may upload first; the final crash upload must carry the settled run.
  await expect.poll(() => uploads.at(-1)?.save.bestScore).toBe(saved.bestScore);
  expect(uploads.at(-1)!.save.best).toBe(saved.best);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowRight');
});
