import { expect, test } from '@playwright/test';

test('the saved player carries created and updated times; updated moves on each save', async ({ page }) => {
  await page.goto('/');
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));

  await page.locator('#settingsNav').click();
  await page.locator('#units').click(); // any save
  const first = await read();
  expect(first.createdAt).toBeGreaterThan(0);
  expect(first.updatedAt).toBeGreaterThanOrEqual(first.createdAt);

  await page.waitForTimeout(20);
  await page.locator('#units').click();
  const second = await read();
  expect(second.createdAt).toBe(first.createdAt);
  expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
});
