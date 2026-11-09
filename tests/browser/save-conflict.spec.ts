import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

const OTHER_PLAYER = '7a2d3b4f-8c5e-4f60-9b8c-1d2e3f4a5b6c';

async function seededPage(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('pista84', JSON.stringify({username: 'Tester', coins: 10, owned: ['fusca'], tutorialDone: true}));
    localStorage.setItem('seeded', '1');
  });
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
}

test('a newer save written by another tab survives this tab leaving the page', async ({page}) => {
  await seededPage(page);
  // Another tab buys a car and earns coins after this one loaded.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pista84')!);
    localStorage.setItem('pista84', JSON.stringify({...save, coins: 777, owned: ['fusca', 'gol'], bestScore: 900, updatedAt: Date.now() + 5000}));
  });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));
  expect(saved.coins).toBe(777);
  expect(saved.owned).toEqual(expect.arrayContaining(['fusca', 'gol']));
  expect(saved.bestScore).toBe(900);
});

test('a save that belongs to another player is never overwritten by a stale tab', async ({page}) => {
  await seededPage(page);
  await page.evaluate((playerId: string) => {
    localStorage.setItem('pista84', JSON.stringify({username: 'NewPlayer', playerId, coins: 0, owned: ['fusca'], updatedAt: Date.now() + 5000}));
  }, OTHER_PLAYER);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));
  expect(saved.playerId).toBe(OTHER_PLAYER);
  expect(saved.username).toBe('NewPlayer');
});
