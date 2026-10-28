import { expect, test } from '@playwright/test';

test('the main menu shows the ranking five drivers at a time', async ({ page, request }) => {
  // Scores above anything a test run can reach, so these seven always lead.
  for (let i = 0; i < 7; i += 1) {
    const response = await request.post('/api/score', {
      data: { playerId: `5b1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5${i}`, username: `Rank_${i}`, score: 9_000_000 - i * 1000, distance: 1000 },
    });
    expect(response.ok()).toBe(true);
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
  await page.route('**/api/leaderboard**', (route) => route.abort());
  await page.goto('/');
  await page.locator('#leaderboardNav').click();
  await expect(page.locator('#modalBody .warning')).toBeVisible();
  // The game itself is still playable.
  await page.locator('#closeModal').click();
  await expect(page.locator('#start')).toBeEnabled();
});
