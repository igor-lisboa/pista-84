import { expect, test } from '@playwright/test';
import {submitScore} from '../../src/server/players.ts';
import {memoryPlayerStore} from '../support/memory-player-store.ts';
import {leaderboardApi} from '../../src/server/cloud.ts';

// Service-worker-originated requests bypass Playwright page routes in WebKit.
test.use({serviceWorkers: 'block'});

const accountId = '6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b';

/** The ranking is only for signed-in players, so most tests start with an account on the device. */
async function signedInDevice(page: import('@playwright/test').Page) {
  await page.addInitScript((id) => {
    localStorage.setItem('pista84.account', JSON.stringify({ id, username: 'Tester' }));
  }, accountId);
}

test('a guest sees why the ranking is unavailable instead of the ranking or a login button', async ({ page }) => {
  let rankingRequests = 0;
  await page.route('**/api/leaderboard**', (route) => {
    rankingRequests += 1;
    return route.abort();
  });
  await page.goto('/');
  await page.locator('#leaderboardNav').click();
  await expect(page.locator('#modalBody .warning')).toContainText('logado');
  await expect(page.locator('.lb-list')).toHaveCount(0);
  await expect(page.locator('#modalBody button')).toHaveCount(0);
  expect(rankingRequests).toBe(0);
  await page.locator('#closeModal').click();
  await expect(page.locator('#start')).toBeEnabled();
});

test('the main menu shows the ranking five drivers at a time', async ({ page }) => {
  await signedInDevice(page);
  const store = memoryPlayerStore();
  await page.route('**/api/leaderboard**', async (route) => {
    const response = await leaderboardApi(new Request(route.request().url()), store);
    await route.fulfill({status: response.status, contentType: 'application/json', body: await response.text()});
  });
  // Scores above anything a test run can reach, so these seven always lead.
  for (let i = 0; i < 7; i += 1) {
    expect(await submitScore(store, { playerId: `5b1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5${i}`, username: `Rank_${i}`, score: 9_000_000 - i * 1000, distance: 1000 })).not.toBeNull();
  }

  await page.goto('/');
  await page.locator('#leaderboardNav').click();
  const rows = page.locator('.lb-row');
  await expect(rows).toHaveCount(5);
  await expect(rows.first().locator('.lb-name')).toContainText('Rank_0');
  await expect(rows.first().locator('.lb-rank')).toHaveText('1');
  await expect(page.locator('#lbPrev')).toBeDisabled();

  await page.locator('#lbNext').click();
  await expect(page.locator('.lb-row .lb-rank').first()).toHaveText('6');
  await expect(rows.first().locator('.lb-name')).toContainText('Rank_5');
  await page.locator('#lbPrev').click();
  await expect(rows.first().locator('.lb-rank')).toHaveText('1');
});

test('the ranking says so instead of breaking when the server is unreachable', async ({ page }) => {
  await signedInDevice(page);
  await page.route('**/api/leaderboard**', (route) => route.abort());
  await page.goto('/');
  await page.locator('#leaderboardNav').click();
  await expect(page.locator('#modalBody .warning')).toBeVisible();
  // The game itself is still playable.
  await page.locator('#closeModal').click();
  await expect(page.locator('#start')).toBeEnabled();
});
